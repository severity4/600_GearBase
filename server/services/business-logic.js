/**
 * Business Logic Service - Replaces BusinessLogic.gs
 * Discount, overdue, rental calculation, status workflows
 */
const db = require('../db');

// ==================== Discount Logic ====================

async function findBestDiscount(typeId, category, rentalDays) {
  const rules = await db.getFiltered('Discount_Rules', { active: true });

  const applicable = rules.filter(rule => {
    if (rentalDays < (rule.min_days || 0)) return false;
    if (rule.max_days && rentalDays > rule.max_days) return false;
    if (rule.applies_to === 'all') return true;
    if (rule.applies_to === 'equipment' && rule.target_id === typeId) return true;
    if (rule.applies_to === 'category' && rule.target_id === category) return true;
    return false;
  });

  if (applicable.length === 0) return null;

  const priority = { equipment: 3, category: 2, all: 1 };
  applicable.sort((a, b) => {
    const pDiff = (priority[b.applies_to] || 0) - (priority[a.applies_to] || 0);
    if (pDiff !== 0) return pDiff;
    return (parseFloat(b.discount_value) || 0) - (parseFloat(a.discount_value) || 0);
  });

  return applicable[0];
}

function calculateDiscountAmount(lineTotal, dailyRate, days, rule) {
  if (!rule) return 0;
  if (rule.discount_type === 'percentage') {
    return Math.round(lineTotal * (parseFloat(rule.discount_value) || 0) / 100);
  }
  if (rule.discount_type === 'fixed_per_day') {
    return Math.round((parseFloat(rule.discount_value) || 0) * days);
  }
  return 0;
}

// ==================== Overdue Logic ====================

async function findOverdueRule(category) {
  const rules = await db.getFiltered('Overdue_Rules', { active: true });
  const categoryRule = rules.find(r => r.applies_to === 'category' && r.target_category === category);
  if (categoryRule) return categoryRule;
  return rules.find(r => r.applies_to === 'all') || null;
}

function calculateOverdueDays(expectedReturn, actualReturn, graceHours) {
  const expected = new Date(expectedReturn);
  const actual = new Date(actualReturn);
  if (actual <= expected) return 0;
  const diffMs = actual - expected;
  const graceMs = (graceHours || 0) * 60 * 60 * 1000;
  if (diffMs <= graceMs) return 0;
  return Math.ceil((diffMs - graceMs) / (1000 * 60 * 60 * 24));
}

function calculateItemOverdueFee(dailyRate, overdueDays, replacementValue, rule) {
  if (!rule || overdueDays <= 0) return { fee: 0, forcedPurchase: false };
  const multiplier = parseFloat(rule.multiplier) || 1.5;
  let fee = Math.round(dailyRate * multiplier * overdueDays);
  if (rule.max_penalty_rate) {
    const maxFee = Math.round(replacementValue * parseFloat(rule.max_penalty_rate));
    fee = Math.min(fee, maxFee);
  }
  const forcedDays = rule.forced_purchase_days ? parseInt(rule.forced_purchase_days) : null;
  if (forcedDays && overdueDays >= forcedDays) {
    return { fee: replacementValue, forcedPurchase: true };
  }
  return { fee, forcedPurchase: false };
}

// ==================== Rental Calculation ====================

function calculateRentalDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

