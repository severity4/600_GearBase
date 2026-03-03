/**
 * API Layer - Data access functions for Google Sheets
 * Generic CRUD operations and data retrieval
 */

/**
 * Get all data from a sheet as array of objects
 * @param {string} sheetName - Name of the sheet
 * @return {Array} Array of objects with headers as keys
 */
function getSheetData(sheetName) {
  try {
    const sheet = SPREADSHEET.getSheetByName(sheetName);
    if (!sheet) {
      logError('getSheetData', new Error(`找不到工作表: ${sheetName}`), 'warning', { sheetName });
      return [];
    }

    const range = sheet.getDataRange();
    const values = range.getValues();

    if (values.length === 0) return [];

    const headers = values[0];
    const data = [];

    for (let i = 1; i < values.length; i++) {
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        const header = String(headers[j]).toLowerCase().trim();
        if (!header) continue;
        const value = values[i][j];
        row[header] = formatCellValue(value);
      }
      data.push(row);
    }

    return data;
  } catch (error) {
    logError('getSheetData', error, 'error', { sheetName });
    return [];
  }
}

/**
 * Get filtered data from a sheet
 * @param {string} sheetName - Name of the sheet
 * @param {Object} filters - Filter object {columnName: value, ...}
 * @return {Array} Filtered array of objects
 */
function getSheetDataFiltered(sheetName, filters = {}) {
  const data = getSheetData(sheetName);

  if (Object.keys(filters).length === 0) {
    return data;
  }

  return data.filter(row => {
    for (const [key, value] of Object.entries(filters)) {
      const lowerKey = key.toLowerCase().trim();
      if (String(row[lowerKey] || '').toLowerCase() !== String(value || '').toLowerCase()) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Append a new row to a sheet
 * @param {string} sheetName - Name of the sheet
 * @param {Object} rowData - Object with column names as keys
 * @return {boolean} Success status
 */
function appendSheetRow(sheetName, rowData) {
  try {
    const sheet = SPREADSHEET.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }

    const range = sheet.getDataRange();
    const headers = range.getValues()[0];

    const newRow = [];
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i]).toLowerCase().trim();
      if (!header) {
        newRow.push('');
        continue;
      }
      const value = rowData.hasOwnProperty(header) ? rowData[header] : '';
      newRow.push(value !== null && value !== undefined ? value : '');
    }

    sheet.appendRow(newRow);
    try { CacheService.getScriptCache().remove('dashboardStats'); } catch (_) {}
    return true;
  } catch (error) {
    logError('appendSheetRow', error, 'error', { sheetName, keys: Object.keys(rowData || {}) });
    throw error;
  }
}

/**
 * Update a specific row in a sheet
 * @param {string} sheetName - Name of the sheet
 * @param {string} idColumn - Column name that contains the ID
 * @param {string} idValue - The ID value to match
 * @param {Object} updates - Object with columns to update
 * @return {boolean} Success status
 */
function updateSheetRow(sheetName, idColumn, idValue, updates) {
  try {
    const sheet = SPREADSHEET.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }

    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];

    const idColIndex = findHeaderIndex(headers, idColumn);
    if (idColIndex === -1) {
      throw new Error(`Column not found: ${idColumn}`);
    }

    // Find the row with matching ID
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idColIndex]).trim() === String(idValue).trim()) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error(`No row found with ${idColumn} = ${idValue}`);
    }

    // Update the row
    for (const [key, value] of Object.entries(updates)) {
      const colIndex = findHeaderIndex(headers, key);
      if (colIndex !== -1) {
        values[rowIndex][colIndex] = value;
      }
    }

    // Set the updated values back
    range.setValues(values);
    try { CacheService.getScriptCache().remove('dashboardStats'); } catch (_) {}
    return true;
  } catch (error) {
    logError('updateSheetRow', error, 'error', { sheetName, idColumn, idValue });
    throw error;
  }
}

/**
 * Soft delete a row (set is_deleted to true)
 * @param {string} sheetName - Name of the sheet
 * @param {string} idColumn - Column name that contains the ID
 * @param {string} idValue - The ID value to match
 * @return {boolean} Success status
 */
