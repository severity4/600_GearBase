import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateYearBasedId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  checkVenueAvailability,
  calculateVenueBookingBreakdown,
  advanceVenueBookingStatus,
} from '../services/venueService';
import { roundMoney } from '../utils/helpers';

export const venueBookingsRouter = Router();
venueBookingsRouter.use(authenticate);

venueBookingsRouter.get('/', async (req, res, next) => {
  try {
    const { venue_id, status, customer_id } = req.query;
    const where: any = { is_deleted: false };
    if (venue_id) where.venue_id = venue_id as string;
    if (status) where.status = status as string;
    if (customer_id) where.customer_id = customer_id as string;
    const bookings = await prisma.venueBooking.findMany({
      where,
      include: { venue: true, customer: true },
      orderBy: { booking_start: 'desc' },
    });
    res.json(bookings);
  } catch (e) { next(e); }
});

venueBookingsRouter.get('/:id', async (req, res, next) => {
  try {
    const booking = await prisma.venueBooking.findFirst({
      where: { booking_id: req.params.id, is_deleted: false },
      include: { venue: true, customer: true, payments: true, service_items: true },
    });
    if (!booking) throw new AppError('找不到場地預約', 404);
    res.json(booking);
  } catch (e) { next(e); }
});

venueBookingsRouter.post('/', requirePermission('create_rental'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.venue_id) throw new AppError('場地必填');
    if (!data.customer_id) throw new AppError('客戶必填');
    if (!data.booking_start || !data.booking_end) throw new AppError('預約時間必填');
    if (!data.rate_type) throw new AppError('計費方式必填');

    // Blacklist check
    const customer = await prisma.customer.findFirst({
      where: { customer_id: data.customer_id, is_deleted: false },
    });
    if (customer?.blacklisted) {
      throw new AppError(`此客戶已列入黑名單${customer.blacklist_reason ? `（原因：${customer.blacklist_reason}）` : ''}`);
    }

    // Availability check
    const available = await checkVenueAvailability(data.venue_id, data.booking_start, data.booking_end);
    if (!available) throw new AppError('該時段場地已被預約');

    // Snapshot rate from venue
    let unitRate = data.unit_rate;
    if (!unitRate) {
      const venue = await prisma.venue.findFirst({ where: { venue_id: data.venue_id } });
      if (venue) {
        if (data.rate_type === 'hourly') unitRate = Number(venue.hourly_rate);
        else if (data.rate_type === 'half_day') unitRate = Number(venue.half_day_rate || venue.hourly_rate) * (venue.half_day_rate ? 1 : 4);
        else if (data.rate_type === 'daily') unitRate = Number(venue.daily_rate || venue.hourly_rate) * (venue.daily_rate ? 1 : 8);
        else unitRate = Number(venue.hourly_rate);
      }
    }
    unitRate = unitRate || 0;
    const rateQty = data.rate_quantity || 1;
    const subtotal = roundMoney(unitRate * rateQty);
    const discountAmount = Number(data.discount_amount || 0);
    const taxRate = data.tax_rate || 0.05;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = roundMoney(taxableAmount * taxRate);

    const bookingId = await generateYearBasedId('venueBooking', 'booking_id', 'VB');
    const booking = await prisma.venueBooking.create({
      data: {
        booking_id: bookingId,
        venue_id: data.venue_id,
        customer_id: data.customer_id,
        rental_id: data.rental_id || null,
        booking_start: new Date(data.booking_start),
        booking_end: new Date(data.booking_end),
        rate_type: data.rate_type,
        unit_rate: unitRate,
        rate_quantity: rateQty,
        subtotal,
        discount_amount: discountAmount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: taxableAmount + taxAmount,
        deposit_amount: data.deposit_amount || null,
        deposit_status: 'pending',
        attendee_count: data.attendee_count || null,
        use_purpose: data.use_purpose || null,
        setup_required: data.setup_required || false,
        cleanup_included: data.cleanup_included || false,
        invoice_required: data.invoice_required || false,
        invoice_status: data.invoice_required ? 'pending' : 'not_required',
        status: 'draft',
        prepared_by: req.user?.staff_id || null,
        handled_by: data.handled_by || req.user?.staff_id || null,
        notes: data.notes || null,
      },
    });
    res.status(201).json(booking);
  } catch (e) { next(e); }
});

venueBookingsRouter.put('/:id', requirePermission('update'), async (req, res, next) => {
  try {
    const booking = await prisma.venueBooking.update({
      where: { booking_id: req.params.id },
      data: req.body,
    });
    res.json(booking);
  } catch (e) { next(e); }
});

venueBookingsRouter.delete('/:id', requirePermission('delete'), async (req, res, next) => {
  try {
    await prisma.venueBooking.update({
      where: { booking_id: req.params.id },
      data: { is_deleted: true },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
});

venueBookingsRouter.get('/:id/breakdown', async (req, res, next) => {
  try {
    const breakdown = await calculateVenueBookingBreakdown(req.params.id);
    res.json(breakdown);
  } catch (e) { next(e); }
});

venueBookingsRouter.post('/:id/advance-status', requirePermission('update'), async (req, res, next) => {
  try {
    const { status, ...metadata } = req.body;
    if (!status) throw new AppError('新狀態必填');
    const booking = await advanceVenueBookingStatus(req.params.id, status, metadata);
    res.json(booking);
  } catch (e) { next(e); }
});

venueBookingsRouter.get('/:id/receipt', async (req, res, next) => {
  try {
    const booking = await prisma.venueBooking.findFirst({
      where: { booking_id: req.params.id, is_deleted: false },
      include: { venue: true, customer: true },
    });
    if (!booking) throw new AppError('找不到預約', 404);
    const payments = await prisma.payment.findMany({
      where: { booking_id: req.params.id, is_deleted: false },
    });
    res.json({
      booking_id: booking.booking_id,
      venue: { name: booking.venue?.name || '', type: booking.venue?.venue_type || '', address: booking.venue?.address || '' },
      customer: { name: booking.customer?.name || '', company: booking.customer?.company_name || '', phone: booking.customer?.phone || '', email: booking.customer?.email || '' },
      booking_start: booking.booking_start,
      booking_end: booking.booking_end,
      rate_type: booking.rate_type,
      total_amount: Number(booking.total_amount || 0),
      paid_amount: Number(booking.paid_amount || 0),
      status: booking.status,
      payments: payments.map(p => ({ payment_id: p.payment_id, amount: Number(p.amount), method: p.payment_method, date: p.payment_date })),
      generated_at: new Date().toISOString(),
    });
  } catch (e) { next(e); }
});
