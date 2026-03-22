import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';
import { processEquipmentCheckIn } from '../services/checkInService';

export const inventoryLogsRouter = Router();
inventoryLogsRouter.use(authenticate);

inventoryLogsRouter.get('/', async (req, res, next) => {
  try {
    const { unit_id, rental_id } = req.query;
    const where: any = { is_deleted: false };
    if (unit_id) where.unit_id = unit_id as string;
    if (rental_id) where.rental_id = rental_id as string;
    const logs = await prisma.inventoryLog.findMany({ where, orderBy: { log_date: 'desc' } });
    res.json(logs);
  } catch (e) { next(e); }
});

inventoryLogsRouter.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const logId = await generateNextId('inventoryLog', 'log_id', 'IL');
    const log = await prisma.inventoryLog.create({
      data: { log_id: logId, ...req.body, log_date: new Date(req.body.log_date || new Date()) },
    });
    res.status(201).json(log);
  } catch (e) { next(e); }
});

// Equipment check-in endpoint
inventoryLogsRouter.post('/check-in', requirePermission('process_check_in'), async (req, res, next) => {
  try {
    const result = await processEquipmentCheckIn({
      ...req.body,
      performed_by: req.body.performed_by || req.user?.staff_id || '',
    });
    res.json(result);
  } catch (e) { next(e); }
});