async function calculateRentalBreakdown(rentalId) {
  const rentals = await db.getFiltered('Rentals', { rental_id: rentalId });
  const rental = rentals[0];
  if (!rental) throw new Error('找不到租借單: ' + rentalId);

  const items = (await db.getFiltered('Rental_Items', { rental_id: rentalId })).filter(i => !i.is_deleted);
  const services = (await db.getFiltered('Service_Items', { rental_id: rentalId })).filter(s => !s.is_deleted);
  const types = await db.getAll('Equipment_Types');

  const startDate = new Date(rental.rental_start);
  const endDate = new Date(rental.rental_end);
  const actualReturn = rental.actual_return_date ? new Date(rental.actual_return_date) : null;
  const rentalDays = calculateRentalDays(startDate, endDate);

  let equipmentSubtotal = 0;
  let discountTotal = 0;
  let overdueTotal = 0;
  const itemDetails = [];

  for (const item of items) {
    const type = types.find(t => t.type_id === item.type_id) || {};
    const dailyRate = parseFloat(item.daily_rate_snapshot || item.daily_rate || type.daily_rate || 0);
    const qty = parseInt(item.quantity) || 1;
    const days = parseInt(item.days) || rentalDays;
    const replacementValue = parseFloat(item.replacement_value_snapshot || type.replacement_value || 0);

    const lineTotal = Math.round(dailyRate * days * qty);
    equipmentSubtotal += lineTotal;

    const discountRule = await findBestDiscount(item.type_id, type.category, days);
    const discountAmount = calculateDiscountAmount(lineTotal, dailyRate, days, discountRule);
    discountTotal += discountAmount;

    let itemOverdue = { fee: 0, forcedPurchase: false };
    if (actualReturn && actualReturn > endDate) {
      const overdueRule = await findOverdueRule(type.category);
      const overdueDays = calculateOverdueDays(endDate, actualReturn, overdueRule ? overdueRule.grace_period_hours : 0);
      itemOverdue = calculateItemOverdueFee(dailyRate * qty, overdueDays, replacementValue * qty, overdueRule);
    }
    overdueTotal += itemOverdue.fee;

    itemDetails.push({
      item_id: item.item_id,
      type_id: item.type_id,
      type_name: type.type_name || type.name || '',
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

  let serviceSubtotal = 0;
  services.forEach(svc => { serviceSubtotal += parseFloat(svc.line_total) || 0; });

  const riskSurcharge = parseFloat(rental.risk_surcharge) || 0;
  const taxRate = parseFloat(rental.tax_rate) || 0.05;
  const taxableAmount = equipmentSubtotal - discountTotal + serviceSubtotal + riskSurcharge;
  const taxAmount = Math.round(taxableAmount * taxRate);
  const totalAmount = taxableAmount + taxAmount + overdueTotal;
  const depositAmount = parseFloat(rental.deposit_amount) || 0;

  const payments = (await db.getFiltered('Payments', { rental_id: rentalId })).filter(p => !p.is_deleted);
  const paidAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

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

async function recalculateAndUpdateRental(rentalId) {
  const breakdown = await calculateRentalBreakdown(rentalId);
  await db.update('Rentals', 'rental_id', rentalId, {
    subtotal: breakdown.equipment_subtotal,
    discount_total: breakdown.discount_total,
    overdue_fee: breakdown.overdue_fee,
    tax_amount: breakdown.tax_amount,
    total_amount: breakdown.total_amount,
    total_days: breakdown.rental_days,
    updated_at: new Date(),
  });
  return breakdown;
}

// ==================== Rental Status Workflow ====================

const VALID_TRANSITIONS = {
  draft: ['reserved', 'cancelled'],
  reserved: ['active', 'cancelled'],
  active: ['returned', 'overdue'],
  overdue: ['returned'],
  returned: [],
  cancelled: [],
};

async function advanceRentalStatus(rentalId, newStatus, metadata = {}) {
  const rentals = await db.getFiltered('Rentals', { rental_id: rentalId });
  const rental = rentals[0];
  if (!rental) throw new Error('找不到租借單: ' + rentalId);

  const currentStatus = rental.status;
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`無法從「${currentStatus}」轉換到「${newStatus}」。允許的轉換：${allowed.join(', ') || '無'}`);
  }

  const updates = { status: newStatus, updated_at: new Date() };

  switch (newStatus) {
    case 'active':
      updates.actual_pickup_date = metadata.pickup_date || new Date();
      const activeItems = (await db.getFiltered('Rental_Items', { rental_id: rentalId })).filter(i => !i.is_deleted);
      for (const item of activeItems) {
        if (item.unit_id) {
          await db.update('Equipment_Units', 'unit_id', item.unit_id, { status: 'rented' });
        }
      }
      break;

    case 'returned':
      updates.actual_return_date = metadata.return_date || new Date();
      await recalculateAndUpdateRental(rentalId);
      break;

    case 'cancelled':
      updates.cancellation_date = new Date();
      updates.cancellation_reason = metadata.reason || '';
      updates.cancellation_fee = metadata.cancellation_fee || 0;
      updates.cancellation_approved_by = metadata.approved_by || '';
      const cancelItems = (await db.getFiltered('Rental_Items', { rental_id: rentalId })).filter(i => !i.is_deleted);
      for (const item of cancelItems) {
        if (item.unit_id) {
          await db.update('Equipment_Units', 'unit_id', item.unit_id, { status: 'available' });
        }
      }
      break;
  }

  await db.update('Rentals', 'rental_id', rentalId, updates);
  return true;
}

// ==================== Venue Booking Workflow ====================

const VENUE_BOOKING_TRANSITIONS = {
  draft: ['reserved', 'cancelled'],
  reserved: ['confirmed', 'cancelled'],
  confirmed: ['active', 'cancelled'],
  active: ['completed'],
  completed: [],
  cancelled: [],
};

async function advanceVenueBookingStatus(bookingId, newStatus, metadata = {}) {
  const bookings = await db.getFiltered('Venue_Bookings', { booking_id: bookingId });
  const booking = bookings[0];
  if (!booking) throw new Error('找不到場地預約: ' + bookingId);

  const currentStatus = booking.status;
  const allowed = VENUE_BOOKING_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`無法從「${currentStatus}」轉換到「${newStatus}」。允許的轉換：${allowed.join(', ') || '無'}`);
  }

  const updates = { status: newStatus, updated_at: new Date() };

  switch (newStatus) {
    case 'active':
      updates.actual_start = metadata.actual_start || new Date();
      break;

    case 'completed':
      updates.actual_end = metadata.actual_end || new Date();
      updates.post_use_condition = metadata.post_use_condition || '';
      if (booking.booking_end) {
        const expectedEnd = new Date(booking.booking_end);
        const actualEnd = new Date(updates.actual_end);
        if (actualEnd > expectedEnd) {
          const overtimeMs = actualEnd - expectedEnd;
          const overtimeHours = Math.ceil(overtimeMs / (1000 * 60 * 60));
          updates.overtime_hours = overtimeHours;
          const venues = await db.getFiltered('Venues', { venue_id: booking.venue_id });
          const venue = venues[0];
          const overtimeRate = venue ? (parseFloat(venue.overtime_hourly_rate) || parseFloat(venue.hourly_rate) || 0) : 0;
          updates.overtime_fee = Math.round(overtimeHours * overtimeRate);
        }
      }
      break;

    case 'cancelled':
      updates.cancellation_date = new Date();
      updates.cancellation_reason = metadata.reason || '';
      updates.cancellation_fee = metadata.cancellation_fee || 0;
      break;
  }

  await db.update('Venue_Bookings', 'booking_id', bookingId, updates);
  return true;
}