function deleteSheetRow(sheetName, idColumn, idValue) {
  try {
    return updateSheetRow(sheetName, idColumn, idValue, { is_deleted: true });
  } catch (error) {
    logError('deleteSheetRow', error, 'error', { sheetName, idColumn, idValue });
    throw error;
  }
}

/**
 * Find header column index (case-insensitive)
 * @param {Array} headers - Array of header names
 * @param {string} headerName - Name of the header to find
 * @return {number} Index of the header, -1 if not found
 */
function findHeaderIndex(headers, headerName) {
  const lowerName = String(headerName).toLowerCase().trim();
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i]).toLowerCase().trim() === lowerName) {
      return i;
    }
  }
  return -1;
}

/**
 * Format cell value based on type
 * @param {*} value - Cell value
 * @return {*} Formatted value
 */
function formatCellValue(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (value instanceof Date) {
    // Convert Date to ISO string for google.script.run serialization.
    // Returning raw Date objects in arrays causes the entire return value
    // to silently become null on the client side.
    return value.toISOString();
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return String(value);
}

/**
 * ==================== SEARCH & FILTER UTILITIES ====================
 */

/**
 * Search equipment by name or type
 * @param {string} query - Search query
 * @return {Array} Matching equipment types and units
 */
function searchEquipment(query) {
  const lowerQuery = query.toLowerCase();
  const types = getSheetData('Equipment_Types').filter(t => !isSoftDeleted_(t));
  const units = getSheetData('Equipment_Units').filter(u => !isSoftDeleted_(u));

  const matchingTypes = types.filter(t =>
    (t.type_name && t.type_name.toLowerCase().includes(lowerQuery)) ||
    (t.category && t.category.toLowerCase().includes(lowerQuery))
  );

  const matchingUnits = units.filter(u =>
    (u.internal_code && u.internal_code.toLowerCase().includes(lowerQuery)) ||
    (u.serial_number && u.serial_number.toLowerCase().includes(lowerQuery))
  );

  return { types: matchingTypes, units: matchingUnits };
}

/**
 * Get available equipment for a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @return {Array} Available equipment units
 */
function getAvailableEquipment(startDate, endDate) {
  const allUnits = getSheetData('Equipment_Units').filter(u => !isSoftDeleted_(u) && u.status === 'available');
  const rentals = getSheetData('Rentals').filter(r => !isSoftDeleted_(r) && r.status !== 'cancelled');
  const rentalItems = getSheetData('Rental_Items').filter(ri => !ri.is_deleted);

  const bookedUnitIds = new Set();
  rentals.forEach(rental => {
    const rentalStart = new Date(rental.start_date);
    const rentalEnd = new Date(rental.end_date);
    const requestStart = new Date(startDate);
    const requestEnd = new Date(endDate);

    if (rentalStart <= requestEnd && rentalEnd >= requestStart) {
      const itemsInRental = rentalItems.filter(ri => ri.rental_id === rental.rental_id);
      itemsInRental.forEach(item => bookedUnitIds.add(item.unit_id));
    }
  });

  return allUnits.filter(u => !bookedUnitIds.has(u.unit_id));
}

/**
 * Get equipment with current location info
 * @return {Array} Equipment units with location details
 */
function getEquipmentWithLocations() {
  const units = getSheetData('Equipment_Units').filter(u => !isSoftDeleted_(u));
  const locations = getSheetData('Storage_Locations');

  return units.map(unit => {
    const location = locations.find(l => l.location_id === unit.location_id);
    return {
      ...unit,
      location_name: location ? location.location_name : '未分配'
    };
  });
}

/**
 * Calculate total rental revenue
 * @param {string} startDate - Optional start date filter
 * @param {string} endDate - Optional end date filter
 * @return {number} Total revenue
 */
function calculateTotalRevenue(startDate = null, endDate = null) {
  let rentals = getSheetData('Rentals').filter(r => !isSoftDeleted_(r) && r.status === 'returned');

  if (startDate) {
    rentals = rentals.filter(r => new Date(r.return_date) >= new Date(startDate));
  }

  if (endDate) {
    rentals = rentals.filter(r => new Date(r.return_date) <= new Date(endDate));
  }

  return rentals.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
}

/**
 * Get customer rental history
 * @param {string} customerId - Customer ID
 * @return {Array} Customer's rentals
 */
function getCustomerRentalHistory(customerId) {
  const rentals = getSheetData('Rentals').filter(r =>
    !isSoftDeleted_(r) && r.customer_id === customerId
  );

  return rentals.map(rental => {
    const items = getSheetData('Rental_Items').filter(ri =>
      !ri.is_deleted && ri.rental_id === rental.rental_id
    );
    return {
      ...rental,
      items: items
    };
  });
}

/**
 * Get equipment maintenance history
 * @param {string} unitId - Equipment unit ID
 * @return {Array} Maintenance logs for the unit
 */
function getEquipmentMaintenanceHistory(unitId) {
  return getSheetData('Maintenance_Logs').filter(log =>
    !log.is_deleted && log.unit_id === unitId
  );
}

/**
 * Get equipment usage statistics
 * @return {Array} Usage stats per equipment type
 */
function getEquipmentUsageStats() {
  const types = getSheetData('Equipment_Types').filter(t => !isSoftDeleted_(t));
  const units = getSheetData('Equipment_Units').filter(u => !isSoftDeleted_(u));
  const rentals = getSheetData('Rentals').filter(r => !isSoftDeleted_(r) && r.status === 'returned');
  const rentalItems = getSheetData('Rental_Items').filter(ri => !ri.is_deleted);

  return types.map(type => {
    const typeUnits = units.filter(u => u.type_id === type.type_id);
    const usageCount = rentalItems.filter(ri =>
      typeUnits.some(u => u.unit_id === ri.unit_id)
    ).length;

    return {
      type_id: type.type_id,
      type_name: type.type_name,
      category: type.category,
      total_units: typeUnits.length,
      usage_count: usageCount,
      revenue: typeUnits.length > 0 ? (type.daily_rate * usageCount) : 0
    };
  });
}

/**
 * Get overdue rentals
 * @return {Array} Rentals that are overdue
 */
function getOverdueRentals() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return getSheetData('Rentals').filter(r =>
    !isSoftDeleted_(r) &&
    ['active', 'overdue'].includes(r.status) &&
    new Date(r.rental_end || r.end_date) < today
  );
}

