import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';

export const wearToleranceRouter = Router();
wearToleranceRouter.use(authenticate);

wearToleranceRouter.get('/', async (_req, res, next) => {
  try {
    const tolerances = await prisma.wearTolerance.findMany({ where: { is_deleted: false } });
    res.json(tolerances);
  } catch (e) { next(e); }
});

wearToleranceRouter.post('/', requirePermission('manage_rules'), async (req, res, next) => {
  try {
    const tolId = await generateNextId('wearTolerance', 'tolerance_id', 'WT');
    const tol = await prisma.wearTolerance.create({
      data: { tolerance_id: tolId, ...req.body },
    });
    res.status(201).json(tol);
  } catch (e) { next(e); }
});

wearToleranceRouter.put('/:id', requirePermission('manage_rules'), async (req, res, next) => {
  try {
    const tol = await prisma.wearTolerance.update({
      where: { tolerance_id: req.params.id },
      data: req.body,
    });
    res.json(tol);
  } catch (e) { next(e); }
});
