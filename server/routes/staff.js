const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requirePermission, ROLE_PERMISSIONS, hashPassword } = require('../middleware/auth');
const { generateNextId } = require('../services/id-generator');

router.get('/', requireAuth, async (req, res) => {
  try {
    const staff = await db.getFiltered('Staff', req.query);
    // Strip password_hash from response
    res.json(staff.map(s => { const { password_hash, ...rest } = s; return rest; }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, requirePermission('manage_staff'), async (req, res) => {
  try {
    const data = req.body;
    data.staff_id = await generateNextId('Staff', 'staff_id', 'S');
    data.created_at = new Date();
    data.is_deleted = false;
    if (data.password) {
      data.password_hash = await hashPassword(data.password);
      delete data.password;
    }
    const result = await db.insert('Staff', data);
    const { password_hash, ...safe } = result;
    res.json(safe);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireAuth, requirePermission('manage_staff'), async (req, res) => {
  try {
    const data = req.body;
    if (data.password) {
      data.password_hash = await hashPassword(data.password);
      delete data.password;
    }
    const result = await db.update('Staff', 'staff_id', req.params.id, data);
    const { password_hash, ...safe } = result;
    res.json(safe);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAuth, requirePermission('manage_staff'), async (req, res) => {
  try {
    await db.update('Staff', 'staff_id', req.params.id, { is_deleted: true, active: false });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/roles', requireAuth, requirePermission('manage_staff'), (req, res) => {
  res.json({
    roles: ROLE_PERMISSIONS,
    labels: { admin: '管理員', manager: '經理', staff: '員工', viewer: '僅檢視' },
    permissionLabels: {
      '*': '完整權限', read: '查看資料', create: '新增資料', update: '編輯資料',
      delete: '刪除資料', approve_discount: '核准折扣', approve_credit_note: '核准折讓單',
      approve_cancellation: '核准取消', manage_staff: '管理員工', manage_rules: '管理規則',
      run_reports: '執行報表', process_check_in: '處理取件', process_check_out: '處理還件',
      create_rental: '建立租借單', create_payment: '收款',
    },
  });
});

module.exports = router;
