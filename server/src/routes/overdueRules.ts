import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';

export const overdueRulesRouter = Router();
overdueRulesRouter.use(authenticate);

overdueRulesRouter.get('/', async (_req, res, next) => {
  try {
    const rules = await prisma.overdueRule.findMany({ where: { is_deleted: false, active: true } });
    res.json(rules);
  } catch (e) { next(e); }
});

overdueRulesRouter.post('/', requirePermission('manage_rules'), async (req, res, next) => {
  try {
    const ruleId = await generateNextId('overdueRule', 'overdue_rule_id', 'OR');
    const rule = await prisma.overdueRule.create({
      data: { overdue_rule_id: ruleId, active: true, ...req.body },
    });
    res.status(201).json(rule);
  } catch (e) { next(e); }
});

overdueRulesRouter.put('/:id', requirePermission('manage_rules'), async (req, res, next) => {
  try {
    const rule = await prisma.overdueRule.update({
      where: { overdue_rule_id: req.params.id },
      data: req.body,
    });
    res.json(rule);
  } catch (e) { next(e); }
});
