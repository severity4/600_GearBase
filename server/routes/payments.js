const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { generateNextId } = require('../services/id-generator');

router.get('/', requireAuth, async (req, res) => {
  try { res.json(await db.getFiltered('Payments', req.query)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, requirePermission('create_payment'), async (req, res) => {
  try {
    const data = req.body;
    const hasRental = data.rental_id && data.rental_id.trim() !== '';
    const hasBooking = data.booking_id && data.booking_id.trim() !== '';
    if (!hasRental && !hasBooking) return res.status(400).json({ error: '租借單或場地預約必填' });
    if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) === 0) return res.status(400).json({ error: '金額必填且不可為零' });
    if (!data.payment_method) return res.status(400).json({ error: '付款方式必填' });
    if (!data.payment_type) return res.status(400).json({ error: '付款類型必填' });

    data.payment_id = await generateNextId('Payments', 'payment_id', 'PAY');
    data.payment_date = data.payment_date || new Date();
    data.is_deleted = false;
    data.received_by = data.received_by || req.user.staff_id;
    data.receive_channel = data.receive_channel || 'company_direct';
    data.relay_status = data.receive_channel === 'staff_relay' ? 'pending' : 'na';

    // Update rental paid amount
    if (hasRental) {
      const rental = (await db.getFiltered('Rentals', { rental_id: data.rental_id }))[0];
      if (rental) {
        const newPaid = (parseFloat(rental.paid_amount) || 0) + parseFloat(data.amount);
        await db.update('Rentals', 'rental_id', data.rental_id, { paid_amount: newPaid, updated_at: new Date() });
      }
    }
    if (hasBooking) {
      const booking = (await db.getFiltered('Venue_Bookings', { booking_id: data.booking_id }))[0];
      if (booking) {
        const newPaid = (parseFloat(booking.paid_amount) || 0) + parseFloat(data.amount);
        await db.update('Venue_Bookings', 'booking_id', data.booking_id, { paid_amount: newPaid, updated_at: new Date() });
      }
    }

    res.json(await db.insert('Payments', data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