async function calculateVenueBookingBreakdown(bookingId) {
  const bookings = await db.getFiltered('Venue_Bookings', { booking_id: bookingId });
  const booking = bookings[0];
  if (!booking) throw new Error('找不到場地預約: ' + bookingId);

  const venues = await db.getFiltered('Venues', { venue_id: booking.venue_id });
  const venue = venues[0];
  const services = (await db.getFiltered('Service_Items', { booking_id: bookingId })).filter(s => !s.is_deleted);
  const payments = (await db.getFiltered('Payments', { booking_id: bookingId })).filter(p => !p.is_deleted);

  const unitRate = parseFloat(booking.unit_rate) || 0;
  const rateQty = parseFloat(booking.rate_quantity) || 1;
  const subtotal = Math.round(unitRate * rateQty);
  const discountAmount = parseFloat(booking.discount_amount) || 0;
  const overtimeFee = parseFloat(booking.overtime_fee) || 0;
  const serviceTotal = services.reduce((sum, s) => sum + (parseFloat(s.line_total) || 0), 0);
  const taxRate = parseFloat(booking.tax_rate) || 0.05;
  const taxableAmount = subtotal - discountAmount + overtimeFee + serviceTotal;
  const taxAmount = Math.round(taxableAmount * taxRate);
  const totalAmount = taxableAmount + taxAmount;
  const paidAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  return {
    booking_id: bookingId,
    venue_name: venue ? venue.name : '',
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
    deposit_amount: parseFloat(booking.deposit_amount) || 0,
    paid_amount: paidAmount,
    outstanding: Math.max(0, totalAmount - paidAmount),
  };
}

async function checkVenueAvailability(venueId, startTime, endTime, excludeBookingId) {
  const bookings = (await db.getAll('Venue_Bookings')).filter(b =>
    b.venue_id === venueId &&
    !['cancelled', 'completed'].includes(b.status) &&
    b.booking_id !== excludeBookingId
  );

  const reqStart = new Date(startTime);
  const reqEnd = new Date(endTime);

  return !bookings.some(b => {
    const bStart = new Date(b.booking_start);
    const bEnd = new Date(b.booking_end);
    return bStart < reqEnd && bEnd > reqStart;
  });
}

function addWorkingDays(startDate, days) {
  const date = new Date(startDate);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) added++;
  }
  return date;
}

module.exports = {
  calculateRentalDays,
  calculateRentalBreakdown,
  recalculateAndUpdateRental,
  advanceRentalStatus,
  advanceVenueBookingStatus,
  calculateVenueBookingBreakdown,
  checkVenueAvailability,
  addWorkingDays,
  VALID_TRANSITIONS,
  VENUE_BOOKING_TRANSITIONS,
};
