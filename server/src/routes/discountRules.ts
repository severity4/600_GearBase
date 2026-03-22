import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';

export const discountRulesRouter = Router();
discountRulesRouter.use(authenticate);

discountRulesRouter.get('/', async (_req, res, next) => {
  try {
    const rules = await prisma.discountRule.findMany({ where: { is_deleted: false, active: true } });
    res.json(rules);
  } catch (e) { next(e); }
});

discountRulesRouter.post('/', requirePermission('manage_rules'), async (req, res, next) => {
  try {
    const ruleId = await generateNextId('discountRule', 'rule_id', 'DR');
    const rule = await prisma.discountRule.create({
      data: { rule_id: ruleId, active: true, ...req.body },
    });
    res.status(201).json(rule);
  } catch (e) { next(e); }
});
