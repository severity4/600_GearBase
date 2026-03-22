const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { generateRentalId, generateNextId, generateYearBasedId } = require('../services/id-generator');
const logic = require('../services/business-logic');

// GET /api/rentals
router.get('/', requireAuth, async (req, res) => {
  try { res.json(await db.getFiltered('Rentals', req.query)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/rentals
router.post('/', requireAuth, requirePermission('create_rental'), async (req, res) => {
  try {
    const data = req.body;
    if (!data.customer_id) return res.status(400).json({ error: '客戶必填' });
    if (!data.rental_start && !data.start_date) return res.status(400).json({ error: '開始日期必填' });
    if (!data.rental_end && !data.end_date) return res.status(400).json({ error: '結束日期必填' });

    data.rental_start = data.rental_start || data.start_date;
    data.rental_end = data.rental_end || data.end_date;

    // Blacklist check
    const customer = (await db.getFiltered('Customers', { customer_id: data.customer_id }))[0];
    if (customer && customer.blacklisted) {
      return res.status(400).json({ error: `此客戶已列入黑名單${customer.blacklist_reason ? `（原因：${customer.blacklist_reason}）` : ''}` });
    }

    data.rental_id = await generateRentalId();
    data.created_at = new Date();
    data.updated_at = new Date();
    data.status = 'draft';
    data.total_amount = 0; data.paid_amount = 0; data.subtotal = 0;
    data.discount_total = 0; data.overdue_fee = 0;
    data.tax_rate = data.tax_rate || 0.05; data.tax_amount = 0;
    data.deposit_status = data.deposit_status || 'pending';
    data.contract_signed = data.contract_signed || false;
    data.delivery_required = data.delivery_required || false;
    data.invoice_required = data.invoice_required || false;
    data.invoice_status = data.invoice_required ? 'pending' : 'not_required';
    data.prepared_by = data.prepared_by || req.user.staff_id;
    data.handled_by = data.handled_by || req.user.staff_id;
    data.is_deleted = false;

    res.json(await db.insert('Rentals', data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/rentals/:id
router.put('/:id', requireAuth, requirePermission('update'), async (req, res) => {
  try {
    req.body.updated_at = new Date();
    res.json(await db.update('Rentals', 'rental_id', req.params.id, req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/rentals/:id/status
router.post('/:id/status', requireAuth, requirePermission('update'), async (req, res) => {
  try {
    const { status, ...metadata } = req.body;
    await logic.advanceRentalStatus(req.params.id, status, metadata);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// GET /api/rentals/:id/breakdown
router.get('/:id/breakdown', requireAuth, async (req, res) => {
  try { res.json(await logic.calculateRentalBreakdown(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/rentals/:id/recalculate
router.post('/:id/recalculate', requireAuth, requirePermission('update'), async (req, res) => {
  try { res.json(await logic.recalculateAndUpdateRental(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/rentals/overdue
router.get('/status/overdue', requireAuth, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const rentals = (await db.getAll('Rentals')).filter(r =>
      ['active', 'overdue'].includes(r.status) && new Date(r.rental_end) < today
    );
    res.json(rentals);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== Rental Items ====================

// GET /api/rentals/:id/items
router.get('/:id/items', requireAuth, async (req, res) => {
  try { res.json(await db.getFiltered('Rental_Items', { rental_id: req.params.id })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/rentals/:id/items
router.post('/:id/items', requireAuth, requirePermission('create'), async (req, res) => {
  try {
    const data = req.body;
    data.item_id = await generateNextId('Rental_Items', 'item_id', 'RI');
    data.rental_id = req.params.id;
    data.is_deleted = false;

    if (data.type_id) {
      const type = (await db.getFiltered('Equipment_Types', { type_id: data.type_id }))[0];
      if (type) {
        data.daily_rate_snapshot = data.daily_rate_snapshot || parseFloat(type.daily_rate) || 0;
        data.replacement_value_snapshot = data.replacement_value_snapshot || parseFloat(type.replacement_value) || 0;
      }
    }

    if (!data.days) {
      const rental = (await db.getFiltered('Rentals', { rental_id: req.params.id }))[0];
      if (rental) data.days = logic.calculateRentalDays(rental.rental_start, rental.rental_end);
    }

    const rate = parseFloat(data.daily_rate_snapshot) || 0;
    const qty = parseInt(data.quantity) || 1;
    const days = parseInt(data.days) || 1;
    data.line_total = Math.round(rate * qty * days);
    data.line_total_after_discount = data.line_total;
    data.return_status = data.return_status || 'with_customer';

    res.json(await db.insert('Rental_Items', data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/rental-items/:id
router.put('/items/:itemId', requireAuth, requirePermission('update'), async (req, res) => {
  try { res.json(await db.update('Rental_Items', 'item_id', req.params.itemId, req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== Service Items ====================

router.get('/:id/services', requireAuth, async (req, res) => {
  try { res.json((await db.getFiltered('Service_Items', { rental_id: req.params.id })).filter(s => !s.is_deleted)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/services', requireAuth, requirePermission('create'), async (req, res) => {
  try {
    const data = req.body;
    data.service_item_id = await generateNextId('Service_Items', 'service_item_id', 'SI');
    data.rental_id = req.params.id;
    data.line_total = (parseFloat(data.unit_price) || 0) * (parseInt(data.quantity) || 1);
    data.is_deleted = false;
    const result = await db.insert('Service_Items', data);
    if (data.rental_id) await logic.recalculateAndUpdateRental(data.rental_id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== Addendums ====================

router.get('/:id/addendums', requireAuth, async (req, res) => {
  try { res.json((await db.getFiltered('Rental_Addendums', { rental_id: req.params.id })).filter(a => !a.is_deleted)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/addendums', requireAuth, requirePermission('create'), async (req, res) => {
  try {
    const data = req.body;
    data.rental_id = req.params.id;

    const existingAddendums = (await db.getFiltered('Rental_Addendums', { rental_id: req.params.id })).filter(a => !a.is_deleted);
    data.addendum_id = req.params.id + '-A' + (existingAddendums.length + 1);
    data.signed = false;
    data.created_at = new Date();
    data.is_deleted = false;

    if (data.addendum_type === 'extension' && data.new_end_date) {
      const rental = (await db.getFiltered('Rentals', { rental_id: req.params.id }))[0];
      if (rental) {
        data.original_end_date = rental.rental_end;
        await db.update('Rentals', 'rental_id', req.params.id, { rental_end: data.new_end_date, updated_at: new Date() });
      }
    }

    res.json(await db.insert('Rental_Addendums', data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
