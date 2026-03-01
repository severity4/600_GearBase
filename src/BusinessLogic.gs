/**
 * 映奧創意工作室 - 業務邏輯層
 * Business Logic: 租金計算、折扣套用、逾期費、稅金、狀態工作流
 */

// ==================== 折扣套用邏輯 ====================

/**
 * 取得適用的折扣規則
 * @param {string} typeId - 器材類型 ID
 * @param {string} category - 器材分類
 * @param {number} rentalDays - 租借天數
 * @return {Object|null} 最佳折扣規則
 */
function findBestDiscount(typeId, category, rentalDays) {
  const rules = getSheetData('Discount_Rules').filter(r =>
    !r.is_deleted && r.active === true
  );

  const applicable = rules.filter(rule => {
    if (rentalDays < (rule.min_days || 0)) return false;
    if (rule.max_days && rentalDays > rule.max_days) return false;

    if (rule.applies_to === 'all') return true;
    if (rule.applies_to === 'equipment' && rule.target_id === typeId) return true;
    if (rule.applies_to === 'category' && rule.target_id === category) return true;

    return false;
  });

  if (applicable.length === 0) return null;

  // 優先選擇：指定器材 > 分類 > 全部，同層取折扣值最高的
  const priority = { equipment: 3, category: 2, all: 1 };
  applicable.sort((a, b) => {
    const pDiff = (priority[b.applies_to] || 0) - (priority[a.applies_to] || 0);
    if (pDiff !== 0) return pDiff;
    return (parseFloat(b.discount_value) || 0) - (parseFloat(a.discount_value) || 0);
  });

  return applicable[0];
}

/**
 * 計算單項折扣金額
 * @param {number} lineTotal - 原價小計
 * @param {number} dailyRate - 日租費
 * @param {number} days - 天數
 * @param {Object} rule - 折扣規則
 * @return {number} 折扣金額
 */
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

// ==================== 逾期費計算 ====================

/**
 * 取得適用的逾期規則
 * @param {string} category - 器材分類
 * @return {Object} 逾期規則
 */
function findOverdueRule(category) {
  const rules = getSheetData('Overdue_Rules').filter(r =>
    !r.is_deleted && r.active === true
  );

  // 先找分類專屬規則
  const categoryRule = rules.find(r =>
    r.applies_to === 'category' && r.target_category === category
  );
  if (categoryRule) return categoryRule;

  // 再找全域規則
  return rules.find(r => r.applies_to === 'all') || null;
}

/**
 * 計算逾期天數（考慮寬限時數）
 * @param {Date} expectedReturn - 預定歸還日
 * @param {Date} actualReturn - 實際歸還日
 * @param {number} graceHours - 寬限時數
 * @return {number} 逾期天數
 */
function calculateOverdueDays(expectedReturn, actualReturn, graceHours) {
  const expected = new Date(expectedReturn);
  const actual = new Date(actualReturn);

  if (actual <= expected) return 0;

  const diffMs = actual - expected;
  const graceMs = (graceHours || 0) * 60 * 60 * 1000;

  if (diffMs <= graceMs) return 0;

  return Math.ceil((diffMs - graceMs) / (1000 * 60 * 60 * 24));
}

/**
 * 計算單一器材項目的逾期費
 * @param {number} dailyRate - 日租費
 * @param {number} overdueDays - 逾期天數
 * @param {number} replacementValue - 器材市值
 * @param {Object} rule - 逾期規則
 * @return {Object} { fee, forcedPurchase }
 */
function calculateItemOverdueFee(dailyRate, overdueDays, replacementValue, rule) {
  if (!rule || overdueDays <= 0) return { fee: 0, forcedPurchase: false };

  const multiplier = parseFloat(rule.multiplier) || 1.5;
  let fee = Math.round(dailyRate * multiplier * overdueDays);

  // 罰款上限
  if (rule.max_penalty_rate) {
    const maxFee = Math.round(replacementValue * parseFloat(rule.max_penalty_rate));
    fee = Math.min(fee, maxFee);
  }

  // 強制買斷
  const forcedDays = rule.forced_purchase_days ? parseInt(rule.forced_purchase_days) : null;
  if (forcedDays && overdueDays >= forcedDays) {
    return { fee: replacementValue, forcedPurchase: true };
  }

  return { fee, forcedPurchase: false };
}