/**
 * Get rental amount calculation
 * @param {string} rentalId - Rental ID
 * @return {Object} Rental calculation breakdown
 */
function calculateRentalTotal(rentalId) {
  const rental = getSheetDataFiltered('Rentals', { rental_id: rentalId })[0];
  if (!rental) return null;

  const items = getSheetDataFiltered('Rental_Items', { rental_id: rentalId });
  const discounts = getSheetDataFiltered('Discount_Rules', { rental_id: rentalId });

  let subtotal = 0;
  items.forEach(item => {
    const days = calculateRentalDays(rental.start_date, rental.end_date);
    const rate = parseFloat(item.daily_rate || 0);
    subtotal += rate * days;
  });

  let totalDiscount = 0;
  discounts.forEach(discount => {
    totalDiscount += parseFloat(discount.discount_amount || 0);
  });

  const total = subtotal - totalDiscount;

  return {
    rental_id: rentalId,
    subtotal: subtotal,
    discount: totalDiscount,
    total: total,
    paid: parseFloat(rental.paid_amount || 0),
    outstanding: Math.max(0, total - parseFloat(rental.paid_amount || 0))
  };
}

/**
 * Get available venues (active, not deleted)
 * @return {Array} Active venues
 */
function getActiveVenues() {
  return getSheetData('Venues').filter(v => {
    const deleted = v.is_deleted === true || v.is_deleted === 'true' || v.is_deleted === 'TRUE' || v.is_deleted === '1';
    const inactive = v.active === false || v.active === 'false' || v.active === 'FALSE' || v.active === '0';
    return !deleted && !inactive;
  });
}

/**
 * Search venues by name or type
 * @param {string} query
 * @return {Array}
 */
