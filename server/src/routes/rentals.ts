import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { generateYearBasedId } from '../utils/idGenerator';
import { authenticate, requirePermission } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  calculateRentalBreakdown,
  recalculateAndUpdateRental,
  advanceRentalStatus,
  checkAndMarkOverdueRentals,
} from '../services/rentalService';

export const rentalsRouter = Router();
rentalsRouter.use(authenticate);

rentalsRouter.get('/', async (req, res, next) => {
  try {
    const { status, customer_id } = req.query;
    const where: any = { is_deleted: false };
    if (status) where.status = status as string;
    if (customer_id) where.customer_id = customer_id as string;

    const rentals = await prisma.rental.findMany({
      where,
      include: { customer: true, rental_items: { include: { equipment_type: true } } },
      orderBy: { created_at: 'desc' },
    });
    res.json(rentals);
  } catch (e) { next(e); }
});

rentalsRouter.get('/:id', async (req, res, next) => {
  try {
    const rental = await prisma.rental.findFirst({
      where: { rental_id: req.params.id, is_deleted: false },
      include: {
        customer: true,
        rental_items: { include: { equipment_type: true, equipment_unit: true } },
        payments: true,
        service_items: true,
        addendums: true,
        damage_records: true,
      },
    });
    if (!rental) throw new AppError('找不到租借單', 404);
    res.json(rental);
  } catch (e) { next(e); }
});

rentalsRouter.post('/', requirePermission('create_rental'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.customer_id) throw new AppError('客戶必填');
    const startDate = data.rental_start || data.start_date;
    const endDate = data.rental_end || data.end_date;
    if (!startDate || !endDate) throw new AppError('開始和結束日期必填');

    // Blacklist check
    const customer = await prisma.customer.findFirst({
      where: { customer_id: data.customer_id, is_deleted: false },
    });
    if (customer?.blacklisted) {
      throw new AppError(`此客戶已列入黑名單${customer.blacklist_reason ? `（原因：${customer.blacklist_reason}）` : ''}`);
    }

    const rentalId = await generateYearBasedId('rental', 'rental_id', 'RENT');
    const rental = await prisma.rental.create({
      data: {
        rental_id: rentalId,
        customer_id: data.customer_id,
        rental_start: new Date(startDate),
        rental_end: new Date(endDate),
        status: 'draft',
        tax_rate: data.tax_rate || 0.05,
        deposit_amount: data.deposit_amount || null,
        deposit_status: 'pending',
        delivery_required: data.delivery_required || false,
        delivery_address: data.delivery_address || null,
        delivery_contact: data.delivery_contact || null,
        delivery_contact_phone: data.delivery_contact_phone || null,
        delivery_notes: data.delivery_notes || null,
        use_purpose: data.use_purpose || null,
        use_risk_category: data.use_risk_category || null,
        risk_surcharge: data.risk_surcharge || null,
        invoice_required: data.invoice_required || false,
        invoice_status: data.invoice_required ? 'pending' : 'not_required',
        prepared_by: req.user?.staff_id || '',
        handled_by: data.handled_by || req.user?.staff_id || '',
        notes: data.notes || null,
      },
    });
    res.status(201).json(rental);
  } catch (e) { next(e); }
});

rentalsRouter.put('/:id', requirePermission('update'), async (req, res, next) => {
  try {
    const rental = await prisma.rental.update({
      where: { rental_id: req.params.id },
      data: req.body,
    });
    res.json(rental);
  } catch (e) { next(e); }
});

// Business logic endpoints
rentalsRouter.get('/:id/breakdown', async (req, res, next) => {
  try {
    const breakdown = await calculateRentalBreakdown(req.params.id);
    res.json(breakdown);
  } catch (e) { next(e); }
});

rentalsRouter.post('/:id/recalculate', requirePermission('update'), async (req, res, next) => {
  try {
    const breakdown = await recalculateAndUpdateRental(req.params.id);
    res.json(breakdown);
  } catch (e) { next(e); }
});

rentalsRouter.post('/:id/advance-status', requirePermission('update'), async (req, res, next) => {
  try {
    const { status, ...metadata } = req.body;
    if (!status) throw new AppError('新狀態必填');
    const rental = await advanceRentalStatus(req.params.id, status, metadata);
    res.json(rental);
  } catch (e) { next(e); }
});

rentalsRouter.get('/:id/receipt', async (req, res, next) => {
  try {
    const rental = await prisma.rental.findFirst({
      where: { rental_id: req.params.id, is_deleted: false },
      include: { customer: true },
    });
    if (!rental) throw new AppError('找不到租借單', 404);

    const items = await prisma.rentalItem.findMany({
      where: { rental_id: req.params.id, is_deleted: false },
      include: { equipment_type: true, equipment_unit: true },
    });
    const payments = await prisma.payment.findMany({
      where: { rental_id: req.params.id, is_deleted: false },
    });
    const serviceItems = await prisma.serviceItem.findMany({
      where: { rental_id: req.params.id, is_deleted: false },
    });

    const { calculateRentalDays } = await import('../utils/helpers');
    const days = calculateRentalDays(rental.rental_start, rental.rental_end);

    res.json({
      rental_id: rental.rental_id,
      customer: {
        name: rental.customer?.name || '',
        company: rental.customer?.company_name || '',
        phone: rental.customer?.phone || '',
        email: rental.customer?.email || '',
      },
      rental_start: rental.rental_start,
      rental_end: rental.rental_end,
      days,
      status: rental.status,
      items: items.map(i => ({
        type_name: i.equipment_type?.name || i.type_id,
        internal_code: i.equipment_unit?.internal_code || i.unit_id || '',
        serial_number: i.equipment_unit?.serial_number || '',
        daily_rate: Number(i.daily_rate_snapshot),
        days,
        line_total: Number(i.line_total),
        discount_amount: Number(i.discount_amount || 0),
      })),
      services: serviceItems.map(s => ({
        description: s.description,
        unit_price: Number(s.unit_price),
        quantity: s.quantity,
        line_total: Number(s.line_total),
      })),
      total_amount: Number(rental.total_amount || 0),
      paid_amount: Number(rental.paid_amount || 0),
      tax_rate: Number(rental.tax_rate),
      deposit_status: rental.deposit_status,
      payments: payments.map(p => ({
        payment_id: p.payment_id,
        amount: Number(p.amount),
        method: p.payment_method,
        date: p.payment_date,
      })),
      notes: rental.notes || '',
      created_at: rental.created_at,
      generated_at: new Date().toISOString(),
    });
  } catch (e) { next(e); }
});

// Overdue check (for cron)
rentalsRouter.post('/check-overdue', requirePermission('update'), async (_req, res, next) => {
  try {
    const count = await checkAndMarkOverdueRentals();
    res.json({ marked_overdue: count });
  } catch (e) { next(e); }
});