// ==================== 完整租金計算 ====================

/**
 * 計算完整的租借費用明細
 * @param {string} rentalId - 租借單 ID
 * @return {Object} 完整費用明細
 */
function calculateRentalBreakdown(rentalId) {
  const rental = getSheetDataFiltered('Rentals', { rental_id: rentalId })[0];
  if (!rental) throw new Error('找不到租借單: ' + rentalId);

  const items = getSheetDataFiltered('Rental_Items', { rental_id: rentalId })
    .filter(i => !i.is_deleted);
  const services = getSheetDataFiltered('Service_Items', { rental_id: rentalId })
    .filter(s => !s.is_deleted);
  const types = getSheetData('Equipment_Types');

  const startDate = new Date(rental.rental_start || rental.start_date);
  const endDate = new Date(rental.rental_end || rental.end_date);
  const actualReturn = rental.actual_return_date ? new Date(rental.actual_return_date) : null;
  const rentalDays = calculateRentalDays(startDate, endDate);

  // 計算各器材項目
  let equipmentSubtotal = 0;
  let discountTotal = 0;
  let overdueTotal = 0;
  const itemDetails = [];

  items.forEach(item => {
    const type = types.find(t => t.type_id === item.type_id) || {};
    const dailyRate = parseFloat(item.daily_rate_snapshot || item.daily_rate || type.daily_rate || 0);
    const qty = parseInt(item.quantity) || 1;
    const days = parseInt(item.days) || rentalDays;
    const replacementValue = parseFloat(item.replacement_value_snapshot || type.replacement_value || 0);

    const lineTotal = Math.round(dailyRate * days * qty);
    equipmentSubtotal += lineTotal;

    // 折扣
    const discountRule = findBestDiscount(item.type_id, type.category, days);
    const discountAmount = calculateDiscountAmount(lineTotal, dailyRate, days, discountRule);
    discountTotal += discountAmount;

    // 逾期費（僅在實際歸還日已知時計算）
    let itemOverdue = { fee: 0, forcedPurchase: false };
    if (actualReturn && actualReturn > endDate) {
      const overdueRule = findOverdueRule(type.category);
      const overdueDays = calculateOverdueDays(endDate, actualReturn,
        overdueRule ? overdueRule.grace_period_hours : 0);
      itemOverdue = calculateItemOverdueFee(dailyRate * qty, overdueDays, replacementValue * qty, overdueRule);
    }
    overdueTotal += itemOverdue.fee;

    itemDetails.push({
      item_id: item.item_id || item.rental_item_id,
      type_id: item.type_id,
      type_name: type.type_name || type.name || '',
      daily_rate: dailyRate,
      quantity: qty,
      days: days,
      line_total: lineTotal,
      discount_rule: discountRule ? discountRule.rule_name : null,
      discount_amount: discountAmount,
      line_total_after_discount: lineTotal - discountAmount,
      overdue_fee: itemOverdue.fee,
      forced_purchase: itemOverdue.forcedPurchase
    });
  });

  // 服務項目小計
  let serviceSubtotal = 0;
  services.forEach(svc => {
    serviceSubtotal += parseFloat(svc.line_total) || 0;
  });

  // 高風險加收
  const riskSurcharge = parseFloat(rental.risk_surcharge) || 0;

  // 稅金計算
  const taxRate = parseFloat(rental.tax_rate) || 0.05;
  const taxableAmount = equipmentSubtotal - discountTotal + serviceSubtotal + riskSurcharge;
  const taxAmount = Math.round(taxableAmount * taxRate);

  // 合計
  const totalAmount = taxableAmount + taxAmount + overdueTotal;

  // 押金
  const depositAmount = parseFloat(rental.deposit_amount) || 0;

  // 已付金額
  const payments = getSheetDataFiltered('Payments', { rental_id: rentalId })
    .filter(p => !p.is_deleted);
  const paidAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  return {
    rental_id: rentalId,
    rental_days: rentalDays,
    items: itemDetails,
    services: services,
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
    outstanding: Math.max(0, totalAmount - paidAmount)
  };
}