function searchVenues(query) {
  const lowerQuery = query.toLowerCase();
  return getActiveVenues().filter(v =>
    (v.name && v.name.toLowerCase().includes(lowerQuery)) ||
    (v.venue_type && v.venue_type.toLowerCase().includes(lowerQuery)) ||
    (v.amenities && v.amenities.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get available venues for a given time range
 * @param {string} startTime - ISO datetime
 * @param {string} endTime - ISO datetime
 * @return {Array} Venues with availability info
 */
function getAvailableVenues(startTime, endTime) {
  const venues = getActiveVenues();
  return venues.filter(v => checkVenueAvailability(v.venue_id, startTime, endTime));
}

/**
 * Calculate venue booking revenue
 * @param {string} startDate - Optional
 * @param {string} endDate - Optional
 * @return {number}
 */
function calculateVenueRevenue(startDate, endDate) {
  let bookings = getSheetData('Venue_Bookings').filter(b =>
    !isSoftDeleted_(b) && b.status === 'completed'
  );

  if (startDate) {
    bookings = bookings.filter(b => new Date(b.booking_end) >= new Date(startDate));
  }
  if (endDate) {
    bookings = bookings.filter(b => new Date(b.booking_end) <= new Date(endDate));
  }

  return bookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
}

/**
 * Get customer venue booking history
 * @param {string} customerId
 * @return {Array}
 */
function getCustomerVenueBookings(customerId) {
  return getSheetData('Venue_Bookings').filter(b =>
    !isSoftDeleted_(b) && b.customer_id === customerId
  );
}

/**
 * Generate inventory discrepancy report
 * @return {Array} Items with differences between physical and system count
 */
function getInventoryDiscrepancies() {
  const allUnits = getSheetData('Equipment_Units').filter(u => !isSoftDeleted_(u));
  const lastStocktake = getSheetData('Stocktake_Results')
    .filter(s => !isSoftDeleted_(s))
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];

  if (!lastStocktake) return [];

  const discrepancies = [];
  allUnits.forEach(unit => {
    const result = getSheetDataFiltered('Stocktake_Results', {
      unit_id: unit.unit_id,
      stocktake_plan_id: lastStocktake.stocktake_plan_id
    })[0];

    if (result && result.physical_count !== unit.quantity) {
      discrepancies.push({
        unit_id: unit.unit_id,
        type_id: unit.type_id,
        internal_code: unit.internal_code,
        system_count: unit.quantity,
        physical_count: result.physical_count,
        variance: result.physical_count - unit.quantity,
        last_checked: result.recorded_at
      });
    }
  });

  return discrepancies;
}

/**
 * Get customer credit summary
 * @param {string} customerId - Customer ID
 * @return {Object} Credit balance info
 */
function getCustomerCreditInfo(customerId) {
  const customer = getSheetDataFiltered('Customers', { customer_id: customerId })[0];
  if (!customer) return null;

  const notes = getSheetDataFiltered('Credit_Notes', { customer_id: customerId })
    .filter(n => !isSoftDeleted_(n));

  const totalCredit = notes.reduce((sum, note) => sum + parseFloat(note.amount || 0), 0);

  return {
    customer_id: customerId,
    company_name: customer.company_name,
    current_balance: parseFloat(customer.credit_balance || 0),
    total_issued: totalCredit,
    notes: notes
  };
}

/**
 * ==================== CUSTOMER-FACING API ====================
 */

/**
 * Get equipment catalog with availability count per type
 * Groups by equipment type and counts available units
 * @return {Array} Equipment types with availability info
 */
function getEquipmentCatalog() {
  const types = getSheetData('Equipment_Types').filter(t => !isSoftDeleted_(t) && t.active !== false);
  const units = getSheetData('Equipment_Units').filter(u => !isSoftDeleted_(u));
  const bindings = getSheetData('Accessory_Bindings').filter(b => !isSoftDeleted_(b));

  return types.map(type => {
    const typeUnits = units.filter(u => u.type_id === type.type_id);
    const available = typeUnits.filter(u => u.status === 'available').length;
    const total = typeUnits.length;

    // Get accessories for this type
    const accessories = bindings
      .filter(b => b.parent_type_id === type.type_id)
      .map(b => {
        const accType = types.find(t => t.type_id === b.accessory_type_id);
        return {
          type_id: b.accessory_type_id,
          type_name: accType ? accType.type_name : b.accessory_type_id,
          binding_type: b.binding_type,
          notes: b.notes || ''
        };
      });

    return {
      type_id: type.type_id,
      type_name: type.type_name,
      category: type.category || '',
      sub_category: type.sub_category || '',
      brand: type.brand || '',
      model: type.model || '',
      daily_rate: parseFloat(type.daily_rate || 0),
      replacement_value: parseFloat(type.replacement_value || 0),
      deposit_required: parseFloat(type.deposit_required || 0),
      is_consumable: type.is_consumable === true || type.is_consumable === 'true',
      description: type.description || '',
      total_units: total,
      available_units: available,
      accessories: accessories
    };
  });
}

/**
 * Get venue schedule for customer-facing calendar
 * @param {string} venueId
 * @param {string} yearMonth - YYYY-MM format
 * @return {Object} {venue, bookings: [{date, slots}]}
 */
function getVenueMonthlySchedule(venueId, yearMonth) {
  const venue = getSheetData('Venues').find(v => v.venue_id === venueId && !isSoftDeleted_(v));
  if (!venue) return { venue: null, booked_dates: [] };

  const [year, month] = yearMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const bookings = getSheetData('Venue_Bookings').filter(b =>
    !isSoftDeleted_(b) &&
    b.venue_id === venueId &&
    b.status !== 'cancelled'
  );

  const bookedDates = [];
  bookings.forEach(b => {
    const bStart = new Date(b.booking_start);
    const bEnd = new Date(b.booking_end);

    // Iterate through each day of this booking
    const cursor = new Date(Math.max(bStart.getTime(), firstDay.getTime()));
    cursor.setHours(0, 0, 0, 0);
    const endLimit = new Date(Math.min(bEnd.getTime(), lastDay.getTime()));
    endLimit.setHours(23, 59, 59);

    while (cursor <= endLimit) {
      const dateStr = Utilities.formatDate(cursor, 'Asia/Taipei', 'yyyy-MM-dd');
      // Check if fully booked for the day (simplified: mark as booked if any booking exists)
      if (!bookedDates.includes(dateStr)) {
        bookedDates.push(dateStr);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return {
    venue: {
      venue_id: venue.venue_id,
      name: venue.name,
      available_start_time: venue.available_start_time || '09:00',
      available_end_time: venue.available_end_time || '22:00'
    },
    booked_dates: bookedDates.sort()
  };
}

/**
 * Send a verification code to the customer's email for lookup
 * Uses CacheService to store code with 10-minute expiry
 * @param {string} email
 * @return {Object} {success, message}
 */
function sendLookupVerificationCode(email) {
  if (!email || email.trim() === '') {
    return { success: false, message: '請輸入 Email' };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cache = CacheService.getScriptCache();

  // Rate limiting: max 1 request per 60 seconds per email
  const rateLimitKey = 'lookup_rate_' + cleanEmail;
  if (cache.get(rateLimitKey)) {
    return { success: false, message: '請稍後再試，每 60 秒僅能發送一次驗證碼' };
  }

  // Check customer exists
  const customer = getSheetData('Customers').find(c =>
    !isSoftDeleted_(c) && c.email && c.email.toLowerCase() === cleanEmail
  );

  // Always return success message to prevent email enumeration
  const successMessage = '若此 Email 已登記，驗證碼將寄送至您的信箱';

  if (!customer) {
    // Set rate limit even for non-existent emails to prevent enumeration timing attacks
    cache.put(rateLimitKey, '1', 60);
    return { success: true, message: successMessage };
  }

  // Generate 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // Store in CacheService (10 min expiry)
  cache.put('lookup_code_' + cleanEmail, code, 600);
  // Set rate limit
  cache.put(rateLimitKey, '1', 60);

  // Send email
  try {
    MailApp.sendEmail({
      to: cleanEmail,
      subject: '【映奧創意】查詢驗證碼',
      body: `${customer.name} 您好，\n\n您的查詢驗證碼為：${code}\n\n此驗證碼將在 10 分鐘後失效。\n如非本人操作，請忽略此信。\n\n映奧創意工作室`
    });
  } catch (e) {
    Logger.log('sendLookupVerificationCode email error: ' + e.message);
  }

  return { success: true, message: successMessage };
}

/**
 * Verify the lookup code and return rental/booking data
 * @param {string} email
 * @param {string} code
 * @return {Object} Lookup results or error
 */
function verifyAndLookup(email, code) {
  if (!email || !code) {
    return { verified: false, message: '請輸入 Email 和驗證碼' };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  const cache = CacheService.getScriptCache();

  // Rate limiting: max 5 attempts per email per 10 minutes
  const attemptKey = 'lookup_attempts_' + cleanEmail;
  const attempts = parseInt(cache.get(attemptKey) || '0');
  if (attempts >= 5) {
    return { verified: false, message: '嘗試次數過多，請 10 分鐘後再試' };
  }

  // Check code from cache
  const storedCode = cache.get('lookup_code_' + cleanEmail);

  if (!storedCode) {
    cache.put(attemptKey, String(attempts + 1), 600);
    return { verified: false, message: '驗證碼已過期，請重新發送' };
  }

  if (storedCode !== cleanCode) {
    cache.put(attemptKey, String(attempts + 1), 600);
    return { verified: false, message: '驗證碼不正確' };
  }

  // Code is valid — remove it (one-time use)
  cache.remove('lookup_code_' + cleanEmail);

  // Find customer
  const allCustomers = getSheetData('Customers').filter(c => !isSoftDeleted_(c));
  const customer = allCustomers.find(c => c.email && c.email.toLowerCase() === cleanEmail);
  if (!customer) {
    return { verified: true, found: false, message: '查無客戶紀錄' };
  }

  // Gather data
  const allRentals = getSheetData('Rentals').filter(r => !isSoftDeleted_(r));
  const rentalItems = getSheetData('Rental_Items').filter(ri => !ri.is_deleted);
  const types = getSheetData('Equipment_Types');
  const bookings = getSheetData('Venue_Bookings').filter(b => !isSoftDeleted_(b));
  const venues = getSheetData('Venues');

  const typeMap = {};
  types.forEach(t => { typeMap[t.type_id] = t; });
  const venueMap = {};
  venues.forEach(v => { venueMap[v.venue_id] = v; });

  const statusLabels = {
    draft: '草稿', reserved: '已預約', active: '進行中',
    overdue: '逾期', returned: '已歸還', completed: '已完成', cancelled: '已取消'
  };

  const custRentals = allRentals
    .filter(r => r.customer_id === customer.customer_id && r.status !== 'cancelled')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20);

  const custBookings = bookings
    .filter(b => b.customer_id === customer.customer_id && b.status !== 'cancelled')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20);

  return {
    verified: true,
    found: true,
    customer_name: customer.name,
    rentals: custRentals.map(r => {
      const items = rentalItems.filter(ri => ri.rental_id === r.rental_id);
      return {
        rental_id: r.rental_id,
        status: r.status,
        status_label: statusLabels[r.status] || r.status,
        rental_start: r.rental_start || r.start_date,
        rental_end: r.rental_end || r.end_date,
        total_amount: parseFloat(r.total_amount || 0),
        paid_amount: parseFloat(r.paid_amount || 0),
        items: items.map(i => ({
          type_name: (typeMap[i.type_id] || {}).type_name || i.type_id,
          line_total: parseFloat(i.line_total || 0)
        }))
      };
    }),
    bookings: custBookings.map(b => {
      const venue = venueMap[b.venue_id] || {};
      return {
        booking_id: b.booking_id,
        venue_name: venue.name || '',
        status: b.status,
        status_label: statusLabels[b.status] || b.status,
        booking_start: b.booking_start,
        booking_end: b.booking_end,
        total_amount: parseFloat(b.total_amount || 0)
      };
    })
  };
}
