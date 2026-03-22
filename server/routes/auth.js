const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateToken, hashPassword, verifyPassword, requireAuth, ROLE_PERMISSIONS } = require('../middleware/auth');
const { generateNextId } = require('../services/id-generator');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email 和密碼必填' });

    const staff = (await db.getAll('Staff')).find(
      s => s.email && s.email.toLowerCase() === email.toLowerCase() && s.active !== false
    );
    if (!staff) return res.status(401).json({ error: '帳號或密碼不正確' });

    if (!staff.password_hash) {
      return res.status(401).json({ error: '此帳號尚未設定密碼，請聯繫管理員' });
    }

    const valid = await verifyPassword(password, staff.password_hash);
    if (!valid) return res.status(401).json({ error: '帳號或密碼不正確' });

    const token = generateToken(staff);
    res.json({
      token,
      user: {
        staff_id: staff.staff_id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        permissions: ROLE_PERMISSIONS[staff.role] || ROLE_PERMISSIONS.viewer,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/bootstrap - Create first admin (only if no staff exist)
router.post('/bootstrap', async (req, res) => {
  try {
    const allStaff = await db.getAll('Staff', { includeDeleted: true });
    if (allStaff.length > 0) {
      return res.status(400).json({ error: '系統已有員工資料，無法使用此功能' });
    }

    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email 和密碼必填' });

    const staffId = await generateNextId('Staff', 'staff_id', 'S');
    const passwordHash = await hashPassword(password);

    const staff = await db.insert('Staff', {
      staff_id: staffId,
      name: name || email.split('@')[0],
      email,
      password_hash: passwordHash,
      role: 'admin',
      can_approve_discount: true,
      active: true,
      created_at: new Date(),
      is_deleted: false,
    });

    const token = generateToken(staff);
    res.json({
      success: true,
      message: `已建立管理員帳號：${email}`,
      token,
      user: { staff_id: staff.staff_id, name: staff.name, email: staff.email, role: 'admin' },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({
    authenticated: true,
    staff_id: req.user.staff_id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    permissions: ROLE_PERMISSIONS[req.user.role] || ROLE_PERMISSIONS.viewer,
  });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: '新密碼必填' });

    const staff = (await db.getFiltered('Staff', { staff_id: req.user.staff_id }))[0];
    if (!staff) return res.status(404).json({ error: '找不到使用者' });

    if (staff.password_hash && current_password) {
      const valid = await verifyPassword(current_password, staff.password_hash);
      if (!valid) return res.status(401).json({ error: '目前密碼不正確' });
    }

    const passwordHash = await hashPassword(new_password);
    await db.update('Staff', 'staff_id', req.user.staff_id, { password_hash: passwordHash });
    res.json({ success: true, message: '密碼已更新' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