/**
 * 重新計算並更新租借單金額
 * @param {string} rentalId - 租借單 ID
 * @return {Object} 更新後的費用明細
 */
function recalculateAndUpdateRental(rentalId) {
  const breakdown = calculateRentalBreakdown(rentalId);

  updateSheetRow('Rentals', 'rental_id', rentalId, {
    subtotal: breakdown.equipment_subtotal,
    discount_total: breakdown.discount_total,
    overdue_fee: breakdown.overdue_fee,
    tax_amount: breakdown.tax_amount,
    total_amount: breakdown.total_amount,
    total_days: breakdown.rental_days,
    updated_at: new Date()
  });

  return breakdown;
}

// ==================== 租借狀態工作流 ====================

/**
 * 合法的狀態轉換表
 * draft → reserved → active → returned
 *                      ↓
 *                   overdue → returned
 * draft/reserved → cancelled
 */
const VALID_TRANSITIONS = {
  draft: ['reserved', 'cancelled'],
  reserved: ['active', 'cancelled'],
  active: ['returned', 'overdue'],
  overdue: ['returned'],
  returned: [],
  cancelled: []
};

/**
 * 推進租借單狀態
 * @param {string} rentalId - 租借單 ID
 * @param {string} newStatus - 新狀態
 * @param {Object} metadata - 附加資料
 * @return {boolean}
 */
function advanceRentalStatus(rentalId, newStatus, metadata = {}) {
  requirePermission('update', '無權限變更租借單狀態');
  const rental = getSheetDataFiltered('Rentals', { rental_id: rentalId })[0];
  if (!rental) throw new Error('找不到租借單: ' + rentalId);

  const currentStatus = rental.status;
  const allowed = VALID_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    throw new Error(`無法從「${currentStatus}」轉換到「${newStatus}」。允許的轉換：${allowed.join(', ') || '無'}`);
  }

  const updates = {
    status: newStatus,
    updated_at: new Date()
  };

  // 狀態轉換時的附加處理
  switch (newStatus) {
    case 'reserved':
      break;

    case 'active':
      updates.actual_pickup_date = metadata.pickup_date || new Date();
      // 更新器材狀態為 rented
      const items = getSheetDataFiltered('Rental_Items', { rental_id: rentalId })
        .filter(i => !i.is_deleted);
      items.forEach(item => {
        if (item.unit_id) {
          updateSheetRow('Equipment_Units', 'unit_id', item.unit_id, { status: 'rented' });
        }
      });
      break;

    case 'returned':
      updates.actual_return_date = metadata.return_date || new Date();
      // 重新計算含逾期費的總金額
      recalculateAndUpdateRental(rentalId);
      // 器材狀態恢復由入庫流程處理 (Inventory_Logs check_in)
      break;

    case 'overdue':
      break;

    case 'cancelled':
      updates.cancellation_date = new Date();
      updates.cancellation_reason = metadata.reason || '';
      updates.cancellation_fee = metadata.cancellation_fee || 0;
      updates.cancellation_approved_by = metadata.approved_by || '';
      // 釋放已預約的器材
      const cancelItems = getSheetDataFiltered('Rental_Items', { rental_id: rentalId })
        .filter(i => !i.is_deleted);
      cancelItems.forEach(item => {
        if (item.unit_id) {
          updateSheetRow('Equipment_Units', 'unit_id', item.unit_id, { status: 'available' });
        }
      });
      break;
  }

  updateSheetRow('Rentals', 'rental_id', rentalId, updates);
  return true;
}

/**
 * 自動檢測逾期租借單並更新狀態
 * 可設定為每日時間驅動觸發器
 */
function checkAndMarkOverdueRentals() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeRentals = getSheetData('Rentals').filter(r =>
    !r.is_deleted && r.status === 'active'
  );

  let overdueCount = 0;
  activeRentals.forEach(rental => {
    const endDate = new Date(rental.rental_end || rental.end_date);
    endDate.setHours(0, 0, 0, 0);

    if (today > endDate) {
      updateSheetRow('Rentals', 'rental_id', rental.rental_id, {
        status: 'overdue',
        updated_at: new Date()
      });
      overdueCount++;
    }
  });

  Logger.log(`已標記 ${overdueCount} 筆逾期租借單`);
  return overdueCount;
}

