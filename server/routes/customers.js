const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { generateNextId } = require('../services/id-generator');

router.get('/', requireAuth, async (req, res) => {
  try { res.json(await db.getFiltered('Customers', req.query)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, requirePermission('create'), async (req, res) => {
  try {
    const data = req.body;
    if (!data.name && !data.company_name) return res.status(400).json({ error: '租借人姓名必填' });
    if (!data.phone) return res.status(400).json({ error: '電話必填' });
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return res.status(400).json({ error: '電子郵件必填且格式正確' });

    data.name = data.name || data.company_name;
    data.customer_id = await generateNextId('Customers', 'customer_id', 'CU');
    data.created_at = new Date();
    data.is_deleted = false;
    data.blacklisted = data.blacklisted || false;
    data.id_doc_verified = data.id_doc_verified || false;
    data.id_doc_return_status = data.id_doc_return_status || 'na';

    res.json(await db.insert('Customers', data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireAuth, requirePermission('update'), async (req, res) => {
  try { res.json(await db.update('Customers', 'customer_id', req.params.id, req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAuth, requirePermission('delete'), async (req, res) => {
  try {
    await db.softDelete('Customers', 'customer_id', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
