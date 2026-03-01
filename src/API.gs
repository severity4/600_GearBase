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
      Logger.log(`Sheet not found: ${sheetName}`);
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
        const value = values[i][j];
        row[header] = formatCellValue(value);
      }
      data.push(row);
    }

    return data;
  } catch (error) {
    Logger.log(`Error reading sheet ${sheetName}: ${error.toString()}`);
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
      const value = rowData[header] || '';
      newRow.push(value);
    }

    sheet.appendRow(newRow);
    Logger.log(`Row appended to ${sheetName}`);
    return true;
  } catch (error) {
    Logger.log(`Error appending row to ${sheetName}: ${error.toString()}`);
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
    Logger.log(`Row updated in ${sheetName}: ${idValue}`);
    return true;
  } catch (error) {
    Logger.log(`Error updating row in ${sheetName}: ${error.toString()}`);
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
    Logger.log(`Error deleting row from ${sheetName}: ${error.toString()}`);
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
    return value;
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
  const types = getSheetData('Equipment_Types').filter(t => !t.is_deleted);
  const units = getSheetData('Equipment_Units').filter(u => !u.is_deleted);

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
  const allUnits = getSheetData('Equipment_Units').filter(u => !u.is_deleted && u.status === 'available');
  const rentals = getSheetData('Rentals').filter(r => !r.is_deleted && r.status !== 'cancelled');
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
  const units = getSheetData('Equipment_Units').filter(u => !u.is_deleted);
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
  let rentals = getSheetData('Rentals').filter(r => !r.is_deleted && r.status === 'returned');

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
    !r.is_deleted && r.customer_id === customerId
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
  const types = getSheetData('Equipment_Types').filter(t => !t.is_deleted);
  const units = getSheetData('Equipment_Units').filter(u => !u.is_deleted);
  const rentals = getSheetData('Rentals').filter(r => !r.is_deleted && r.status === 'returned');
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
    !r.is_deleted &&
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
  return getSheetData('Venues').filter(v =>
    !v.is_deleted && (v.active !== false && v.active !== 'false')
  );
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
    !b.is_deleted && b.status === 'completed'
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
    !b.is_deleted && b.customer_id === customerId
  );
}

/**
 * Generate inventory discrepancy report
 * @return {Array} Items with differences between physical and system count
 */
function getInventoryDiscrepancies() {
  const allUnits = getSheetData('Equipment_Units').filter(u => !u.is_deleted);
  const lastStocktake = getSheetData('Stocktake_Results')
    .filter(s => !s.is_deleted)
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
    .filter(n => !n.is_deleted);

  const totalCredit = notes.reduce((sum, note) => sum + parseFloat(note.amount || 0), 0);

  return {
    customer_id: customerId,
    company_name: customer.company_name,
    current_balance: parseFloat(customer.credit_balance || 0),
    total_issued: totalCredit,
    notes: notes
  };
}
