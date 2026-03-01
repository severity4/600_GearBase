/**
 * 映奧創意工作室 - 器材管理租借系統
 * Equipment Management & Rental System
 * Main Application Code
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SPREADSHEET = SpreadsheetApp.getActiveSpreadsheet();

// Category codes mapping
const CATEGORY_CODES = {
  'camera': 'CAM',
  'lens': 'LEN',
  'audio': 'AUD',
  'lighting': 'LGT',
  'monitor': 'MON',
  'transmission': 'TRX',
  'tripod': 'TRI',
  'motion': 'MOT',
  'teleprompter': 'TLP',
  'accessory': 'ACC',
  'prop_furniture': 'PROP-F',
  'prop_wardrobe': 'PROP-W',
  'prop_set': 'PROP-S',
  'prop_fx': 'PROP-X',
  'prop_vehicle': 'PROP-V',
  'prop_other': 'PROP-O'
};

/**
 * Main entry point for the web app
 */
function doGet(e) {
  const page = e.parameter.page || 'dashboard';
  const mode = e.parameter.mode || 'staff';

  if (mode === 'customer') {
    return HtmlService.createHtmlOutput(include('CustomerApp'))
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Staff mode - return staff app
  return HtmlService.createHtmlOutput(include('StaffApp'))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Include HTML/CSS/JS files
 */
function include(filename) {
  return HtmlService.createHtmlOutput(
    SpreadsheetApp.getActiveSpreadsheet()
      .getRangeByName(filename)
      .getValue()
  ).getContent();
}

/**
 * ==================== AUTO-NUMBERING FUNCTIONS ====================
 */

/**
 * Generate internal equipment code (e.g., CAM-001)
 */
function generateInternalCode(categoryKey) {
  const prefix = CATEGORY_CODES[categoryKey] || 'GEN';
  const units = getSheetData('Equipment_Units');

  const codesByPrefix = units
    .filter(u => u.internal_code && u.internal_code.startsWith(prefix))
    .map(u => {
      const match = u.internal_code.match(/(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });

  const nextNum = (Math.max(...codesByPrefix, 0) + 1).toString().padStart(3, '0');
  return `${prefix}-${nextNum}`;
}

/**
 * Generate rental ID (RNT-YYYYMMDD-000X)
 */
function generateRentalId() {
  const today = new Date();
  const dateStr = Utilities.formatDate(today, 'Asia/Taipei', 'yyyyMMdd');

  const rentals = getSheetData('Rentals');
  const todayRentals = rentals.filter(r => r.rental_id && r.rental_id.includes(dateStr));

  const nextNum = (todayRentals.length + 1).toString().padStart(4, '0');
  return `RNT-${dateStr}-${nextNum}`;
}

/**
 * Generic next ID generator
 */
function generateNextId(sheetName, idField) {
  const data = getSheetData(sheetName);
  const ids = data
    .filter(row => row[idField])
    .map(row => {
      const match = String(row[idField]).match(/(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });

  return Math.max(...ids, 0) + 1;
}

/**
 * ==================== EQUIPMENT TYPE FUNCTIONS ====================
 */

function getEquipmentTypes() {
  return getSheetData('Equipment_Types');
}

function createEquipmentType(typeData) {
  const validation = validateEquipmentType(typeData);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  typeData.type_id = 'TYPE-' + generateNextId('Equipment_Types', 'type_id');
  typeData.created_at = new Date();
  typeData.is_deleted = false;

  return appendSheetRow('Equipment_Types', typeData);
}

function updateEquipmentType(typeId, updates) {
  return updateSheetRow('Equipment_Types', 'type_id', typeId, updates);
}

function deleteEquipmentType(typeId) {
  return updateSheetRow('Equipment_Types', 'type_id', typeId, { is_deleted: true });
}

function validateEquipmentType(data) {
  const errors = [];
  if (!data.type_name || data.type_name.trim() === '') errors.push('器材類型名稱必填');
  if (!data.category || data.category.trim() === '') errors.push('分類必填');
  if (data.daily_rate && isNaN(parseFloat(data.daily_rate))) errors.push('日租價格必須為數字');

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * ==================== EQUIPMENT UNIT FUNCTIONS ====================
 */

function getEquipmentUnits(filters = {}) {
  return getSheetDataFiltered('Equipment_Units', filters);
}

function createEquipmentUnit(unitData) {
  const validation = validateEquipmentUnit(unitData);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  const category = unitData.category || 'accessory';
  unitData.internal_code = generateInternalCode(category);
  unitData.unit_id = 'UNIT-' + generateNextId('Equipment_Units', 'unit_id');
  unitData.created_at = new Date();
  unitData.is_deleted = false;
  unitData.status = 'available';

  return appendSheetRow('Equipment_Units', unitData);
}

function updateEquipmentUnit(unitId, updates) {
  return updateSheetRow('Equipment_Units', 'unit_id', unitId, updates);
}

function deleteEquipmentUnit(unitId) {
  return updateSheetRow('Equipment_Units', 'unit_id', unitId, { is_deleted: true });
}

function validateEquipmentUnit(data) {
  const errors = [];
  if (!data.type_id || data.type_id.trim() === '') errors.push('器材類型必填');
  if (!data.category || data.category.trim() === '') errors.push('分類必填');
  if (data.serial_number && getSheetDataFiltered('Equipment_Units',
    { serial_number: data.serial_number }).length > 0) {
    errors.push('序號已存在');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * ==================== CUSTOMER FUNCTIONS ====================
 */

function getCustomers(filters = {}) {
  return getSheetDataFiltered('Customers', filters);
}

function createCustomer(customerData) {
  const validation = validateCustomer(customerData);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  customerData.customer_id = 'CUST-' + generateNextId('Customers', 'customer_id');
  customerData.created_at = new Date();
  customerData.is_deleted = false;
  customerData.credit_balance = 0;

  return appendSheetRow('Customers', customerData);
}

function updateCustomer(customerId, updates) {
  return updateSheetRow('Customers', 'customer_id', customerId, updates);
}

function deleteCustomer(customerId) {
  return updateSheetRow('Customers', 'customer_id', customerId, { is_deleted: true });
}

function validateCustomer(data) {
  const errors = [];
  if (!data.company_name || data.company_name.trim() === '') errors.push('公司名稱必填');
  if (!data.contact_person || data.contact_person.trim() === '') errors.push('聯絡人必填');
  if (!data.phone || data.phone.trim() === '') errors.push('電話必填');
  if (!data.email || !isValidEmail(data.email)) errors.push('電子郵件格式不正確');

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * ==================== RENTAL FUNCTIONS ====================
 */

function getRentals(filters = {}) {
  return getSheetDataFiltered('Rentals', filters);
}

function createRental(rentalData) {
  const validation = validateRental(rentalData);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  rentalData.rental_id = generateRentalId();
  rentalData.created_at = new Date();
  rentalData.status = 'draft';
  rentalData.total_amount = 0;
  rentalData.paid_amount = 0;

  return appendSheetRow('Rentals', rentalData);
}

function updateRental(rentalId, updates) {
  return updateSheetRow('Rentals', 'rental_id', rentalId, updates);
}

function validateRental(data) {
  const errors = [];
  if (!data.customer_id || data.customer_id.trim() === '') errors.push('客戶必填');
  if (!data.start_date) errors.push('開始日期必填');
  if (!data.end_date) errors.push('結束日期必填');

  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  if (endDate <= startDate) {
    errors.push('結束日期必須晚於開始日期');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * ==================== RENTAL ITEMS FUNCTIONS ====================
 */

function getRentalItems(rentalId) {
  return getSheetDataFiltered('Rental_Items', { rental_id: rentalId });
}

function createRentalItem(itemData) {
  itemData.rental_item_id = 'ITEM-' + generateNextId('Rental_Items', 'rental_item_id');
  itemData.created_at = new Date();
  itemData.is_deleted = false;

  return appendSheetRow('Rental_Items', itemData);
}

function updateRentalItem(itemId, updates) {
  return updateSheetRow('Rental_Items', 'rental_item_id', itemId, updates);
}

/**
 * ==================== PAYMENT FUNCTIONS ====================
 */

function getPayments(filters = {}) {
  return getSheetDataFiltered('Payments', filters);
}

function createPayment(paymentData) {
  const validation = validatePayment(paymentData);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  paymentData.payment_id = 'PAY-' + generateNextId('Payments', 'payment_id');
  paymentData.payment_date = new Date();
  paymentData.is_deleted = false;

  // Update rental paid amount
  const rental = getSheetDataFiltered('Rentals', { rental_id: paymentData.rental_id })[0];
  if (rental) {
    const newPaidAmount = (parseFloat(rental.paid_amount) || 0) + parseFloat(paymentData.amount);
    updateRental(paymentData.rental_id, { paid_amount: newPaidAmount });
  }

  return appendSheetRow('Payments', paymentData);
}

function validatePayment(data) {
  const errors = [];
  if (!data.rental_id || data.rental_id.trim() === '') errors.push('租借單必填');
  if (!data.amount || isNaN(parseFloat(data.amount))) errors.push('金額必填且為數字');
  if (parseFloat(data.amount) <= 0) errors.push('金額必須大於0');
  if (!data.payment_method || data.payment_method.trim() === '') errors.push('付款方式必填');

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * ==================== MAINTENANCE LOG FUNCTIONS ====================
 */

function getMaintenanceLogs(filters = {}) {
  return getSheetDataFiltered('Maintenance_Logs', filters);
}

function createMaintenanceLog(logData) {
  logData.maintenance_id = 'MAINT-' + generateNextId('Maintenance_Logs', 'maintenance_id');
  logData.logged_at = new Date();
  logData.is_deleted = false;

  return appendSheetRow('Maintenance_Logs', logData);
}

/**
 * ==================== INVENTORY FUNCTIONS ====================
 */

function getInventoryLogs(filters = {}) {
  return getSheetDataFiltered('Inventory_Logs', filters);
}

function createInventoryLog(logData) {
  logData.inventory_log_id = 'INV-' + generateNextId('Inventory_Logs', 'inventory_log_id');
  logData.logged_at = new Date();
  logData.is_deleted = false;

  return appendSheetRow('Inventory_Logs', logData);
}

/**
 * ==================== STOCKTAKE FUNCTIONS ====================
 */

function getStocktakePlans(filters = {}) {
  return getSheetDataFiltered('Stocktake_Plans', filters);
}

function createStocktakePlan(planData) {
  planData.stocktake_plan_id = 'ST-' + generateNextId('Stocktake_Plans', 'stocktake_plan_id');
  planData.created_at = new Date();
  planData.status = 'draft';
  planData.is_deleted = false;

  return appendSheetRow('Stocktake_Plans', planData);
}

function getStocktakeResults(planId) {
  return getSheetDataFiltered('Stocktake_Results', { stocktake_plan_id: planId });
}

function createStocktakeResult(resultData) {
  resultData.stocktake_result_id = 'STR-' + generateNextId('Stocktake_Results', 'stocktake_result_id');
  resultData.recorded_at = new Date();
  resultData.is_deleted = false;

  return appendSheetRow('Stocktake_Results', resultData);
}

/**
 * ==================== STAFF FUNCTIONS ====================
 */

function getStaff(filters = {}) {
  return getSheetDataFiltered('Staff', filters);
}

function createStaff(staffData) {
  staffData.staff_id = 'STAFF-' + generateNextId('Staff', 'staff_id');
  staffData.created_at = new Date();
  staffData.is_deleted = false;

  return appendSheetRow('Staff', staffData);
}

function updateStaff(staffId, updates) {
  return updateSheetRow('Staff', 'staff_id', staffId, updates);
}

/**
 * ==================== DASHBOARD STATISTICS ====================
 */

function getDashboardStats() {
  const equipmentTypes = getSheetData('Equipment_Types').filter(t => !t.is_deleted);
  const equipmentUnits = getSheetData('Equipment_Units').filter(u => !u.is_deleted);
  const customers = getSheetData('Customers').filter(c => !c.is_deleted);
  const rentals = getSheetData('Rentals').filter(r => !r.is_deleted);

  const availableUnits = equipmentUnits.filter(u => u.status === 'available').length;
  const rentedUnits = equipmentUnits.filter(u => u.status === 'rented').length;
  const maintenanceUnits = equipmentUnits.filter(u => u.status === 'maintenance').length;

  const activeRentals = rentals.filter(r => ['draft', 'confirmed', 'in_progress'].includes(r.status)).length;
  const completedRentals = rentals.filter(r => r.status === 'completed').length;

  const totalRevenue = rentals.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0);

  return {
    total_equipment_types: equipmentTypes.length,
    total_equipment_units: equipmentUnits.length,
    available_units: availableUnits,
    rented_units: rentedUnits,
    maintenance_units: maintenanceUnits,
    total_customers: customers.length,
    active_rentals: activeRentals,
    completed_rentals: completedRentals,
    total_revenue: totalRevenue
  };
}

/**
 * ==================== STORAGE LOCATIONS ====================
 */

function getStorageLocations(filters = {}) {
  return getSheetDataFiltered('Storage_Locations', filters);
}

function createStorageLocation(locationData) {
  locationData.location_id = 'LOC-' + generateNextId('Storage_Locations', 'location_id');
  locationData.created_at = new Date();
  locationData.is_deleted = false;

  return appendSheetRow('Storage_Locations', locationData);
}

/**
 * ==================== DISCOUNT RULES ====================
 */

function getDiscountRules(filters = {}) {
  return getSheetDataFiltered('Discount_Rules', filters);
}

function createDiscountRule(ruleData) {
  ruleData.discount_rule_id = 'DISC-' + generateNextId('Discount_Rules', 'discount_rule_id');
  ruleData.created_at = new Date();
  ruleData.is_deleted = false;

  return appendSheetRow('Discount_Rules', ruleData);
}

/**
 * ==================== ACCESSORY BINDINGS ====================
 */

function getAccessoryBindings(filters = {}) {
  return getSheetDataFiltered('Accessory_Bindings', filters);
}

function createAccessoryBinding(bindingData) {
  bindingData.binding_id = 'BIND-' + generateNextId('Accessory_Bindings', 'binding_id');
  bindingData.created_at = new Date();
  bindingData.is_deleted = false;

  return appendSheetRow('Accessory_Bindings', bindingData);
}

/**
 * ==================== DAMAGE RECORDS ====================
 */

function getDamageRecords(filters = {}) {
  return getSheetDataFiltered('Damage_Records', filters);
}

function createDamageRecord(recordData) {
  recordData.damage_id = 'DMG-' + generateNextId('Damage_Records', 'damage_id');
  recordData.created_at = new Date();
  recordData.is_deleted = false;

  return appendSheetRow('Damage_Records', recordData);
}

/**
 * ==================== CREDIT NOTES ====================
 */

function getCreditNotes(filters = {}) {
  return getSheetDataFiltered('Credit_Notes', filters);
}

function createCreditNote(noteData) {
  noteData.credit_note_id = 'CRED-' + generateNextId('Credit_Notes', 'credit_note_id');
  noteData.created_at = new Date();
  noteData.is_deleted = false;

  return appendSheetRow('Credit_Notes', noteData);
}

/**
 * ==================== UTILITY FUNCTIONS ====================
 */

function formatCurrency(amount) {
  return parseFloat(amount || 0).toLocaleString('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0
  });
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd');
}

function calculateRentalDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function calculateRentalAmount(dailyRate, days, discountPercent = 0) {
  const baseAmount = parseFloat(dailyRate || 0) * days;
  const discount = baseAmount * (parseFloat(discountPercent || 0) / 100);
  return baseAmount - discount;
}
