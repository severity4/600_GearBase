const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { generateNextId, generateYearBasedId } = require('../services/id-generator');
const logic = require('../services/business-logic');

// ==================== Venues ====================

router.get('/', requireAuth, async (req, res) => {
  try { res.json(await db.getFiltered('Venues', req.query)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/active', async (req, res) => {
  try {
    const venues = (await db.getAll('Venues')).filter(v => v.active !== false);
    res.json(venues);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    const venues = (await db.getAll('Venues')).filter(v =>
      v.active !== false &&
      ((v.name && v.name.toLowerCase().includes(q)) ||
       (v.venue_type && v.venue_type.toLowerCase().includes(q)) ||
       (v.amenities && v.amenities.toLowerCase().includes(q)))
    );
    res.json(venues);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, requirePermission('create'), async (req, res) => {
  try {
    const data = req.body;
    if (!data.name) return res.status(400).json({ error: '場地名稱必填' });
    if (!data.venue_type) return res.status(400).json({ error: '場地類型必填' });
    if (!data.hourly_rate || isNaN(parseFloat(data.hourly_rate))) return res.status(400).json({ error: '時租費必填' });
    if (!data.max_capacity || isNaN(parseInt(data.max_capacity))) return res.status(400).json({ error: '最大容納人數必填' });

    data.venue_id = await generateNextId('Venues', 'venue_id', 'VN');
    data.created_by = req.user.staff_id;
    data.created_at = new Date();
    data.is_deleted = false;
    data.active = data.active !== undefined ? data.active : true;

    res.json(await db.insert('Venues', data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireAuth, requirePermission('update'), async (req, res) => {
  try { res.json(await db.update('Venues', 'venue_id', req.params.id, req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAuth, requirePermission('delete'), async (req, res) => {
  try { await db.softDelete('Venues', 'venue_id', req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== Venue Bookings ====================

router.get('/bookings', requireAuth, async (req, res) => {
  try { res.json(await db.getFiltered('Venue_Bookings', req.query)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bookings', requireAuth, requirePermission('create_rental'), async (req, res) => {
  try {
    const data = req.body;
    if (!data.venue_id) return res.status(400).json({ error: '場地必填' });
    if (!data.customer_id) return res.status(400).json({ error: '客戶必填' });
    if (!data.booking_start) return res.status(400).json({ error: '預約開始時間必填' });
    if (!data.booking_end) return res.status(400).json({ error: '預約結束時間必填' });
    if (!data.rate_type) return res.status(400).json({ error: '計費方式必填' });

    // Blacklist check
    const customer = (await db.getFiltered('Customers', { customer_id: data.customer_id }))[0];
    if (customer && customer.blacklisted) {
      return res.status(400).json({ error: '此客戶已列入黑名單' });
    }

    // Snapshot rate
    if (data.venue_id && !data.unit_rate) {
      const venue = (await db.getFiltered('Venues', { venue_id: data.venue_id }))[0];
      if (venue) {
        const rt = data.rate_type || 'hourly';
        if (rt === 'hourly') data.unit_rate = parseFloat(venue.hourly_rate) || 0;
        else if (rt === 'half_day') data.unit_rate = parseFloat(venue.half_day_rate) || parseFloat(venue.hourly_rate) * 4;
        else if (rt === 'daily') data.unit_rate = parseFloat(venue.daily_rate) || parseFloat(venue.hourly_rate) * 8;
      }
    }

    data.booking_id = await generateYearBasedId('Venue_Bookings', 'booking_id', 'VB');
    data.created_at = new Date(); data.updated_at = new Date();
    data.status = 'draft'; data.is_deleted = false;

    const unitRate = parseFloat(data.unit_rate) || 0;
    const rateQty = parseFloat(data.rate_quantity) || 1;
    data.subtotal = Math.round(unitRate * rateQty);
    data.discount_amount = parseFloat(data.discount_amount) || 0;
    data.overtime_fee = parseFloat(data.overtime_fee) || 0;
    data.tax_rate = parseFloat(data.tax_rate) || 0.05;
    const taxableAmount = data.subtotal - data.discount_amount + data.overtime_fee;
    data.tax_amount = Math.round(taxableAmount * data.tax_rate);
    data.total_amount = taxableAmount + data.tax_amount;
    data.deposit_status = data.deposit_status || 'pending';
    data.prepared_by = data.prepared_by || req.user.staff_id;
    data.handled_by = data.handled_by || req.user.staff_id;

    res.json(await db.insert('Venue_Bookings', data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/bookings/:id', requireAuth, requirePermission('update'), async (req, res) => {
  try {
    req.body.updated_at = new Date();
    res.json(await db.update('Venue_Bookings', 'booking_id', req.params.id, req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/bookings/:id', requireAuth, requirePermission('delete'), async (req, res) => {
  try {
    await db.update('Venue_Bookings', 'booking_id', req.params.id, { is_deleted: true, updated_at: new Date() });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bookings/:id/status', requireAuth, requirePermission('update'), async (req, res) => {
  try {
    const { status, ...metadata } = req.body;
    await logic.advanceVenueBookingStatus(req.params.id, status, metadata);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/bookings/:id/breakdown', requireAuth, async (req, res) => {
  try { res.json(await logic.calculateVenueBookingBreakdown(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/availability', async (req, res) => {
  try {
    const { venue_id, start, end, exclude } = req.query;
    const available = await logic.checkVenueAvailability(venue_id, start, end, exclude);
    res.json({ available });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/venues/:id/schedule?yearMonth=2026-03
router.get('/:id/schedule', async (req, res) => {
  try {
    const venueId = req.params.id;
    const yearMonth = req.query.yearMonth;
    const venue = (await db.getAll('Venues')).find(v => v.venue_id === venueId);
    if (!venue) return res.json({ venue: null, booked_dates: [] });

    const [year, month] = yearMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    const bookings = (await db.getAll('Venue_Bookings')).filter(b =>
      b.venue_id === venueId && b.status !== 'cancelled'
    );

    const bookedDates = [];
    bookings.forEach(b => {
      const bStart = new Date(b.booking_start);
      const bEnd = new Date(b.booking_end);
      const cursor = new Date(Math.max(bStart.getTime(), firstDay.getTime()));
      cursor.setHours(0, 0, 0, 0);
      const endLimit = new Date(Math.min(bEnd.getTime(), lastDay.getTime()));
      endLimit.setHours(23, 59, 59);

      while (cursor <= endLimit) {
        const dateStr = cursor.toISOString().split('T')[0];
        if (!bookedDates.includes(dateStr)) bookedDates.push(dateStr);
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    res.json({
      venue: { venue_id: venue.venue_id, name: venue.name, available_start_time: venue.available_start_time || '09:00', available_end_time: venue.available_end_time || '22:00' },
      booked_dates: bookedDates.sort(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
