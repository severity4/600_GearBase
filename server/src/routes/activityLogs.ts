import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requirePermission } from '../middleware/auth';

export const activityLogsRouter = Router();
activityLogsRouter.use(authenticate);

activityLogsRouter.get('/', requirePermission('manage_staff'), async (req, res, next) => {
  try {
    const { staff_id, target_type, limit: limitStr } = req.query;
    const where: any = {};
    if (staff_id) where.staff_id = staff_id as string;
    if (target_type) where.target_type = target_type as string;
    const limit = Math.min(Number(limitStr) || 50, 200);

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
    });
    res.json(logs);
  } catch (e) { next(e); }
});

// Error logs
activityLogsRouter.get('/errors', requirePermission('*'), async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const errors = await prisma.errorLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    res.json(errors);
  } catch (e) { next(e); }
});

activityLogsRouter.delete('/errors', requirePermission('*'), async (req, res, next) => {
  try {
    const keep = Number(req.query.keep) || 200;
    const total = await prisma.errorLog.count();
    if (total <= keep) return res.json({ cleared: 0 });

    const toKeep = await prisma.errorLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: keep,
      select: { error_id: true },
    });
    const keepIds = toKeep.map(e => e.error_id);

    const deleted = await prisma.errorLog.deleteMany({
      where: { error_id: { notIn: keepIds } },
    });
    res.json({ cleared: deleted.count, remaining: keep });
  } catch (e) { next(e); }
});
