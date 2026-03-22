const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { generateNextId } = require('../services/id-generator');
const logic = require('../services/business-logic');

// GET /api/dashboard/stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const [types, units, customers, rentals, venues, bookings] = await Promise.all([
      db.getAll('Equipment_Types'), db.getAll('Equipment_Units'),
      db.getAll('Customers'), db.getAll('Rentals'),
      db.getAll('Venues'), db.getAll('Venue_Bookings'),
    ]);

    res.json({
      total_equipment_types: types.length,
      total_equipment_units: units.length,
      available_units: units.filter(u => u.status === 'available').length,
      rented_units: units.filter(u => u.status === 'rented').length,
      maintenance_units: units.filter(u => u.status === 'maintenance').length,
      total_customers: customers.length,
      active_rentals: rentals.filter(r => ['draft', 'reserved', 'active', 'overdue'].includes(r.status)).length,
      completed_rentals: rentals.filter(r => r.status === 'returned').length,
      total_revenue: rentals.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0),
      total_venues: venues.length,
      active_venues: venues.filter(v => v.active !== false).length,
      active_bookings: bookings.filter(b => ['draft', 'reserved', 'confirmed', 'active'].includes(b.status)).length,
      completed_bookings: bookings.filter(b => b.status === 'completed').length,
      venue_revenue: bookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dashboard/schedule?start=...&end=...
router.get('/schedule', requireAuth, async (req, res) => {
  try {
    const { start: startDate, end: endDate } = req.query;
    const startD = new Date(startDate);
    const endD = new Date(endDate); endD.setHours(23, 59, 59);

    const [allRentals, rentalItems, types, units, allCustomers, allBookings, allVenues] = await Promise.all([
      db.getAll('Rentals'), db.getAll('Rental_Items'), db.getAll('Equipment_Types'),
      db.getAll('Equipment_Units'), db.getAll('Customers'), db.getAll('Venue_Bookings'), db.getAll('Venues'),
    ]);

    const typeMap = {}; types.forEach(t => { typeMap[t.type_id] = t; });
    const unitMap = {}; units.forEach(u => { unitMap[u.unit_id] = u; });
    const custMap = {}; allCustomers.forEach(c => { custMap[c.customer_id] = c; });
    const venueMap = {}; allVenues.forEach(v => { venueMap[v.venue_id] = v; });

    const scheduleRentals = allRentals
      .filter(r => r.status !== 'cancelled')
      .filter(r => {
        const rStart = new Date(r.rental_start);
        const rEnd = new Date(r.rental_end);
        return rEnd >= startD && rStart <= endD;
      })
      .map(rental => {
        const items = rentalItems.filter(ri => ri.rental_id === rental.rental_id && !ri.is_deleted);
        const cust = custMap[rental.customer_id] || {};
        return {
          rental_id: rental.rental_id, customer_name: cust.name || '未知',
          start: rental.rental_start, end: rental.rental_end,
          status: rental.status, item_count: items.length,
          items: items.map(i => ({ unit_id: i.unit_id, type_name: (typeMap[i.type_id] || {}).type_name || i.type_id, internal_code: (unitMap[i.unit_id] || {}).internal_code || i.unit_id })),
        };
      });

    const scheduleBookings = allBookings
      .filter(b => b.status !== 'cancelled')
      .filter(b => {
        const bStart = new Date(b.booking_start);
        const bEnd = new Date(b.booking_end);
        return bEnd >= startD && bStart <= endD;
      })
      .map(booking => {
        const venue = venueMap[booking.venue_id] || {};
        const cust = custMap[booking.customer_id] || {};
        return {
          booking_id: booking.booking_id, venue_name: venue.name || '未知',
          customer_name: cust.name || '未知', start: booking.booking_start,
          end: booking.booking_end, status: booking.status, rate_type: booking.rate_type,
        };
      });

    res.json({ rentals: scheduleRentals, bookings: scheduleBookings });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== Activity Logs ====================

router.get('/activity-logs', requireAuth, requirePermission('manage_staff'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM "Activity_Logs" ORDER BY created_at DESC LIMIT $1', [parseInt(req.query.limit) || 100]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/activity-logs', requireAuth, async (req, res) => {
  try {
    const { action, target_type, target_id, description } = req.body;
    const logData = {
      log_id: 'AL-' + Date.now(),
      staff_id: req.user ? req.user.staff_id : 'system',
      staff_name: req.user ? req.user.name : '系統',
      action: action || '',
      target_type: target_type || '',
      target_id: target_id || '',
      description: description || '',
      ip_info: req.ip || '',
      created_at: new Date(),
    };
    res.json(await db.insert('Activity_Logs', logData));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== Misc CRUD (storage, rules, etc.) ====================

const simpleCrud = (table, idField, prefix, permission) => {
  const r = express.Router();
  r.get('/', requireAuth, async (req, res) => {
    try { res.json(await db.getFiltered(table, req.query)); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });
  r.post('/', requireAuth, requirePermission(permission), async (req, res) => {
    try {
      const data = req.body;
      data[idField] = await generateNextId(table, idField, prefix);
      data.is_deleted = false;
      if (!data.created_at) data.created_at = new Date();
      res.json(await db.insert(table, data));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  r.put('/:id', requireAuth, requirePermission(permission), async (req, res) => {
    try { res.json(await db.update(table, idField, req.params.id, req.body)); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });
  return r;
};

// ==================== Check-in ====================

router.post('/check-in', requireAuth, requirePermission('process_check_in'), async (req, res) => {
  try {
    const data = req.body;
    const unit = (await db.getFiltered('Equipment_Units', { unit_id: data.unit_id }))[0];
    if (!unit) return res.status(404).json({ error: '找不到器材: ' + data.unit_id });

    const logData = {
      log_id: await generateNextId('Inventory_Logs', 'log_id', 'IL'),
      unit_id: data.unit_id, rental_id: data.rental_id || '',
      log_type: 'check_in', log_date: new Date(), performed_by: data.performed_by || req.user.staff_id,
      from_location_id: '', to_location_id: data.to_location_id || unit.location_id || '',
      condition_before: unit.current_condition || 'good', condition_after: data.condition_after || 'good',
      checklist_completed: true, accessories_complete: data.accessories_complete !== false,
      missing_accessories: data.missing_accessories || '',
      needs_maintenance: data.needs_maintenance || false, needs_cleaning: data.needs_cleaning || false,
      damage_found: data.damage_found || false, photo_urls: data.photo_urls || '',
      notes: data.notes || '',
      inspection_deadline: logic.addWorkingDays(new Date(), 3),
      inspection_overdue: false, is_deleted: false,
    };
    await db.insert('Inventory_Logs', logData);

    const unitUpdates = {
      current_condition: data.condition_after || unit.current_condition,
      location_id: data.to_location_id || unit.location_id,
      status: (data.needs_maintenance || data.damage_found) ? 'maintenance' : 'available',
    };
    await db.update('Equipment_Units', 'unit_id', data.unit_id, unitUpdates);

    let damageRecord = null;
    if (data.damage_found && data.damage_description) {
      damageRecord = {
        damage_id: await generateNextId('Damage_Records', 'damage_id', 'DM'),
        rental_id: data.rental_id || '', unit_id: data.unit_id,
        damage_description: data.damage_description, damage_severity: 'moderate',
        within_tolerance: false, assessed_by: data.performed_by || req.user.staff_id,
        status: 'pending', created_at: new Date(), is_deleted: false,
      };
      await db.insert('Damage_Records', damageRecord);
    }

    // Update rental items return status
    if (data.rental_id) {
      const rentalItems = (await db.getFiltered('Rental_Items', { rental_id: data.rental_id }))
        .filter(i => !i.is_deleted && i.unit_id === data.unit_id);
      for (const item of rentalItems) {
        await db.update('Rental_Items', 'item_id', item.item_id, {
          return_status: 'returned', return_date: new Date(),
          condition_in: data.condition_after || '', checked_in_by: data.performed_by || req.user.staff_id,
        });
      }
      // Check if all items returned
      const allItems = (await db.getFiltered('Rental_Items', { rental_id: data.rental_id })).filter(i => !i.is_deleted);
      const allReturned = allItems.every(i => i.return_status === 'returned');
      if (allReturned) {
        const rental = (await db.getFiltered('Rentals', { rental_id: data.rental_id }))[0];
        if (rental && ['active', 'overdue'].includes(rental.status)) {
          await logic.advanceRentalStatus(data.rental_id, 'returned', { return_date: new Date() });
        }
      }
    }

    res.json({ success: true, log_id: logData.log_id, new_status: unitUpdates.status, damage_record: damageRecord });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== Receipt Generation ====================

router.get('/receipt/rental/:id', requireAuth, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const rental = (await db.getAll('Rentals', { includeDeleted: true })).find(r => r.rental_id === rentalId && !r.is_deleted);
    if (!rental) return res.status(404).json({ error: '找不到租借單' });

    const [customers, items, types, units, payments, serviceItems] = await Promise.all([
      db.getAll('Customers'), db.getFiltered('Rental_Items', { rental_id: rentalId }),
      db.getAll('Equipment_Types'), db.getAll('Equipment_Units'),
      db.getFiltered('Payments', { rental_id: rentalId }), db.getFiltered('Service_Items', { rental_id: rentalId }),
    ]);

    const customer = customers.find(c => c.customer_id === rental.customer_id);
    const typeMap = {}; types.forEach(t => { typeMap[t.type_id] = t; });
    const unitMap = {}; units.forEach(u => { unitMap[u.unit_id] = u; });
    const days = logic.calculateRentalDays(rental.rental_start, rental.rental_end);

    res.json({
      rental_id: rentalId,
      customer: { name: customer?.name || '未知', company: customer?.company_name || '', phone: customer?.phone || '', email: customer?.email || '' },
      rental_start: rental.rental_start, rental_end: rental.rental_end, days, status: rental.status,
      items: items.filter(i => !i.is_deleted).map(item => {
        const type = typeMap[item.type_id] || {};
        const unit = unitMap[item.unit_id] || {};
        return { type_name: type.type_name || item.type_id, internal_code: unit.internal_code || item.unit_id, serial_number: unit.serial_number || '', daily_rate: parseFloat(item.daily_rate_snapshot || type.daily_rate || 0), days, line_total: parseFloat(item.line_total || 0), discount_amount: parseFloat(item.discount_amount || 0) };
      }),
      services: serviceItems.filter(s => !s.is_deleted).map(s => ({ description: s.description || s.service_type, unit_price: parseFloat(s.unit_price || 0), quantity: parseInt(s.quantity || 1), line_total: parseFloat(s.line_total || 0) })),
      total_amount: parseFloat(rental.total_amount || 0), paid_amount: parseFloat(rental.paid_amount || 0),
      tax_rate: parseFloat(rental.tax_rate || 0.05), deposit_status: rental.deposit_status || '',
      payments: payments.filter(p => !p.is_deleted).map(p => ({ payment_id: p.payment_id, amount: parseFloat(p.amount || 0), method: p.payment_method || '', date: p.payment_date || '' })),
      notes: rental.notes || '', created_at: rental.created_at, generated_at: new Date().toISOString(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { router, simpleCrud };
