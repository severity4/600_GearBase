import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';
import { recalculateAndUpdateRental } from '../services/rentalService';
import { roundMoney } from '../utils/helpers';

export const serviceItemsRouter = Router();
serviceItemsRouter.use(authenticate);

serviceItemsRouter.get('/', async (req, res, next) => {
  try {
    const { rental_id, booking_id } = req.query;
    const where: any = { is_deleted: false };
    if (rental_id) where.rental_id = rental_id as string;
    if (booking_id) where.booking_id = booking_id as string;
    const items = await prisma.serviceItem.findMany({ where });
    res.json(items);
  } catch (e) { next(e); }
});

serviceItemsRouter.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const data = req.body;
    const unitPrice = Number(data.unit_price) || 0;
    const qty = Number(data.quantity) || 1;
    const lineTotal = roundMoney(unitPrice * qty);

    const itemId = await generateNextId('serviceItem', 'service_item_id', 'SI');
    const item = await prisma.serviceItem.create({
      data: {
        service_item_id: itemId,
        rental_id: data.rental_id || null,
        booking_id: data.booking_id || null,
        service_type: data.service_type,
        description: data.description,
        quantity: qty,
        unit: data.unit || '次',
        unit_price: unitPrice,
        line_total: lineTotal,
        performed_by: data.performed_by || null,
        service_date: data.service_date ? new Date(data.service_date) : null,
        service_address: data.service_address || null,
        notes: data.notes || null,
      },
    });

    // Recalculate rental total
    if (data.rental_id) {
      await recalculateAndUpdateRental(data.rental_id);
    }

    res.status(201).json(item);
  } catch (e) { next(e); }
});

serviceItemsRouter.put('/:id', requirePermission('update'), async (req, res, next) => {
  try {
    const updates = req.body;
    if (updates.unit_price !== undefined && updates.quantity !== undefined) {
      updates.line_total = roundMoney(Number(updates.unit_price) * Number(updates.quantity));
    }
    const item = await prisma.serviceItem.update({
      where: { service_item_id: req.params.id },
      data: updates,
    });
    res.json(item);
  } catch (e) { next(e); }
});

serviceItemsRouter.delete('/:id', requirePermission('delete'), async (req, res, next) => {
  try {
    await prisma.serviceItem.update({
      where: { service_item_id: req.params.id },
      data: { is_deleted: true },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
});