// ==================== 入庫歸還處理 ====================

/**
 * 處理器材歸還入庫
 * @param {Object} checkInData - 入庫資料
 * @return {Object} 入庫結果
 */
function processEquipmentCheckIn(checkInData) {
  requirePermission('process_check_in', '無權限處理入庫歸還');
  const { unit_id, rental_id, performed_by, to_location_id,
    condition_after, accessories_complete, missing_accessories,
    needs_maintenance, needs_cleaning, damage_found, damage_description,
    photo_urls, notes } = checkInData;

  // 取得器材目前資訊
  const unit = getSheetDataFiltered('Equipment_Units', { unit_id: unit_id })[0];
  if (!unit) throw new Error('找不到器材: ' + unit_id);

  // 建立 Inventory_Log
  const logData = {
    log_id: generateNextId('Inventory_Logs', 'log_id', 'IL'),
    unit_id: unit_id,
    rental_id: rental_id || '',
    log_type: 'check_in',
    log_date: new Date(),
    performed_by: performed_by,
    from_location_id: '',
    to_location_id: to_location_id || unit.location_id || '',
    condition_before: unit.current_condition || 'good',
    condition_after: condition_after || 'good',
    checklist_completed: true,
    accessories_complete: accessories_complete !== false,
    missing_accessories: missing_accessories || '',
    needs_maintenance: needs_maintenance || false,
    needs_cleaning: needs_cleaning || false,
    damage_found: damage_found || false,
    photo_urls: photo_urls || '',
    notes: notes || '',
    inspection_deadline: addWorkingDays(new Date(), 3),
    inspection_overdue: false,
    is_deleted: false
  };

  appendSheetRow('Inventory_Logs', logData);

  // 更新器材狀態
  const unitUpdates = {
    current_condition: condition_after || unit.current_condition,
    location_id: to_location_id || unit.location_id
  };

  if (needs_maintenance || damage_found) {
    unitUpdates.status = 'maintenance';
  } else {
    unitUpdates.status = 'available';
  }

  updateSheetRow('Equipment_Units', 'unit_id', unit_id, unitUpdates);

  // 如果有損壞，自動建立 Damage_Record
  let damageRecord = null;
  if (damage_found && damage_description) {
    damageRecord = {
      damage_id: generateNextId('Damage_Records', 'damage_id', 'DM'),
      rental_id: rental_id || '',
      unit_id: unit_id,
      damage_description: damage_description,
      damage_severity: 'moderate',
      within_tolerance: false,
      assessed_by: performed_by,
      status: 'pending',
      created_at: new Date(),
      is_deleted: false
    };
    appendSheetRow('Damage_Records', damageRecord);
  }

  // 更新 Rental_Items 歸還狀態
  if (rental_id) {
    const rentalItems = getSheetDataFiltered('Rental_Items', { rental_id: rental_id })
      .filter(i => !i.is_deleted && i.unit_id === unit_id);
    rentalItems.forEach(item => {
      updateSheetRow('Rental_Items', item.item_id ? 'item_id' : 'rental_item_id',
        item.item_id || item.rental_item_id, {
          return_status: 'returned',
          return_date: new Date(),
          condition_in: condition_after || '',
          checked_in_by: performed_by
        });
    });

    // 檢查是否所有項目都已歸還
    const allItems = getSheetDataFiltered('Rental_Items', { rental_id: rental_id })
      .filter(i => !i.is_deleted);
    const allReturned = allItems.every(i => i.return_status === 'returned');
    if (allReturned) {
      const rental = getSheetDataFiltered('Rentals', { rental_id: rental_id })[0];
      if (rental && ['active', 'overdue'].includes(rental.status)) {
        advanceRentalStatus(rental_id, 'returned', { return_date: new Date() });
      }
    }
  }

  return {
    success: true,
    log_id: logData.log_id,
    new_status: unitUpdates.status,
    damage_record: damageRecord
  };
}

