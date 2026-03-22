import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requirePermission } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const rentalAddendumsRouter = Router();
rentalAddendumsRouter.use(authenticate);

rentalAddendumsRouter.get('/', async (req, res, next) => {
  try {
    const { rental_id } = req.query;
    const where: any = { is_deleted: false };
    if (rental_id) where.rental_id = rental_id as string;
    const addendums = await prisma.rentalAddendum.findMany({ where, orderBy: { created_at: 'desc' } });
    res.json(addendums);
  } catch (e) { next(e); }
});

rentalAddendumsRouter.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.rental_id) throw new AppError('租借單 ID 必填');

    const rental = await prisma.rental.findFirst({
      where: { rental_id: data.rental_id, is_deleted: false },
    });
    if (!rental) throw new AppError('找不到租借單: ' + data.rental_id, 404);

    // Generate addendum ID: RENT-YYYY-NNN-A1
    const existingCount = await prisma.rentalAddendum.count({
      where: { rental_id: data.rental_id, is_deleted: false },
    });
    const addendumId = `${data.rental_id}-A${existingCount + 1}`;

    const addendum = await prisma.rentalAddendum.create({
      data: {
        addendum_id: addendumId,
        rental_id: data.rental_id,
        addendum_type: data.addendum_type,
        description: data.description,
        original_end_date: data.addendum_type === 'extension' ? rental.rental_end : null,
        new_end_date: data.new_end_date ? new Date(data.new_end_date) : null,
        additional_amount: data.additional_amount || null,
        created_by: req.user?.staff_id || '',
        signed: false,
      },
    });

    // If extension, update rental end date
    if (data.addendum_type === 'extension' && data.new_end_date) {
      await prisma.rental.update({
        where: { rental_id: data.rental_id },
        data: { rental_end: new Date(data.new_end_date) },
      });
    }

    res.status(201).json(addendum);
  } catch (e) { next(e); }
});
