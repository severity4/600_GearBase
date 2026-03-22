import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';

export const maintenanceLogsRouter = Router();
maintenanceLogsRouter.use(authenticate);

maintenanceLogsRouter.get('/', async (req, res, next) => {
  try {
    const { unit_id } = req.query;
    const where: any = { is_deleted: false };
    if (unit_id) where.unit_id = unit_id as string;
    const logs = await prisma.maintenanceLog.findMany({ where, orderBy: { created_at: 'desc' } });
    res.json(logs);
  } catch (e) { next(e); }
});

maintenanceLogsRouter.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const logId = await generateNextId('maintenanceLog', 'log_id', 'ML');
    const log = await prisma.maintenanceLog.create({
      data: { log_id: logId, ...req.body, start_date: new Date(req.body.start_date) },
    });
    res.status(201).json(log);
  } catch (e) { next(e); }
});
