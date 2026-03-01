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

// ==================== ROLE-BASED ACCESS CONTROL ====================

/**
 * Role permission matrix.
 * Each role lists the operations it can perform.
 */
const ROLE_PERMISSIONS = {
  admin: ['*'],  // full access
  manager: [
    'read', 'create', 'update', 'delete',
    'approve_discount', 'approve_credit_note', 'approve_cancellation',
    'manage_staff', 'manage_rules', 'run_reports'
  ],
  staff: [
    'read', 'create', 'update',
    'process_check_in', 'process_check_out', 'create_rental', 'create_payment'
  ],
  viewer: ['read']
};

/**
 * Get current logged-in staff member using Session.getActiveUser()
 * @return {Object|null} Staff record or null
 */
function getCurrentUser() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return null;
    const staff = getSheetData('Staff').find(s =>
      !s.is_deleted && s.active !== false && s.email === email
    );
    return staff || null;
  } catch (e) {
    Logger.log('getCurrentUser error: ' + e.toString());
    return null;
  }
}

/**
 * Check if the current user has a specific permission
 * @param {string} operation - The operation to check (e.g., 'create', 'approve_discount')
 * @return {boolean}
 */
function checkPermission(operation) {
  const user = getCurrentUser();
  if (!user) return false;

  const role = user.role || 'viewer';
  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;

  if (perms.includes('*')) return true;
  return perms.includes(operation);
}

/**
 * Require a specific permission; throw if not met.
 * @param {string} operation
 * @param {string} [message]
 */
function requirePermission(operation, message) {
  if (!checkPermission(operation)) {
    const user = getCurrentUser();
    const role = user ? user.role : 'unknown';
    throw new Error(message || `權限不足：角色「${role}」無法執行「${operation}」操作`);
  }
}

/**
 * Get current user info (exposed to frontend)
 * @return {Object} User info with role and permissions
 */
function getCurrentUserInfo() {
  const user = getCurrentUser();
  if (!user) {
    return { authenticated: false, role: 'viewer', permissions: ROLE_PERMISSIONS.viewer };
  }
  const role = user.role || 'viewer';
  return {
    authenticated: true,
    staff_id: user.staff_id,
    name: user.name,
    email: user.email,
    role: role,
    can_approve_discount: user.can_approve_discount === true || user.can_approve_discount === 'true',
    permissions: ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer
  };
}

/**
 * Main entry point for the web app
 */
