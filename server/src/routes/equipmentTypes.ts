import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const equipmentTypesRouter = Router();
equipmentTypesRouter.use(authenticate);

equipmentTypesRouter.get('/', async (_req, res, next) => {
  try {
    const types = await prisma.equipmentType.findMany({
      where: { is_deleted: false, active: true },
    });
    res.json(types);
  } catch (e) { next(e); }
});

equipmentTypesRouter.get('/:id', async (req, res, next) => {
  try {
    const type = await prisma.equipmentType.findFirst({
      where: { type_id: req.params.id, is_deleted: false },
      include: { units: { where: { is_deleted: false } } },
    });
    if (!type) throw new AppError('找不到器材類型', 404);
    res.json(type);
  } catch (e) { next(e); }
});

equipmentTypesRouter.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.name && !data.type_name) throw new AppError('器材類型名稱必填');
    if (!data.category) throw new AppError('分類必填');
    if (!data.daily_rate || Number(data.daily_rate) < 0) throw new AppError('日租價格必填且為正數');

    const typeId = await generateNextId('equipmentType', 'type_id', 'ET');
    const type = await prisma.equipmentType.create({
      data: {
        type_id: typeId,
        name: data.name || data.type_name,
        category: data.category,
        sub_category: data.sub_category || null,
        model: data.model || null,
        brand: data.brand || null,
        daily_rate: data.daily_rate,
        replacement_value: data.replacement_value || 0,
        deposit_required: data.deposit_required || null,
        is_consumable: data.is_consumable || false,
        is_batch_item: data.is_batch_item || false,
        batch_unit: data.batch_unit || null,
        description: data.description || null,
        image_url: data.image_url || null,
        active: data.active !== undefined ? data.active : true,
        created_by: req.user?.staff_id || '',
      },
    });
    res.status(201).json(type);
  } catch (e) { next(e); }
});

equipmentTypesRouter.put('/:id', requirePermission('update'), async (req, res, next) => {
  try {
    const type = await prisma.equipmentType.update({
      where: { type_id: req.params.id },
      data: req.body,
    });
    res.json(type);
  } catch (e) { next(e); }
});

equipmentTypesRouter.delete('/:id', requirePermission('delete'), async (req, res, next) => {
  try {
    await prisma.equipmentType.update({
      where: { type_id: req.params.id },
      data: { is_deleted: true },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
});
