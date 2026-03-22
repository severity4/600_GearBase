import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { signToken, getRolePermissions } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Simple email-based login (no password for now, matches GAS model)
 */
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError('Email 必填');

    const staff = await prisma.staff.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        is_deleted: false,
        active: true,
      },
    });
    if (!staff) throw new AppError('找不到此 Email 的員工帳號', 401);

    const token = signToken({
      staff_id: staff.staff_id,
      email: staff.email,
      role: staff.role,
    });

    res.json({
      token,
      user: {
        staff_id: staff.staff_id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        can_approve_discount: staff.can_approve_discount,
      },
    });
  } catch (e) { next(e); }
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', async (req, res, next) => {
  try {
    if (!req.user?.staff_id) {
      return res.json({ authenticated: false, role: 'viewer', permissions: ['read'] });
    }
    const staff = await prisma.staff.findFirst({
      where: { staff_id: req.user.staff_id, is_deleted: false },
    });
    if (!staff) {
      return res.json({ authenticated: false, role: 'viewer', permissions: ['read'] });
    }
    const { roles } = getRolePermissions();
    res.json({
      authenticated: true,
      staff_id: staff.staff_id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      can_approve_discount: staff.can_approve_discount,
      permissions: roles[staff.role] || roles.viewer,
    });
  } catch (e) { next(e); }
});

/**
 * GET /api/auth/roles
 */
authRouter.get('/roles', (_req, res) => {
  res.json(getRolePermissions());
});

/**
 * POST /api/auth/bootstrap
 * Create first admin when no staff exist
 */
authRouter.post('/bootstrap', async (req, res, next) => {
  try {
    const count = await prisma.staff.count();
    if (count > 0) throw new AppError('系統已有員工資料，無法使用此功能');

    const { email, name } = req.body;
    if (!email) throw new AppError('Email 必填');

    const { generateNextId } = await import('../utils/idGenerator');
    const staffId = await generateNextId('staff', 'staff_id', 'S');
    const staff = await prisma.staff.create({
      data: {
        staff_id: staffId,
        name: name || email.split('@')[0],
        email,
        role: 'admin',
        can_approve_discount: true,
        active: true,
      },
    });

    const token = signToken({ staff_id: staff.staff_id, email: staff.email, role: 'admin' });
    res.status(201).json({ success: true, message: `已建立管理員帳號：${email}`, staff, token });
  } catch (e) { next(e); }
});
