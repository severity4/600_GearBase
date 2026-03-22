/**
 * Customer-facing API routes (public, no auth required)
 * Email verification for rental/booking lookup
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendEmail } = require('../services/email');

// Simple in-memory cache for verification codes (replace with Redis in production)
const verificationCache = new Map();
const rateLimitCache = new Map();

function cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of verificationCache) {
    if (now > entry.expires) verificationCache.delete(key);
  }
  for (const [key, entry] of rateLimitCache) {
    if (now > entry.expires) rateLimitCache.delete(key);
  }
}
setInterval(cleanupCache, 60000);

// POST /api/customer/send-code
router.post('/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || email.trim() === '') return res.status(400).json({ success: false, message: '請輸入 Email' });

    const cleanEmail = email.trim().toLowerCase();

    // Rate limit
    const rateKey = 'rate_' + cleanEmail;
    if (rateLimitCache.has(rateKey)) {
      return res.json({ success: false, message: '請稍後再試，每 60 秒僅能發送一次驗證碼' });
    }

    const successMessage = '若此 Email 已登記，驗證碼將寄送至您的信箱';

    const customers = await db.getAll('Customers');
    const customer = customers.find(c => c.email && c.email.toLowerCase() === cleanEmail);

    rateLimitCache.set(rateKey, { expires: Date.now() + 60000 });

    if (!customer) return res.json({ success: true, message: successMessage });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    verificationCache.set('code_' + cleanEmail, { code, expires: Date.now() + 600000 });

    await sendEmail({
      to: cleanEmail,
      subject: '【映奧創意】查詢驗證碼',
      body: `${customer.name} 您好，\n\n您的查詢驗證碼為：${code}\n\n此驗證碼將在 10 分鐘後失效。\n如非本人操作，請忽略此信。\n\n映奧創意工作室`,
    });

    res.json({ success: true, message: successMessage });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/customer/verify
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.json({ verified: false, message: '請輸入 Email 和驗證碼' });

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // Rate limit attempts
    const attemptKey = 'attempts_' + cleanEmail;
    const attempts = rateLimitCache.get(attemptKey);
    if (attempts && attempts.count >= 5) {
      return res.json({ verified: false, message: '嘗試次數過多，請 10 分鐘後再試' });
    }

    const stored = verificationCache.get('code_' + cleanEmail);
    if (!stored || Date.now() > stored.expires) {
      const count = (attempts?.count || 0) + 1;
      rateLimitCache.set(attemptKey, { count, expires: Date.now() + 600000 });
      return res.json({ verified: false, message: '驗證碼已過期，請重新發送' });
    }

    if (stored.code !== cleanCode) {
      const count = (attempts?.count || 0) + 1;
      rateLimitCache.set(attemptKey, { count, expires: Date.now() + 600000 });
      return res.json({ verified: false, message: '驗證碼不正確' });
    }

    verificationCache.delete('code_' + cleanEmail);

    const customers = await db.getAll('Customers');
    const customer = customers.find(c => c.email && c.email.toLowerCase() === cleanEmail);
    if (!customer) return res.json({ verified: true, found: false, message: '查無客戶紀錄' });

    const [allRentals, rentalItems, types, bookings, venues] = await Promise.all([
      db.getAll('Rentals'), db.getAll('Rental_Items'),
      db.getAll('Equipment_Types'), db.getAll('Venue_Bookings'), db.getAll('Venues'),
    ]);

    const typeMap = {}; types.forEach(t => { typeMap[t.type_id] = t; });
    const venueMap = {}; venues.forEach(v => { venueMap[v.venue_id] = v; });
    const statusLabels = { draft: '草稿', reserved: '已預約', active: '進行中', overdue: '逾期', returned: '已歸還', completed: '已完成', cancelled: '已取消' };

    const custRentals = allRentals
      .filter(r => r.customer_id === customer.customer_id && r.status !== 'cancelled')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20);

    const custBookings = bookings
      .filter(b => b.customer_id === customer.customer_id && b.status !== 'cancelled')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20);

    res.json({
      verified: true, found: true, customer_name: customer.name,
      rentals: custRentals.map(r => {
        const items = rentalItems.filter(ri => ri.rental_id === r.rental_id && !ri.is_deleted);
        return {
          rental_id: r.rental_id, status: r.status, status_label: statusLabels[r.status] || r.status,
          rental_start: r.rental_start, rental_end: r.rental_end,
          total_amount: parseFloat(r.total_amount || 0), paid_amount: parseFloat(r.paid_amount || 0),
          items: items.map(i => ({ type_name: (typeMap[i.type_id] || {}).type_name || i.type_id, line_total: parseFloat(i.line_total || 0) })),
        };
      }),
      bookings: custBookings.map(b => ({
        booking_id: b.booking_id, venue_name: (venueMap[b.venue_id] || {}).name || '',
        status: b.status, status_label: statusLabels[b.status] || b.status,
        booking_start: b.booking_start, booking_end: b.booking_end,
        total_amount: parseFloat(b.total_amount || 0),
      })),
    });
  } catch (err) { res.status(500).json({ verified: false, message: err.message }); }
});

module.exports = router;