/**
 * 加上工作天
 */
function addWorkingDays(startDate, days) {
  const date = new Date(startDate);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return date;
}

// ==================== SERVICE ITEMS ====================

function getServiceItems(rentalId) {
  return getSheetDataFiltered('Service_Items', { rental_id: rentalId })
    .filter(s => !s.is_deleted);
}

function createServiceItem(serviceData) {
  requirePermission('create', '無權限建立服務項目');
  serviceData.service_item_id = generateNextId('Service_Items', 'service_item_id', 'SI');
  serviceData.line_total = (parseFloat(serviceData.unit_price) || 0) * (parseInt(serviceData.quantity) || 1);
  serviceData.is_deleted = false;

  appendSheetRow('Service_Items', serviceData);

  // 重新計算租借單總額
  if (serviceData.rental_id) {
    recalculateAndUpdateRental(serviceData.rental_id);
  }

  return serviceData;
}

function updateServiceItem(serviceItemId, updates) {
  requirePermission('update', '無權限編輯服務項目');
  if (updates.unit_price !== undefined && updates.quantity !== undefined) {
    updates.line_total = (parseFloat(updates.unit_price) || 0) * (parseInt(updates.quantity) || 1);
  }
  return updateSheetRow('Service_Items', 'service_item_id', serviceItemId, updates);
}

function deleteServiceItem(serviceItemId) {
  requirePermission('delete', '無權限刪除服務項目');
  return updateSheetRow('Service_Items', 'service_item_id', serviceItemId, { is_deleted: true });
}

// ==================== RENTAL ADDENDUMS ====================

function getRentalAddendums(rentalId) {
  return getSheetDataFiltered('Rental_Addendums', { rental_id: rentalId })
    .filter(a => !a.is_deleted);
}

function createRentalAddendum(addendumData) {
  requirePermission('create', '無權限建立租借附約');
  const rental = getSheetDataFiltered('Rentals', { rental_id: addendumData.rental_id })[0];
  if (!rental) throw new Error('找不到租借單: ' + addendumData.rental_id);

  // 產生附約 ID: RENT-2026-001-A1
  const existingAddendums = getSheetDataFiltered('Rental_Addendums', { rental_id: addendumData.rental_id })
    .filter(a => !a.is_deleted);
  const addendumNum = existingAddendums.length + 1;
  addendumData.addendum_id = addendumData.rental_id + '-A' + addendumNum;

  addendumData.signed = false;
  addendumData.created_at = new Date();
  addendumData.is_deleted = false;

  // 續租時更新主約歸還日
  if (addendumData.addendum_type === 'extension' && addendumData.new_end_date) {
    addendumData.original_end_date = rental.rental_end || rental.end_date;
    updateSheetRow('Rentals', 'rental_id', addendumData.rental_id, {
      rental_end: addendumData.new_end_date,
      end_date: addendumData.new_end_date,
      updated_at: new Date()
    });
  }

  appendSheetRow('Rental_Addendums', addendumData);
  return addendumData;
}

// ==================== VENUE BOOKING WORKFLOW ====================

/**
 * 場地預約合法的狀態轉換表
 * draft → reserved → confirmed → active → completed
 * draft/reserved/confirmed → cancelled
 */
const VENUE_BOOKING_TRANSITIONS = {
  draft: ['reserved', 'cancelled'],
  reserved: ['confirmed', 'cancelled'],
  confirmed: ['active', 'cancelled'],
  active: ['completed'],
  completed: [],
  cancelled: []
};

/**
 * 推進場地預約狀態
 * @param {string} bookingId - 預約 ID
 * @param {string} newStatus - 新狀態
 * @param {Object} metadata - 附加資料
 * @return {boolean}
 */
