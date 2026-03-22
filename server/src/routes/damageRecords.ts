import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';

export const damageRecordsRouter = Router();
damageRecordsRouter.use(authenticate);

damageRecordsRouter.get('/', async (req, res, next) => {
  try {
    const { rental_id, unit_id } = req.query;
    const where: any = { is_deleted: false };
    if (rental_id) where.rental_id = rental_id as string;
    if (unit_id) where.unit_id = unit_id as string;
    const records = await prisma.damageRecord.findMany({ where, orderBy: { created_at: 'desc' } });
    res.json(records);
  } catch (e) { next(e); }
});

damageRecordsRouter.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const damageId = await generateNextId('damageRecord', 'damage_id', 'DM');
    const record = await prisma.damageRecord.create({
      data: { damage_id: damageId, ...req.body },
    });
    res.status(201).json(record);
  } catch (e) { next(e); }
});
