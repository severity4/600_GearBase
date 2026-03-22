import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateNextId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const paymentsRouter = Router();
paymentsRouter.use(authenticate);

paymentsRouter.get('/', async (req, res, next) => {
  try {
    const { rental_id, booking_id } = req.query;
    const where: any = { is_deleted: false };
    if (rental_id) where.rental_id = rental_id as string;
    if (booking_id) where.booking_id = booking_id as string;
    const payments = await prisma.payment.findMany({ where, orderBy: { payment_date: 'desc' } });
    res.json(payments);
  } catch (e) { next(e); }
});

paymentsRouter.post('/', requirePermission('create_payment'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.rental_id && !data.booking_id) throw new AppError('租借單或場地預約必填');
    if (!data.amount || isNaN(Number(data.amount))) throw new AppError('金額必填且為數字');
    if (Number(data.amount) === 0) throw new AppError('金額不可為零');
    if (!data.payment_method) throw new AppError('付款方式必填');
    if (!data.payment_type) throw new AppError('付款類型必填');

    const paymentId = await generateNextId('payment', 'payment_id', 'PAY');
    const payment = await prisma.payment.create({
      data: {
        payment_id: paymentId,
        rental_id: data.rental_id || null,
        booking_id: data.booking_id || null,
        payment_type: data.payment_type,
        amount: data.amount,
        payment_method: data.payment_method,
        payer_account_last5: data.payer_account_last5 || null,
        receive_channel: data.receive_channel || 'company_direct',
        received_by: data.received_by || req.user?.staff_id || '',
        relay_status: data.receive_channel === 'staff_relay' ? 'pending' : 'na',
        payment_date: data.payment_date ? new Date(data.payment_date) : new Date(),
        notes: data.notes || null,
      },
    });

    // Update rental/booking paid amount
    if (data.rental_id) {
      const rental = await prisma.rental.findFirst({ where: { rental_id: data.rental_id } });
      if (rental) {
        await prisma.rental.update({
          where: { rental_id: data.rental_id },
          data: { paid_amount: Number(rental.paid_amount || 0) + Number(data.amount) },
        });
      }
    }
    if (data.booking_id) {
      const booking = await prisma.venueBooking.findFirst({ where: { booking_id: data.booking_id } });
      if (booking) {
        await prisma.venueBooking.update({
          where: { booking_id: data.booking_id },
          data: { paid_amount: Number(booking.paid_amount || 0) + Number(data.amount) },
        });
      }
    }

    res.status(201).json(payment);
  } catch (e) { next(e); }
});