function advanceVenueBookingStatus(bookingId, newStatus, metadata = {}) {
  requirePermission('update', '無權限變更場地預約狀態');
  const booking = getSheetDataFiltered('Venue_Bookings', { booking_id: bookingId })[0];
  if (!booking) throw new Error('找不到場地預約: ' + bookingId);

  const currentStatus = booking.status;
  const allowed = VENUE_BOOKING_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    throw new Error(`無法從「${currentStatus}」轉換到「${newStatus}」。允許的轉換：${allowed.join(', ') || '無'}`);
  }

  const updates = {
    status: newStatus,
    updated_at: new Date()
  };

  switch (newStatus) {
    case 'active':
      updates.actual_start = metadata.actual_start || new Date();
      break;

    case 'completed':
      updates.actual_end = metadata.actual_end || new Date();
      updates.post_use_condition = metadata.post_use_condition || '';
      // Calculate overtime if applicable
      if (booking.booking_end) {
        const expectedEnd = new Date(booking.booking_end);
        const actualEnd = new Date(updates.actual_end);
        if (actualEnd > expectedEnd) {
          const overtimeMs = actualEnd - expectedEnd;
          const overtimeHours = Math.ceil(overtimeMs / (1000 * 60 * 60));
          updates.overtime_hours = overtimeHours;
          // Get venue overtime rate
          const venue = getSheetDataFiltered('Venues', { venue_id: booking.venue_id })[0];
          const overtimeRate = venue ? (parseFloat(venue.overtime_hourly_rate) || parseFloat(venue.hourly_rate) || 0) : 0;
          updates.overtime_fee = Math.round(overtimeHours * overtimeRate);
        }
      }
      // Recalculate total
      recalculateVenueBooking(bookingId, updates);
      break;

    case 'cancelled':
      updates.cancellation_date = new Date();
      updates.cancellation_reason = metadata.reason || '';
      updates.cancellation_fee = metadata.cancellation_fee || 0;
      break;
  }

  updateSheetRow('Venue_Bookings', 'booking_id', bookingId, updates);
  return true;
}

/**
 * 重新計算場地預約金額
 * @param {string} bookingId
 * @param {Object} additionalUpdates - 額外更新（如超時費）
 */
function recalculateVenueBooking(bookingId, additionalUpdates = {}) {
  const booking = getSheetDataFiltered('Venue_Bookings', { booking_id: bookingId })[0];
  if (!booking) return;

  const unitRate = parseFloat(booking.unit_rate) || 0;
  const rateQty = parseFloat(booking.rate_quantity) || 1;
  const subtotal = Math.round(unitRate * rateQty);
  const discountAmount = parseFloat(booking.discount_amount) || 0;
  const overtimeFee = parseFloat(additionalUpdates.overtime_fee || booking.overtime_fee) || 0;
  const taxRate = parseFloat(booking.tax_rate) || 0.05;

  const taxableAmount = subtotal - discountAmount + overtimeFee;
  const taxAmount = Math.round(taxableAmount * taxRate);
  const totalAmount = taxableAmount + taxAmount;

  // Get service items for this booking
  const services = getSheetDataFiltered('Service_Items', { booking_id: bookingId })
    .filter(s => !s.is_deleted);
  const serviceTotal = services.reduce((sum, s) => sum + (parseFloat(s.line_total) || 0), 0);

  const updates = {
    subtotal: subtotal,
    overtime_fee: overtimeFee,
    tax_amount: Math.round((taxableAmount + serviceTotal) * taxRate),
    total_amount: taxableAmount + serviceTotal + Math.round((taxableAmount + serviceTotal) * taxRate),
    updated_at: new Date(),
    ...additionalUpdates
  };

  updateSheetRow('Venue_Bookings', 'booking_id', bookingId, updates);
  return updates;
}

/**
 * 計算場地預約費用明細
 * @param {string} bookingId
 * @return {Object} 費用明細
 */
function calculateVenueBookingBreakdown(bookingId) {
  const booking = getSheetDataFiltered('Venue_Bookings', { booking_id: bookingId })[0];
  if (!booking) throw new Error('找不到場地預約: ' + bookingId);

  const venue = getSheetDataFiltered('Venues', { venue_id: booking.venue_id })[0];
  const services = getSheetDataFiltered('Service_Items', { booking_id: bookingId })
    .filter(s => !s.is_deleted);
  const payments = getSheetDataFiltered('Payments', { booking_id: bookingId })
    .filter(p => !p.is_deleted);

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
    subtotal: subtotal,
    discount_amount: discountAmount,
    overtime_fee: overtimeFee,
    service_total: serviceTotal,
    services: services,
    taxable_amount: taxableAmount,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    deposit_amount: parseFloat(booking.deposit_amount) || 0,
    paid_amount: paidAmount,
    outstanding: Math.max(0, totalAmount - paidAmount)
  };
}

