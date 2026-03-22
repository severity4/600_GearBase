import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const customersRouter = Router();
customersRouter.use(authenticate);

customersRouter.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const where: any = { is_deleted: false };
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { company_name: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    const customers = await prisma.customer.findMany({ where, orderBy: { created_at: 'desc' } });
    res.json(customers);
  } catch (e) { next(e); }
});

customersRouter.get('/:id', async (req, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { customer_id: req.params.id, is_deleted: false },
      include: { rentals: { where: { is_deleted: false } }, venue_bookings: { where: { is_deleted: false } } },
    });
    if (!customer) throw new AppError('找不到客戶', 404);
    res.json(customer);
  } catch (e) { next(e); }
});

customersRouter.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.name && !data.company_name) throw new AppError('租借人姓名必填');
    if (!data.phone) throw new AppError('電話必填');
    if (!data.email) throw new AppError('電子郵件必填');

    const customerId = await generateNextId('customer', 'customer_id', 'CU');
    const customer = await prisma.customer.create({
      data: {
        customer_id: customerId,
        name: data.name || data.company_name,
        phone: data.phone,
        email: data.email || null,
        id_number: data.id_number || null,
        company_name: data.company_name || null,
        blacklisted: false,
        id_doc_return_status: 'na',
      },
    });
    res.status(201).json(customer);
  } catch (e) { next(e); }
});

customersRouter.put('/:id', requirePermission('update'), async (req, res, next) => {
  try {
    const customer = await prisma.customer.update({
      where: { customer_id: req.params.id },
      data: req.body,
    });
    res.json(customer);
  } catch (e) { next(e); }
});

customersRouter.delete('/:id', requirePermission('delete'), async (req, res, next) => {
  try {
    await prisma.customer.update({
      where: { customer_id: req.params.id },
      data: { is_deleted: true },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
});
