import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId, generateInternalCode } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const equipmentUnitsRouter = Router();
equipmentUnitsRouter.use(authenticate);

equipmentUnitsRouter.get('/', async (req, res, next) => {
  try {
    const { type_id, status, location_id } = req.query;
    const where: any = { is_deleted: false };
    if (type_id) where.type_id = type_id as string;
    if (status) where.status = status as string;
    if (location_id) where.location_id = location_id as string;

    const units = await prisma.equipmentUnit.findMany({
      where,
      include: { equipment_type: true, storage_location: true },
    });
    res.json(units);
  } catch (e) { next(e); }
});

equipmentUnitsRouter.get('/:id', async (req, res, next) => {
  try {
    const unit = await prisma.equipmentUnit.findFirst({
      where: { unit_id: req.params.id, is_deleted: false },
      include: { equipment_type: true, storage_location: true, maintenance_logs: true },
    });
    if (!unit) throw new AppError('找不到器材個體', 404);
    res.json(unit);
  } catch (e) { next(e); }
});

equipmentUnitsRouter.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.type_id) throw new AppError('器材類型必填');

    const category = data.category || 'accessory';
    const unitId = await generateNextId('equipmentUnit', 'unit_id', 'EU');
    const internalCode = await generateInternalCode(category);

    const unit = await prisma.equipmentUnit.create({
      data: {
        unit_id: unitId,
        type_id: data.type_id,
        serial_number: data.serial_number || null,
        internal_code: internalCode,
        purchase_date: data.purchase_date ? new Date(data.purchase_date) : null,
        purchase_cost: data.purchase_cost || null,
        current_condition: data.current_condition || 'good',
        location_id: data.location_id || null,
        batch_quantity: data.batch_quantity || null,
        status: 'available',
        notes: data.notes || null,
        created_by: req.user?.staff_id || '',
        category: category,
      },
    });
    res.status(201).json(unit);
  } catch (e) { next(e); }
});

equipmentUnitsRouter.put('/:id', requirePermission('update'), async (req, res, next) => {
  try {
    const unit = await prisma.equipmentUnit.update({
      where: { unit_id: req.params.id },
      data: req.body,
    });
    res.json(unit);
  } catch (e) { next(e); }
});

equipmentUnitsRouter.delete('/:id', requirePermission('delete'), async (req, res, next) => {
  try {
    await prisma.equipmentUnit.update({
      where: { unit_id: req.params.id },
      data: { is_deleted: true },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
});