/**
 * 檢查場地在指定時段是否可用
 * @param {string} venueId
 * @param {string} startTime - ISO datetime
 * @param {string} endTime - ISO datetime
 * @param {string} excludeBookingId - 排除的預約 ID（編輯時用）
 * @return {boolean}
 */
function checkVenueAvailability(venueId, startTime, endTime, excludeBookingId) {
  const bookings = getSheetData('Venue_Bookings').filter(b =>
    !b.is_deleted &&
    b.venue_id === venueId &&
    !['cancelled', 'completed'].includes(b.status) &&
    b.booking_id !== excludeBookingId
  );

  const reqStart = new Date(startTime);
  const reqEnd = new Date(endTime);

  return !bookings.some(b => {
    const bStart = new Date(b.booking_start);
    const bEnd = new Date(b.booking_end);
    return bStart < reqEnd && bEnd > reqStart; // overlap check
  });
}

/**
 * 取得場地在指定日期範圍的預約
 * @param {string} venueId
 * @param {string} startDate
 * @param {string} endDate
 * @return {Array}
 */
function getVenueSchedule(venueId, startDate, endDate) {
  const bookings = getSheetData('Venue_Bookings').filter(b =>
    !b.is_deleted &&
    b.venue_id === venueId &&
    b.status !== 'cancelled'
  );

  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59);

  return bookings.filter(b => {
    const bStart = new Date(b.booking_start);
    const bEnd = new Date(b.booking_end);
    return bStart <= rangeEnd && bEnd >= rangeStart;
  });
}

// ==================== OVERDUE RULES ====================

function getOverdueRules(filters = {}) {
  return getSheetDataFiltered('Overdue_Rules', filters).filter(r => !r.is_deleted);
}

function createOverdueRule(ruleData) {
  requirePermission('manage_rules', '無權限建立逾期規則');
  ruleData.overdue_rule_id = generateNextId('Overdue_Rules', 'overdue_rule_id', 'OR');
  ruleData.active = true;
  ruleData.is_deleted = false;

  return appendSheetRow('Overdue_Rules', ruleData);
}

function updateOverdueRule(ruleId, updates) {
  requirePermission('manage_rules', '無權限編輯逾期規則');
  return updateSheetRow('Overdue_Rules', 'overdue_rule_id', ruleId, updates);
}

// ==================== WEAR TOLERANCE ====================

function getWearTolerance(filters = {}) {
  return getSheetDataFiltered('Wear_Tolerance', filters).filter(r => !r.is_deleted);
}

function createWearTolerance(toleranceData) {
  requirePermission('manage_rules', '無權限建立磨損容許');
  toleranceData.tolerance_id = generateNextId('Wear_Tolerance', 'tolerance_id', 'WT');
  toleranceData.is_deleted = false;

  return appendSheetRow('Wear_Tolerance', toleranceData);
}

function updateWearTolerance(toleranceId, updates) {
  requirePermission('manage_rules', '無權限編輯磨損容許');
  return updateSheetRow('Wear_Tolerance', 'tolerance_id', toleranceId, updates);
}

// ==================== PRINT_TEMPLATES ====================

function getPrintTemplates(filters = {}) {
  return getSheetDataFiltered('Print_Templates', filters).filter(r => !r.is_deleted);
}

function createPrintTemplate(templateData) {
  requirePermission('manage_rules', '無權限建立列印範本');
  templateData.template_id = generateNextId('Print_Templates', 'template_id', 'TPL');
  templateData.created_at = new Date();
  templateData.updated_at = new Date();
  templateData.active = true;
  templateData.is_deleted = false;

  return appendSheetRow('Print_Templates', templateData);
}
