import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { roundMoney } from '../utils/helpers';

/**
 * Venue booking valid status transitions
 */
const VENUE_BOOKING_TRANSITIONS: Record<string, string[]> = {
  draft: ['reserved', 'cancelled'],
  reserved: ['confirmed', 'cancelled'],
  confirmed: ['active', 'cancelled'],
  active: ['completed'],
  completed: [],
  cancelled: [],
};

/**
 * Check venue availability for a time range
 */
export async function checkVenueAvailability(
  venueId: string,
  startTime: string | Date,
  endTime: string | Date,
  excludeBookingId?: string
): Promise<boolean> {
  const reqStart = new Date(startTime);
  const reqEnd = new Date(endTime);

  const conflicting = await prisma.venueBooking.findFirst({
    where: {
      venue_id: venueId,
      is_deleted: false,
      status: { notIn: ['cancelled', 'completed'] },
      booking_id: excludeBookingId ? { not: excludeBookingId } : undefined,
      booking_start: { lt: reqEnd },
      booking_end: { gt: reqStart },
    },
  });

  return !conflicting;
}

/**
 * Get venue schedule for a date range
 */
export async function getVenueSchedule(
  venueId: string,
  startDate: string,
  endDate: string
) {
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59);

  return prisma.venueBooking.findMany({
    where: {
      venue_id: venueId,
      is_deleted: false,
      status: { not: 'cancelled' },
      booking_start: { lte: rangeEnd },
      booking_end: { gte: rangeStart },
    },
    include: { customer: true },
    orderBy: { booking_start: 'asc' },
  });
}

/**
 * Recalculate venue booking amounts
 */
export async function recalculateVenueBooking(
  bookingId: string,
  additionalUpdates: Record<string, any> = {}
) {
  const booking = await prisma.venueBooking.findFirst({
    where: { booking_id: bookingId, is_deleted: false },
  });
  if (!booking) return null;

  const unitRate = Number(booking.unit_rate);
  const rateQty = Number(booking.rate_quantity);
  const subtotal = roundMoney(unitRate * rateQty);
  const discountAmount = Number(booking.discount_amount || 0);
  const overtimeFee = Number(additionalUpdates.overtime_fee ?? booking.overtime_fee ?? 0);

  const services = await prisma.serviceItem.findMany({
    where: { booking_id: bookingId, is_deleted: false },
  });
  const serviceTotal = services.reduce((sum, s) => sum + Number(s.line_total), 0);

  const taxRate = Number(booking.tax_rate);
  const taxableAmount = subtotal - discountAmount + overtimeFee + serviceTotal;
  const taxAmount = roundMoney(taxableAmount * taxRate);
  const totalAmount = taxableAmount + taxAmount;

  return prisma.venueBooking.update({
    where: { booking_id: bookingId },
    data: {
      subtotal,
      overtime_fee: overtimeFee,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      ...additionalUpdates,
    },
  });
}

/**
 * Calculate venue booking breakdown
 */
export async function calculateVenueBookingBreakdown(bookingId: string) {
  const booking = await prisma.venueBooking.findFirst({
    where: { booking_id: bookingId, is_deleted: false },
    include: { venue: true },
  });
  if (!booking) throw new AppError('找不到場地預約: ' + bookingId, 404);

  const services = await prisma.serviceItem.findMany({
    where: { booking_id: bookingId, is_deleted: false },
  });
  const payments = await prisma.payment.findMany({
    where: { booking_id: bookingId, is_deleted: false },
  });

  const unitRate = Number(booking.unit_rate);
  const rateQty = Number(booking.rate_quantity);
  const subtotal = roundMoney(unitRate * rateQty);
  const discountAmount = Number(booking.discount_amount || 0);
  const overtimeFee = Number(booking.overtime_fee || 0);
  const serviceTotal = services.reduce((sum, s) => sum + Number(s.line_total), 0);
  const taxRate = Number(booking.tax_rate);
  const taxableAmount = subtotal - discountAmount + overtimeFee + serviceTotal;
  const taxAmount = roundMoney(taxableAmount * taxRate);
  const totalAmount = taxableAmount + taxAmount;
  const paidAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    booking_id: bookingId,
    venue_name: booking.venue?.name || '',
    rate_type: booking.rate_type,
    unit_rate: unitRate,
    rate_quantity: rateQty,
    subtotal,
    discount_amount: discountAmount,
    overtime_fee: overtimeFee,
    service_total: serviceTotal,
    services,
    taxable_amount: taxableAmount,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    deposit_amount: Number(booking.deposit_amount || 0),
    paid_amount: paidAmount,
    outstanding: Math.max(0, totalAmount - paidAmount),
  };
}

/**
 * Advance venue booking status
 */
export async function advanceVenueBookingStatus(
  bookingId: string,
  newStatus: string,
  metadata: Record<string, any> = {}
) {
  const booking = await prisma.venueBooking.findFirst({
    where: { booking_id: bookingId, is_deleted: false },
  });
  if (!booking) throw new AppError('找不到場地預約: ' + bookingId, 404);

  const currentStatus = booking.status;
  const allowed = VENUE_BOOKING_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      `無法從「${currentStatus}」轉換到「${newStatus}」。允許的轉換：${allowed.join(', ') || '無'}`
    );
  }

  const updates: any = { status: newStatus };

  switch (newStatus) {
    case 'active':
      updates.actual_start = metadata.actual_start || new Date();
      break;

    case 'completed': {
      updates.actual_end = metadata.actual_end || new Date();
      updates.post_use_condition = metadata.post_use_condition || '';
      // Calculate overtime
      if (booking.booking_end) {
        const expectedEnd = new Date(booking.booking_end);
        const actualEnd = new Date(updates.actual_end);
        if (actualEnd > expectedEnd) {
          const overtimeMs = actualEnd.getTime() - expectedEnd.getTime();
          const overtimeHours = Math.ceil(overtimeMs / (1000 * 60 * 60));
          updates.overtime_hours = overtimeHours;
          const venue = await prisma.venue.findFirst({
            where: { venue_id: booking.venue_id },
          });
          const overtimeRate = venue
            ? Number(venue.overtime_hourly_rate || venue.hourly_rate || 0)
            : 0;
          updates.overtime_fee = roundMoney(overtimeHours * overtimeRate);
        }
      }
      break;
    }

    case 'cancelled':
      updates.cancellation_date = new Date();
      updates.cancellation_reason = metadata.reason || '';
      updates.cancellation_fee = metadata.cancellation_fee || 0;
      break;
  }

  const updated = await prisma.venueBooking.update({
    where: { booking_id: bookingId },
    data: updates,
  });

  // Recalculate if completed
  if (newStatus === 'completed') {
    await recalculateVenueBooking(bookingId, { overtime_fee: updates.overtime_fee });
  }

  return updated;
}
