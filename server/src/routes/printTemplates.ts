import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';

export const printTemplatesRouter = Router();
printTemplatesRouter.use(authenticate);

printTemplatesRouter.get('/', async (_req, res, next) => {
  try {
    const templates = await prisma.printTemplate.findMany({
      where: { is_deleted: false, active: true },
    });
    res.json(templates);
  } catch (e) { next(e); }
});

printTemplatesRouter.post('/', requirePermission('manage_rules'), async (req, res, next) => {
  try {
    const tplId = await generateNextId('printTemplate', 'template_id', 'TPL');
    const tpl = await prisma.printTemplate.create({
      data: { template_id: tplId, active: true, ...req.body },
    });
    res.status(201).json(tpl);
  } catch (e) { next(e); }
});