function doGet(e) {
  const mode = e.parameter.mode || 'staff';
  const template = mode === 'customer' ? 'CustomerApp' : 'StaffApp';

  return HtmlService.createTemplateFromFile(template)
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Include HTML/CSS/JS partial files (used in templates via <?!= include('Styles') ?>)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * ==================== AUTO-NUMBERING FUNCTIONS ====================
 */

/**
 * Generate internal equipment code (e.g., CAM-2026-001)
 * Format: {category_code}-{year}-{3-digit seq}
 * Sequence resets per category per year.
 */
function generateInternalCode(categoryKey) {
  const prefix = CATEGORY_CODES[categoryKey] || 'GEN';
  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}-`;
  const units = getSheetData('Equipment_Units');

  const codesByPrefix = units
    .filter(u => u.internal_code && u.internal_code.startsWith(yearPrefix))
    .map(u => {
      const match = u.internal_code.match(/(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });

  const nextNum = (Math.max(...codesByPrefix, 0) + 1).toString().padStart(3, '0');
  return `${yearPrefix}${nextNum}`;
}

/**
 * Generate rental ID (RENT-YYYY-NNN)
 */
function generateRentalId() {
  return generateYearBasedId('Rentals', 'rental_id', 'RENT');
}

/**
 * Generic next ID generator with prefix and zero-padding
 * @param {string} sheetName - Sheet name
 * @param {string} idField - ID column name
 * @param {string} prefix - ID prefix (e.g., 'ET', 'EU', 'CU')
 * @param {number} padLength - Zero-padding length (default 3)
 * @return {string} Formatted ID, e.g., 'ET-001'
 */
function generateNextId(sheetName, idField, prefix, padLength) {
  padLength = padLength || 3;
  const data = getSheetData(sheetName);
  const ids = data
    .filter(row => row[idField])
    .map(row => {
      const match = String(row[idField]).match(/(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });

  const nextNum = Math.max(...ids, 0) + 1;
  if (prefix) {
    return prefix + '-' + String(nextNum).padStart(padLength, '0');
  }
  return nextNum;
}

/**
 * Generate year-based sequential ID (e.g., RENT-2026-001, CN-2026-001, SP-2026-001)
 * @param {string} sheetName - Sheet name
 * @param {string} idField - ID column name
 * @param {string} prefix - ID prefix (e.g., 'RENT', 'CN', 'SP')
 * @param {number} padLength - Zero-padding length (default 3)
 * @return {string} Formatted ID
 */
function generateYearBasedId(sheetName, idField, prefix, padLength) {
  padLength = padLength || 3;
  const year = new Date().getFullYear();
  const yearPrefix = prefix + '-' + year + '-';

  const data = getSheetData(sheetName);
  const yearIds = data
    .filter(row => row[idField] && String(row[idField]).startsWith(yearPrefix))
    .map(row => {
      const match = String(row[idField]).match(/(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });

  const nextNum = (Math.max(...yearIds, 0) + 1);
  return yearPrefix + String(nextNum).padStart(padLength, '0');
}

/**
 * ==================== EQUIPMENT TYPE FUNCTIONS ====================
 */

function getEquipmentTypes() {
  return getSheetData('Equipment_Types');
}

function createEquipmentType(typeData) {
  requirePermission('create', '無權限建立器材類型');

  const validation = validateEquipmentType(typeData);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  const currentUser = getCurrentUser();
  typeData.type_id = generateNextId('Equipment_Types', 'type_id', 'ET');
  typeData.created_by = currentUser ? currentUser.staff_id : '';
  typeData.created_at = new Date();
  typeData.is_deleted = false;
  // Schema-required defaults for missing fields
  typeData.name = typeData.name || typeData.type_name;
  typeData.replacement_value = typeData.replacement_value || 0;
  typeData.is_consumable = typeData.is_consumable || false;
  typeData.is_batch_item = typeData.is_batch_item || false;
  typeData.active = typeData.active !== undefined ? typeData.active : true;

  return appendSheetRow('Equipment_Types', typeData);
}

function updateEquipmentType(typeId, updates) {
  return updateSheetRow('Equipment_Types', 'type_id', typeId, updates);
}

function deleteEquipmentType(typeId) {
  requirePermission('delete', '無權限刪除器材類型');
  return updateSheetRow('Equipment_Types', 'type_id', typeId, { is_deleted: true });
}

function validateEquipmentType(data) {
  const errors = [];
  // Schema uses 'name' but UI may send 'type_name'
  if ((!data.name && !data.type_name) || (data.type_name || data.name || '').trim() === '') {
    errors.push('器材類型名稱必填');
  }
  if (!data.category || data.category.trim() === '') errors.push('分類必填');
  if (!data.daily_rate || isNaN(parseFloat(data.daily_rate)) || parseFloat(data.daily_rate) < 0) {
    errors.push('日租價格必填且為正數');
  }
  if (data.replacement_value !== undefined && data.replacement_value !== '' && isNaN(parseFloat(data.replacement_value))) {
    errors.push('器材市值必須為數字');
  }

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
  requirePermission('create', '無權限建立器材個體');

  const validation = validateEquipmentUnit(unitData);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  const currentUser = getCurrentUser();
  const category = unitData.category || 'accessory';
  unitData.internal_code = generateInternalCode(category);
  unitData.unit_id = generateNextId('Equipment_Units', 'unit_id', 'EU');
  unitData.created_at = new Date();
  unitData.is_deleted = false;
  unitData.status = 'available';
  unitData.current_condition = unitData.current_condition || 'good';
  unitData.created_by = currentUser ? currentUser.staff_id : '';

  return appendSheetRow('Equipment_Units', unitData);
}

function updateEquipmentUnit(unitId, updates) {
  return updateSheetRow('Equipment_Units', 'unit_id', unitId, updates);
}

function deleteEquipmentUnit(unitId) {
  requirePermission('delete', '無權限刪除器材個體');
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

  customerData.customer_id = generateNextId('Customers', 'customer_id', 'CU');
  customerData.created_at = new Date();
  customerData.is_deleted = false;
  // Schema-required defaults
  customerData.blacklisted = customerData.blacklisted || false;
  customerData.id_doc_verified = customerData.id_doc_verified || false;
  customerData.id_doc_return_status = customerData.id_doc_return_status || 'na';

  return appendSheetRow('Customers', customerData);
}

function updateCustomer(customerId, updates) {
  return updateSheetRow('Customers', 'customer_id', customerId, updates);
}

function deleteCustomer(customerId) {
  requirePermission('delete', '無權限刪除客戶');
  return updateSheetRow('Customers', 'customer_id', customerId, { is_deleted: true });
}

function validateCustomer(data) {
  const errors = [];
  // Schema requires 'name' (person name); company_name is optional
  if (!data.name || data.name.trim() === '') {
    // Fall back: if only company_name provided, use it as name
    if (data.company_name && data.company_name.trim() !== '') {
      data.name = data.name || data.company_name;
    } else {
      errors.push('租借人姓名必填');
    }
  }
  if (!data.phone || data.phone.trim() === '') errors.push('電話必填');
  if (data.email && !isValidEmail(data.email)) errors.push('電子郵件格式不正確');

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
  requirePermission('create_rental', '無權限建立租借單');

  const validation = validateRental(rentalData);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  // Normalize date field names to match schema
  rentalData.rental_start = rentalData.rental_start || rentalData.start_date;
  rentalData.rental_end = rentalData.rental_end || rentalData.end_date;

  rentalData.rental_id = generateRentalId();
  rentalData.created_at = new Date();
  rentalData.updated_at = new Date();
  rentalData.status = 'draft';
  rentalData.total_amount = 0;
  rentalData.paid_amount = 0;
  rentalData.subtotal = 0;
  rentalData.discount_total = 0;
  rentalData.overdue_fee = 0;
  rentalData.tax_rate = rentalData.tax_rate || 0.05;
  rentalData.tax_amount = 0;
  rentalData.deposit_status = rentalData.deposit_status || 'pending';
  rentalData.contract_signed = rentalData.contract_signed || false;
  rentalData.delivery_required = rentalData.delivery_required || false;
  rentalData.invoice_required = rentalData.invoice_required || false;
  rentalData.invoice_status = rentalData.invoice_required ? 'pending' : 'not_required';

  const currentUser = getCurrentUser();
  rentalData.prepared_by = rentalData.prepared_by || (currentUser ? currentUser.staff_id : '');
  rentalData.handled_by = rentalData.handled_by || (currentUser ? currentUser.staff_id : '');

  return appendSheetRow('Rentals', rentalData);
}

function updateRental(rentalId, updates) {
  return updateSheetRow('Rentals', 'rental_id', rentalId, updates);
}

function validateRental(data) {
  const errors = [];
  if (!data.customer_id || data.customer_id.trim() === '') errors.push('客戶必填');
  if (!data.start_date && !data.rental_start) errors.push('開始日期必填');
  if (!data.end_date && !data.rental_end) errors.push('結束日期必填');

  const startDate = new Date(data.rental_start || data.start_date);
  const endDate = new Date(data.rental_end || data.end_date);
  if (endDate <= startDate) {
    errors.push('結束日期必須晚於開始日期');
  }

  // C4: Blacklist check
  if (data.customer_id) {
    const customer = getSheetDataFiltered('Customers', { customer_id: data.customer_id })[0];
    if (customer && (customer.blacklisted === true || customer.blacklisted === 'true' || customer.blacklisted === '1')) {
      const reason = customer.blacklist_reason ? `（原因：${customer.blacklist_reason}）` : '';
      errors.push(`此客戶已列入黑名單，無法建立租借單${reason}`);
    }
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
  itemData.item_id = generateNextId('Rental_Items', 'item_id', 'RI');
  itemData.created_at = new Date();
  itemData.is_deleted = false;

  // Snapshot rates from Equipment_Types at creation time
  if (itemData.type_id) {
    const type = getSheetDataFiltered('Equipment_Types', { type_id: itemData.type_id })[0];
    if (type) {
      itemData.daily_rate_snapshot = itemData.daily_rate_snapshot || parseFloat(type.daily_rate) || 0;
      itemData.replacement_value_snapshot = itemData.replacement_value_snapshot || parseFloat(type.replacement_value) || 0;
    }
  }

  // Calculate days from parent rental if not provided
  if (!itemData.days && itemData.rental_id) {
    const rental = getSheetDataFiltered('Rentals', { rental_id: itemData.rental_id })[0];
    if (rental) {
      const start = new Date(rental.rental_start || rental.start_date);
      const end = new Date(rental.rental_end || rental.end_date);
      itemData.days = calculateRentalDays(start, end);
    }
  }

  // Calculate line_total
  const rate = parseFloat(itemData.daily_rate_snapshot) || 0;
  const qty = parseInt(itemData.quantity) || 1;
  const days = parseInt(itemData.days) || 1;
  itemData.line_total = Math.round(rate * qty * days);
  itemData.line_total_after_discount = itemData.line_total;

  // Set initial return status
  itemData.return_status = itemData.return_status || 'with_customer';

  return appendSheetRow('Rental_Items', itemData);
}

function updateRentalItem(itemId, updates) {
  return updateSheetRow('Rental_Items', 'item_id', itemId, updates);
}

/**
 * ==================== PAYMENT FUNCTIONS ====================
 */

function getPayments(filters = {}) {
  return getSheetDataFiltered('Payments', filters);
}

function createPayment(paymentData) {
  requirePermission('create_payment', '無權限建立付款紀錄');

  const validation = validatePayment(paymentData);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  const currentUser = getCurrentUser();
  paymentData.payment_id = generateNextId('Payments', 'payment_id', 'PAY');
  paymentData.payment_date = paymentData.payment_date || new Date();
  paymentData.is_deleted = false;
  paymentData.received_by = paymentData.received_by || (currentUser ? currentUser.staff_id : '');
  paymentData.receive_channel = paymentData.receive_channel || 'company_direct';
  paymentData.relay_status = paymentData.receive_channel === 'staff_relay' ? 'pending' : 'na';

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
  if (data.amount === undefined || data.amount === null || data.amount === '' || isNaN(parseFloat(data.amount))) {
    errors.push('金額必填且為數字');
  } else if (parseFloat(data.amount) === 0) {
    errors.push('金額不可為零');
  }
  // Note: negative amounts are valid for refunds and credit notes
  if (!data.payment_method || data.payment_method.trim() === '') errors.push('付款方式必填');
  if (!data.payment_type || data.payment_type.trim() === '') errors.push('付款類型必填');

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
  logData.log_id = generateNextId('Maintenance_Logs', 'log_id', 'ML');
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
  logData.log_id = generateNextId('Inventory_Logs', 'log_id', 'IL');
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
  planData.plan_id = generateYearBasedId('Stocktake_Plans', 'plan_id', 'SP');
  planData.created_at = new Date();
  planData.status = 'draft';
  planData.is_deleted = false;

  return appendSheetRow('Stocktake_Plans', planData);
}

function getStocktakeResults(planId) {
  return getSheetDataFiltered('Stocktake_Results', { stocktake_plan_id: planId });
}

function createStocktakeResult(resultData) {
  resultData.result_id = generateNextId('Stocktake_Results', 'result_id', 'SR');
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
  staffData.staff_id = generateNextId('Staff', 'staff_id', 'S');
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

  const activeRentals = rentals.filter(r => ['draft', 'reserved', 'active', 'overdue'].includes(r.status)).length;
  const completedRentals = rentals.filter(r => r.status === 'returned').length;

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
  locationData.location_id = generateNextId('Storage_Locations', 'location_id', 'LOC');
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
  ruleData.rule_id = generateNextId('Discount_Rules', 'rule_id', 'DR');
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
  bindingData.binding_id = generateNextId('Accessory_Bindings', 'binding_id', 'AB');
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
  recordData.damage_id = generateNextId('Damage_Records', 'damage_id', 'DM');
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
  noteData.credit_note_id = generateYearBasedId('Credit_Notes', 'credit_note_id', 'CN');
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
