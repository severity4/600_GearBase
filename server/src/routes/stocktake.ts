import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateYearBasedId, generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';

export const stocktakeRouter = Router();
stocktakeRouter.use(authenticate);

// Plans
stocktakeRouter.get('/plans', async (_req, res, next) => {
  try {
    const plans = await prisma.stocktakePlan.findMany({
      where: { is_deleted: false },
      include: { stocktake_results: true },
      orderBy: { scheduled_date: 'desc' },
    });
    res.json(plans);
  } catch (e) { next(e); }
});

stocktakeRouter.post('/plans', requirePermission('create'), async (req, res, next) => {
  try {
    const planId = await generateYearBasedId('stocktakePlan', 'plan_id', 'SP');
    const plan = await prisma.stocktakePlan.create({
      data: {
        plan_id: planId,
        status: 'scheduled',
        created_by: req.user?.staff_id || '',
        ...req.body,
        scheduled_date: new Date(req.body.scheduled_date),
        deadline: new Date(req.body.deadline),
      },
    });
    res.status(201).json(plan);
  } catch (e) { next(e); }
});

// Results
stocktakeRouter.get('/results', async (req, res, next) => {
  try {
    const { plan_id } = req.query;
    const where: any = { is_deleted: false };
    if (plan_id) where.plan_id = plan_id as string;
    const results = await prisma.stocktakeResult.findMany({ where });
    res.json(results);
  } catch (e) { next(e); }
});

stocktakeRouter.post('/results', requirePermission('create'), async (req, res, next) => {
  try {
    const resultId = await generateNextId('stocktakeResult', 'result_id', 'SR');
    const result = await prisma.stocktakeResult.create({
      data: {
        result_id: resultId,
        counted_at: new Date(),
        ...req.body,
      },
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
});
