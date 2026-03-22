import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { calculateRentalDays, roundMoney } from '../utils/helpers';

export const rentalItemsRouter = Router();
rentalItemsRouter.use(authenticate);

rentalItemsRouter.get('/', async (req, res, next) => {
  try {
    const { rental_id } = req.query;
    const where: any = { is_deleted: false };
    if (rental_id) where.rental_id = rental_id as string;
    const items = await prisma.rentalItem.findMany({
      where,
      include: { equipment_type: true, equipment_unit: true },
    });
    res.json(items);
  } catch (e) { next(e); }
});

rentalItemsRouter.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.rental_id) throw new AppError('租借單 ID 必填');
    if (!data.type_id) throw new AppError('器材類型必填');

    // Snapshot rates from equipment type
    const type = await prisma.equipmentType.findFirst({
      where: { type_id: data.type_id },
    });
    const dailyRate = data.daily_rate_snapshot || (type ? Number(type.daily_rate) : 0);
    const replacementValue = data.replacement_value_snapshot || (type ? Number(type.replacement_value) : 0);

    // Calculate days from rental if not provided
    let days = data.days;
    if (!days) {
      const rental = await prisma.rental.findFirst({
        where: { rental_id: data.rental_id },
      });
      if (rental) {
        days = calculateRentalDays(rental.rental_start, rental.rental_end);
      }
    }
    days = days || 1;

    const qty = data.quantity || 1;
    const lineTotal = roundMoney(dailyRate * qty * days);

    const itemId = await generateNextId('rentalItem', 'item_id', 'RI');
    const item = await prisma.rentalItem.create({
      data: {
        item_id: itemId,
        rental_id: data.rental_id,
        type_id: data.type_id,
        unit_id: data.unit_id || null,
        quantity: qty,
        daily_rate_snapshot: dailyRate,
        replacement_value_snapshot: replacementValue,
        days,
        line_total: lineTotal,
        line_total_after_discount: lineTotal,
        return_status: 'with_customer',
        notes: data.notes || null,
      },
    });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

rentalItemsRouter.put('/:id', requirePermission('update'), async (req, res, next) => {
  try {
    const item = await prisma.rentalItem.update({
      where: { item_id: req.params.id },
      data: req.body,
    });
    res.json(item);
  } catch (e) { next(e); }
});
