import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const staffRouter = Router();
staffRouter.use(authenticate);

staffRouter.get('/', async (_req, res, next) => {
  try {
    const staff = await prisma.staff.findMany({ where: { is_deleted: false, active: true } });
    res.json(staff);
  } catch (e) { next(e); }
});

staffRouter.post('/', requirePermission('manage_staff'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.name) throw new AppError('姓名必填');
    if (!data.email) throw new AppError('Email 必填');
    const staffId = await generateNextId('staff', 'staff_id', 'S');
    const staff = await prisma.staff.create({
      data: {
        staff_id: staffId,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        role: data.role || 'staff',
        can_approve_discount: data.can_approve_discount || false,
        active: true,
      },
    });
    res.status(201).json(staff);
  } catch (e) { next(e); }
});

staffRouter.put('/:id', requirePermission('manage_staff'), async (req, res, next) => {
  try {
    const staff = await prisma.staff.update({
      where: { staff_id: req.params.id },
      data: req.body,
    });
    res.json(staff);
  } catch (e) { next(e); }
});

staffRouter.delete('/:id', requirePermission('manage_staff'), async (req, res, next) => {
  try {
    await prisma.staff.update({
      where: { staff_id: req.params.id },
      data: { is_deleted: true, active: false },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
});
