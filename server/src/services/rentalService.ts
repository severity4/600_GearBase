import { prisma } from '../utils/prisma';
import { findBestDiscount, calculateDiscountAmount } from './discountService';
import { findOverdueRule, calculateOverdueDays, calculateItemOverdueFee } from './overdueService';
import { calculateRentalDays, roundMoney } from '../utils/helpers';
import { AppError } from '../middleware/errorHandler';

/**
 * Valid rental status transitions
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['reserved', 'cancelled'],
  reserved: ['active', 'cancelled'],
  active: ['returned', 'overdue'],
  overdue: ['returned'],
  returned: [],
  cancelled: [],
};

/**
 * Calculate complete rental breakdown
 */
export async function calculateRentalBreakdown(rentalId: string) {
  const rental = await prisma.rental.findFirst({
    where: { rental_id: rentalId, is_deleted: false },
  });
  if (!rental) throw new AppError('找不到租借單: ' + rentalId, 404);

  const items = await prisma.rentalItem.findMany({
    where: { rental_id: rentalId, is_deleted: false },
    include: { equipment_type: true },
  });

  const services = await prisma.serviceItem.findMany({
    where: { rental_id: rentalId, is_deleted: false },
  });

  const startDate = rental.rental_start;
  const endDate = rental.rental_end;
  const actualReturn = rental.actual_return_date;
  const rentalDays = calculateRentalDays(startDate, endDate);

  let equipmentSubtotal = 0;
  let discountTotal = 0;
  let overdueTotal = 0;
  const itemDetails: any[] = [];

  for (const item of items) {
    const dailyRate = Number(item.daily_rate_snapshot);
    const qty = item.quantity;
    const days = item.days || rentalDays;
    const replacementValue = Number(item.replacement_value_snapshot);

    const lineTotal = roundMoney(dailyRate * days * qty);
    equipmentSubtotal += lineTotal;

    // Discount
    const category = item.equipment_type?.category || '';
    const discountRule = await findBestDiscount(item.type_id, category, days);
    const discountAmount = calculateDiscountAmount(lineTotal, dailyRate, days, discountRule);
    discountTotal += discountAmount;

    // Overdue fee (only when actual return date is known and past due)
    let itemOverdue = { fee: 0, forcedPurchase: false };
    if (actualReturn && actualReturn > endDate) {
      const overdueRule = await findOverdueRule(category);
      const overdueDays = calculateOverdueDays(
        endDate,
        actualReturn,
        overdueRule ? Number(overdueRule.grace_period_hours || 0) : 0
      );
      itemOverdue = calculateItemOverdueFee(
        dailyRate * qty,
        overdueDays,
        replacementValue * qty,
        overdueRule
      );
    }
    overdueTotal += itemOverdue.fee;

    itemDetails.push({
      item_id: item.item_id,
      type_id: item.type_id,
      type_name: item.equipment_type?.name || '',
      daily_rate: dailyRate,
      quantity: qty,
      days,
      line_total: lineTotal,
      discount_rule: discountRule ? discountRule.rule_name : null,
      discount_amount: discountAmount,
      line_total_after_discount: lineTotal - discountAmount,
      overdue_fee: itemOverdue.fee,
      forced_purchase: itemOverdue.forcedPurchase,
    });
  }

  // Service subtotal
  const serviceSubtotal = services.reduce(
    (sum, svc) => sum + Number(svc.line_total),
    0
  );

  const riskSurcharge = Number(rental.risk_surcharge || 0);
  const taxRate = Number(rental.tax_rate);
  const taxableAmount = equipmentSubtotal - discountTotal + serviceSubtotal + riskSurcharge;
  const taxAmount = roundMoney(taxableAmount * taxRate);
  const totalAmount = taxableAmount + taxAmount + overdueTotal;
  const depositAmount = Number(rental.deposit_amount || 0);

  // Paid amount
  const payments = await prisma.payment.findMany({
    where: { rental_id: rentalId, is_deleted: false },
  });
  const paidAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    rental_id: rentalId,
    rental_days: rentalDays,
    items: itemDetails,
    services,
    equipment_subtotal: equipmentSubtotal,
    discount_total: discountTotal,
    service_subtotal: serviceSubtotal,
    risk_surcharge: riskSurcharge,
    taxable_amount: taxableAmount,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    overdue_fee: overdueTotal,
    total_amount: totalAmount,
    deposit_amount: depositAmount,
    paid_amount: paidAmount,
    outstanding: Math.max(0, totalAmount - paidAmount),
  };
}

/**
 * Recalculate and update rental amounts
 */
export async function recalculateAndUpdateRental(rentalId: string) {
  const breakdown = await calculateRentalBreakdown(rentalId);

  await prisma.rental.update({
    where: { rental_id: rentalId },
    data: {
      subtotal: breakdown.equipment_subtotal,
      discount_total: breakdown.discount_total,
      overdue_fee: breakdown.overdue_fee,
      tax_amount: breakdown.tax_amount,
      total_amount: breakdown.total_amount,
      total_days: breakdown.rental_days,
    },
  });

  return breakdown;
}

/**
 * Advance rental status with side effects
 */
export async function advanceRentalStatus(
  rentalId: string,
  newStatus: string,
  metadata: Record<string, any> = {}
) {
  const rental = await prisma.rental.findFirst({
    where: { rental_id: rentalId, is_deleted: false },
  });
  if (!rental) throw new AppError('找不到租借單: ' + rentalId, 404);

  const currentStatus = rental.status;
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      `無法從「${currentStatus}」轉換到「${newStatus}」。允許的轉換：${allowed.join(', ') || '無'}`
    );
  }

  const updates: any = { status: newStatus };

  switch (newStatus) {
    case 'active': {
      updates.actual_pickup_date = metadata.pickup_date || new Date();
      // Mark equipment as rented
      const items = await prisma.rentalItem.findMany({
        where: { rental_id: rentalId, is_deleted: false },
      });
      for (const item of items) {
        if (item.unit_id) {
          await prisma.equipmentUnit.update({
            where: { unit_id: item.unit_id },
            data: { status: 'rented' },
          });
        }
      }
      break;
    }
    case 'returned': {
      updates.actual_return_date = metadata.return_date || new Date();
      break;
    }
    case 'cancelled': {
      updates.cancellation_date = new Date();
      updates.cancellation_reason = metadata.reason || '';
      updates.cancellation_fee = metadata.cancellation_fee || 0;
      updates.cancellation_approved_by = metadata.approved_by || '';
      // Release reserved equipment
      const cancelItems = await prisma.rentalItem.findMany({
        where: { rental_id: rentalId, is_deleted: false },
      });
      for (const item of cancelItems) {
        if (item.unit_id) {
          await prisma.equipmentUnit.update({
            where: { unit_id: item.unit_id },
            data: { status: 'available' },
          });
        }
      }
      break;
    }
  }

  const updated = await prisma.rental.update({
    where: { rental_id: rentalId },
    data: updates,
  });

  // Recalculate if returned (includes overdue fees)
  if (newStatus === 'returned') {
    await recalculateAndUpdateRental(rentalId);
  }

  return updated;
}

/**
 * Check and mark overdue rentals (for scheduled job)
 */
export async function checkAndMarkOverdueRentals(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeRentals = await prisma.rental.findMany({
    where: { is_deleted: false, status: 'active', rental_end: { lt: today } },
  });

  let count = 0;
  for (const rental of activeRentals) {
    await prisma.rental.update({
      where: { rental_id: rental.rental_id },
      data: { status: 'overdue' },
    });
    count++;
  }
  return count;
}
