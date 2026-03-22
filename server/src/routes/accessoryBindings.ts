import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';

export const accessoryBindingsRouter = Router();
accessoryBindingsRouter.use(authenticate);

accessoryBindingsRouter.get('/', async (req, res, next) => {
  try {
    const { parent_type_id } = req.query;
    const where: any = { is_deleted: false };
    if (parent_type_id) where.parent_type_id = parent_type_id as string;
    const bindings = await prisma.accessoryBinding.findMany({
      where,
      include: { parent_type: true, accessory_type: true },
    });
    res.json(bindings);
  } catch (e) { next(e); }
});

accessoryBindingsRouter.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const bindingId = await generateNextId('accessoryBinding', 'binding_id', 'AB');
    const binding = await prisma.accessoryBinding.create({
      data: { binding_id: bindingId, ...req.body },
    });
    res.status(201).json(binding);
  } catch (e) { next(e); }
});
