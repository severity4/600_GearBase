/**
 * 映奧創意工作室 - 器材管理租借系統
 * Equipment Management & Rental System
 * Main Application Code
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SPREADSHEET = SpreadsheetApp.getActiveSpreadsheet();

// Debug mode flag
const DEBUG_MODE = true;

/**
 * ==================== DEBUG / DIAGNOSTICS ====================
 */

/**
 * Check all required sheets exist and report status
 * @return {Object} Diagnostics result
 */
function debugCheckSheets() {
  const requiredSheets = [
    { name: 'Equipment_Types', headers: ['type_id','type_name','category','sub_category','brand','model','daily_rate','replacement_value','deposit_required','is_consumable','is_batch_item','description','active','created_by','created_at','is_deleted'] },
    { name: 'Equipment_Units', headers: ['unit_id','type_id','internal_code','serial_number','category','status','current_condition','location_id','notes','created_by','created_at','is_deleted'] },
    { name: 'Customers', headers: ['customer_id','name','company_name','phone','email','id_number','id_doc_verified','id_doc_return_status','blacklisted','blacklist_reason','credit_balance','notes','created_at','is_deleted'] },
    { name: 'Rentals', headers: ['rental_id','customer_id','rental_start','rental_end','status','total_amount','paid_amount','tax_rate','deposit_status','delivery_required','invoice_status','prepared_by','handled_by','approved_by','notes','created_at','updated_at','is_deleted'] },
    { name: 'Rental_Items', headers: ['item_id','rental_id','unit_id','type_id','quantity','daily_rate_snapshot','replacement_value_snapshot','days','line_total','line_total_after_discount','discount_amount','return_status','notes','is_deleted'] },
    { name: 'Payments', headers: ['payment_id','rental_id','booking_id','payment_type','amount','payment_method','payment_date','received_by','receive_channel','relay_status','notes','is_deleted'] },
    { name: 'Maintenance_Logs', headers: ['log_id','unit_id','maintenance_type','description','cost','scheduled_date','completed_date','performed_by','status','notes','created_at','is_deleted'] },
    { name: 'Inventory_Logs', headers: ['log_id','unit_id','change_type','quantity_change','from_location','to_location','reason','performed_by','created_at','is_deleted'] },
    { name: 'Storage_Locations', headers: ['location_id','location_name','parent_id','location_type','capacity','responsible_staff','notes','is_deleted'] },
    { name: 'Staff', headers: ['staff_id','name','email','phone','role','can_approve_discount','active','created_at','is_deleted'] },
    { name: 'Discount_Rules', headers: ['rule_id','rule_name','discount_type','discount_value','min_days','min_amount','applicable_types','applicable_categories','active','created_at','is_deleted'] },
    { name: 'Accessory_Bindings', headers: ['binding_id','parent_type_id','accessory_type_id','binding_type','notes','is_deleted'] },
    { name: 'Damage_Records', headers: ['damage_id','rental_id','unit_id','damage_type','description','severity','repair_cost','replacement_cost','reported_by','reported_at','status','notes','is_deleted'] },
    { name: 'Credit_Notes', headers: ['credit_note_id','rental_id','booking_id','customer_id','credit_type','amount','reason','approved_by','status','created_at','is_deleted'] },
    { name: 'Service_Items', headers: ['service_item_id','rental_id','booking_id','service_type','description','unit_price','quantity','line_total','notes','is_deleted'] },
    { name: 'Overdue_Rules', headers: ['overdue_rule_id','rule_name','grace_period_days','daily_penalty_rate','max_penalty_percent','active','is_deleted'] },
    { name: 'Wear_Tolerance', headers: ['tolerance_id','category','condition_field','acceptable_threshold','notes','is_deleted'] },
    { name: 'Print_Templates', headers: ['template_id','template_name','template_type','doc_template_id','active','created_at','updated_at','is_deleted'] },
    { name: 'Rental_Addendums', headers: ['addendum_id','rental_id','addendum_type','description','amount_change','approved_by','created_at','is_deleted'] },
    { name: 'Stocktake_Plans', headers: ['plan_id','plan_name','plan_type','scope_location_id','scheduled_date','status','assigned_to','supervised_by','created_by','created_at','is_deleted'] },
    { name: 'Stocktake_Results', headers: ['result_id','plan_id','unit_id','expected_location','actual_location','physical_count','system_count','condition_found','discrepancy_type','resolution','resolved_by','counted_by','recorded_at','is_deleted'] },
    { name: 'Venues', headers: ['venue_id','name','venue_type','address','floor','floor_area_sqm','max_capacity','hourly_rate','half_day_rate','daily_rate','overtime_hourly_rate','deposit_required','min_booking_hours','available_start_time','available_end_time','amenities','power_specs','ceiling_height_m','has_cyclorama','cyclorama_color','has_blackout','has_loading_dock','parking_info','rules','description','image_urls','floor_plan_url','location_id','active','notes','created_by','created_at','is_deleted'] },
    { name: 'Venue_Bookings', headers: ['booking_id','venue_id','customer_id','rental_id','booking_start','booking_end','actual_start','actual_end','total_hours','overtime_hours','rate_type','unit_rate','rate_quantity','subtotal','overtime_fee','discount_amount','tax_rate','tax_amount','total_amount','deposit_amount','deposit_status','attendee_count','use_purpose','setup_required','setup_notes','cleanup_included','special_requirements','contract_url','contract_signed','invoice_required','invoice_status','invoice_number','prepared_by','handled_by','approved_by','status','cancellation_date','cancellation_reason','cancellation_fee','post_use_condition','damage_description','damage_fee','notes','paid_amount','created_at','updated_at','is_deleted'] }
  ];

  const results = {
    spreadsheet_id: SPREADSHEET_ID,
    spreadsheet_name: SPREADSHEET.getName(),
    total_required: requiredSheets.length,
    existing: [],
    missing: [],
    sheets_in_spreadsheet: SPREADSHEET.getSheets().map(s => s.getName())
  };

  requiredSheets.forEach(req => {
    const sheet = SPREADSHEET.getSheetByName(req.name);
    if (sheet) {
      const headers = sheet.getDataRange().getValues()[0] || [];
      results.existing.push({
        name: req.name,
        rows: sheet.getLastRow() - 1,
        headers: headers.map(h => String(h).toLowerCase().trim())
      });
    } else {
      results.missing.push(req.name);
    }
  });

  return results;
}

/**
 * Auto-create all missing sheets with proper headers
 * @return {Object} Creation result
 */
function ensureRequiredSheets() {
  const diag = debugCheckSheets();
  const created = [];

  if (diag.missing.length === 0) {
    return { message: '所有必要的工作表都已存在', created: [] };
  }

  // Get the sheet definitions from debugCheckSheets
  const sheetDefs = {
    'Equipment_Types': ['type_id','type_name','category','sub_category','brand','model','daily_rate','replacement_value','deposit_required','is_consumable','is_batch_item','description','active','created_by','created_at','is_deleted'],
    'Equipment_Units': ['unit_id','type_id','internal_code','serial_number','category','status','current_condition','location_id','notes','created_by','created_at','is_deleted'],
    'Customers': ['customer_id','name','company_name','phone','email','id_number','id_doc_verified','id_doc_return_status','blacklisted','blacklist_reason','credit_balance','notes','created_at','is_deleted'],
    'Rentals': ['rental_id','customer_id','rental_start','rental_end','status','total_amount','paid_amount','tax_rate','deposit_status','delivery_required','invoice_status','prepared_by','handled_by','approved_by','notes','created_at','updated_at','is_deleted'],
    'Rental_Items': ['item_id','rental_id','unit_id','type_id','quantity','daily_rate_snapshot','replacement_value_snapshot','days','line_total','line_total_after_discount','discount_amount','return_status','notes','is_deleted'],
    'Payments': ['payment_id','rental_id','booking_id','payment_type','amount','payment_method','payment_date','received_by','receive_channel','relay_status','notes','is_deleted'],
    'Maintenance_Logs': ['log_id','unit_id','maintenance_type','description','cost','scheduled_date','completed_date','performed_by','status','notes','created_at','is_deleted'],
    'Inventory_Logs': ['log_id','unit_id','change_type','quantity_change','from_location','to_location','reason','performed_by','created_at','is_deleted'],
    'Storage_Locations': ['location_id','location_name','parent_id','location_type','capacity','responsible_staff','notes','is_deleted'],
    'Staff': ['staff_id','name','email','phone','role','can_approve_discount','active','created_at','is_deleted'],
    'Discount_Rules': ['rule_id','rule_name','discount_type','discount_value','min_days','min_amount','applicable_types','applicable_categories','active','created_at','is_deleted'],
    'Accessory_Bindings': ['binding_id','parent_type_id','accessory_type_id','binding_type','notes','is_deleted'],
    'Damage_Records': ['damage_id','rental_id','unit_id','damage_type','description','severity','repair_cost','replacement_cost','reported_by','reported_at','status','notes','is_deleted'],
    'Credit_Notes': ['credit_note_id','rental_id','booking_id','customer_id','credit_type','amount','reason','approved_by','status','created_at','is_deleted'],
    'Service_Items': ['service_item_id','rental_id','booking_id','service_type','description','unit_price','quantity','line_total','notes','is_deleted'],
    'Overdue_Rules': ['overdue_rule_id','rule_name','grace_period_days','daily_penalty_rate','max_penalty_percent','active','is_deleted'],
    'Wear_Tolerance': ['tolerance_id','category','condition_field','acceptable_threshold','notes','is_deleted'],
    'Print_Templates': ['template_id','template_name','template_type','doc_template_id','active','created_at','updated_at','is_deleted'],
    'Rental_Addendums': ['addendum_id','rental_id','addendum_type','description','amount_change','approved_by','created_at','is_deleted'],
    'Stocktake_Plans': ['plan_id','plan_name','plan_type','scope_location_id','scheduled_date','status','assigned_to','supervised_by','created_by','created_at','is_deleted'],
    'Stocktake_Results': ['result_id','plan_id','unit_id','expected_location','actual_location','physical_count','system_count','condition_found','discrepancy_type','resolution','resolved_by','counted_by','recorded_at','is_deleted'],
    'Venues': ['venue_id','name','venue_type','address','floor','floor_area_sqm','max_capacity','hourly_rate','half_day_rate','daily_rate','overtime_hourly_rate','deposit_required','min_booking_hours','available_start_time','available_end_time','amenities','power_specs','ceiling_height_m','has_cyclorama','cyclorama_color','has_blackout','has_loading_dock','parking_info','rules','description','image_urls','floor_plan_url','location_id','active','notes','created_by','created_at','is_deleted'],
    'Venue_Bookings': ['booking_id','venue_id','customer_id','rental_id','booking_start','booking_end','actual_start','actual_end','total_hours','overtime_hours','rate_type','unit_rate','rate_quantity','subtotal','overtime_fee','discount_amount','tax_rate','tax_amount','total_amount','deposit_amount','deposit_status','attendee_count','use_purpose','setup_required','setup_notes','cleanup_included','special_requirements','contract_url','contract_signed','invoice_required','invoice_status','invoice_number','prepared_by','handled_by','approved_by','status','cancellation_date','cancellation_reason','cancellation_fee','post_use_condition','damage_description','damage_fee','notes','paid_amount','created_at','updated_at','is_deleted']
  };

  diag.missing.forEach(sheetName => {
    const headers = sheetDefs[sheetName];
    if (headers) {
      const newSheet = SPREADSHEET.insertSheet(sheetName);
      newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      // Bold headers and freeze first row
      newSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      newSheet.setFrozenRows(1);
      created.push(sheetName);
      Logger.log(`Created sheet: ${sheetName} with ${headers.length} columns`);
    }
  });

  return {
    message: `已建立 ${created.length} 個工作表`,
    created: created,
    still_missing: diag.missing.filter(name => !created.includes(name))
  };
}

/**
 * Debug wrapper - call any function with error details
 * @param {string} fnName - Function name
 * @param {Array} args - Arguments
 * @return {Object} Result or error details
 */
function debugCall(fnName, ...args) {
  try {
    const fn = this[fnName];
    if (!fn) {
      return { success: false, error: `Function not found: ${fnName}` };
    }
    const result = fn.apply(this, args);
    return { success: true, result: result };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack,
      function: fnName,
      args: args
    };
  }
}

/**
 * Quick health check - test basic operations
 * @return {Object} Health check results
 */
function debugHealthCheck() {
  const checks = {};

  // Check spreadsheet access
  try {
    checks.spreadsheet = { ok: true, name: SPREADSHEET.getName(), id: SPREADSHEET_ID };
  } catch (e) {
    checks.spreadsheet = { ok: false, error: e.message };
  }

  // Check each sheet read
  const sheetNames = ['Equipment_Types', 'Equipment_Units', 'Customers', 'Rentals', 'Payments', 'Staff', 'Venues', 'Venue_Bookings'];
  checks.sheets = {};
  sheetNames.forEach(name => {
    try {
      const sheet = SPREADSHEET.getSheetByName(name);
      if (!sheet) {
        checks.sheets[name] = { ok: false, error: 'Sheet not found' };
      } else {
        const rows = sheet.getLastRow();
        checks.sheets[name] = { ok: true, rows: rows, hasHeaders: rows >= 1 };
      }
    } catch (e) {
      checks.sheets[name] = { ok: false, error: e.message };
    }
  });

  // Check current user
  try {
    const user = getCurrentUser();
    checks.user = user
      ? { ok: true, staff_id: user.staff_id, role: user.role }
      : { ok: false, note: 'No matching staff record (permissions will be denied)' };
  } catch (e) {
    checks.user = { ok: false, error: e.message };
  }

  // Check getDashboardStats
  try {
    const stats = getDashboardStats();
    checks.dashboard = { ok: true, stats: stats };
  } catch (e) {
    checks.dashboard = { ok: false, error: e.message, stack: e.stack };
  }

  return checks;
}

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

  // Update rental or booking paid amount
  if (paymentData.rental_id) {
    const rental = getSheetDataFiltered('Rentals', { rental_id: paymentData.rental_id })[0];
    if (rental) {
      const newPaidAmount = (parseFloat(rental.paid_amount) || 0) + parseFloat(paymentData.amount);
      updateRental(paymentData.rental_id, { paid_amount: newPaidAmount });
    }
  }
  if (paymentData.booking_id) {
    const booking = getSheetDataFiltered('Venue_Bookings', { booking_id: paymentData.booking_id })[0];
    if (booking) {
      const newPaidAmount = (parseFloat(booking.paid_amount) || 0) + parseFloat(paymentData.amount);
      updateVenueBooking(paymentData.booking_id, { paid_amount: newPaidAmount });
    }
  }

  return appendSheetRow('Payments', paymentData);
}

function validatePayment(data) {
  const errors = [];
  // rental_id or booking_id required (at least one)
  const hasRental = data.rental_id && data.rental_id.trim() !== '';
  const hasBooking = data.booking_id && data.booking_id.trim() !== '';
  if (!hasRental && !hasBooking) errors.push('租借單或場地預約必填（至少填一個）');
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
  const venues = getSheetData('Venues').filter(v => !v.is_deleted);
  const venueBookings = getSheetData('Venue_Bookings').filter(b => !b.is_deleted);

  const availableUnits = equipmentUnits.filter(u => u.status === 'available').length;
  const rentedUnits = equipmentUnits.filter(u => u.status === 'rented').length;
  const maintenanceUnits = equipmentUnits.filter(u => u.status === 'maintenance').length;

  const activeRentals = rentals.filter(r => ['draft', 'reserved', 'active', 'overdue'].includes(r.status)).length;
  const completedRentals = rentals.filter(r => r.status === 'returned').length;

  const totalRevenue = rentals.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0);

  // Venue stats
  const activeVenues = venues.filter(v => v.active !== false && v.active !== 'false').length;
  const activeBookings = venueBookings.filter(b => ['draft', 'reserved', 'confirmed', 'active'].includes(b.status)).length;
  const completedBookings = venueBookings.filter(b => b.status === 'completed').length;
  const venueRevenue = venueBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);

  return {
    total_equipment_types: equipmentTypes.length,
    total_equipment_units: equipmentUnits.length,
    available_units: availableUnits,
    rented_units: rentedUnits,
    maintenance_units: maintenanceUnits,
    total_customers: customers.length,
    active_rentals: activeRentals,
    completed_rentals: completedRentals,
    total_revenue: totalRevenue,
    total_venues: venues.length,
    active_venues: activeVenues,
    active_bookings: activeBookings,
    completed_bookings: completedBookings,
    venue_revenue: venueRevenue
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
 * ==================== VENUE FUNCTIONS ====================
 */

function getVenues(filters = {}) {
  return getSheetDataFiltered('Venues', filters);
}

function createVenue(venueData) {
  requirePermission('create', '無權限建立場地');

  const validation = validateVenue(venueData);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  const currentUser = getCurrentUser();
  venueData.venue_id = generateNextId('Venues', 'venue_id', 'VN');
  venueData.created_by = currentUser ? currentUser.staff_id : '';
  venueData.created_at = new Date();
  venueData.is_deleted = false;
  venueData.active = venueData.active !== undefined ? venueData.active : true;

  return appendSheetRow('Venues', venueData);
}

function updateVenue(venueId, updates) {
  return updateSheetRow('Venues', 'venue_id', venueId, updates);
}

function deleteVenue(venueId) {
  requirePermission('delete', '無權限刪除場地');
  return updateSheetRow('Venues', 'venue_id', venueId, { is_deleted: true });
}

function validateVenue(data) {
  const errors = [];
  if (!data.name || data.name.trim() === '') errors.push('場地名稱必填');
  if (!data.venue_type || data.venue_type.trim() === '') errors.push('場地類型必填');
  if (!data.hourly_rate || isNaN(parseFloat(data.hourly_rate)) || parseFloat(data.hourly_rate) < 0) {
    errors.push('時租費必填且為正數');
  }
  if (!data.max_capacity || isNaN(parseInt(data.max_capacity)) || parseInt(data.max_capacity) <= 0) {
    errors.push('最大容納人數必填且為正整數');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * ==================== VENUE BOOKING FUNCTIONS ====================
 */

function getVenueBookings(filters = {}) {
  return getSheetDataFiltered('Venue_Bookings', filters);
}

function createVenueBooking(bookingData) {
  requirePermission('create_rental', '無權限建立場地預約');

  const validation = validateVenueBooking(bookingData);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  // Blacklist check
  if (bookingData.customer_id) {
    const customer = getSheetDataFiltered('Customers', { customer_id: bookingData.customer_id })[0];
    if (customer && (customer.blacklisted === true || customer.blacklisted === 'true' || customer.blacklisted === '1')) {
      const reason = customer.blacklist_reason ? `（原因：${customer.blacklist_reason}）` : '';
      throw new Error(`此客戶已列入黑名單，無法建立場地預約${reason}`);
    }
  }

  // Snapshot rate from Venue
  if (bookingData.venue_id) {
    const venue = getSheetDataFiltered('Venues', { venue_id: bookingData.venue_id })[0];
    if (venue) {
      const rateType = bookingData.rate_type || 'hourly';
      if (!bookingData.unit_rate) {
        if (rateType === 'hourly') bookingData.unit_rate = parseFloat(venue.hourly_rate) || 0;
        else if (rateType === 'half_day') bookingData.unit_rate = parseFloat(venue.half_day_rate) || parseFloat(venue.hourly_rate) * 4;
        else if (rateType === 'daily') bookingData.unit_rate = parseFloat(venue.daily_rate) || parseFloat(venue.hourly_rate) * 8;
      }
    }
  }

  const currentUser = getCurrentUser();
  bookingData.booking_id = generateYearBasedId('Venue_Bookings', 'booking_id', 'VB');
  bookingData.created_at = new Date();
  bookingData.updated_at = new Date();
  bookingData.status = 'draft';
  bookingData.is_deleted = false;

  // Calculate subtotal
  const unitRate = parseFloat(bookingData.unit_rate) || 0;
  const rateQty = parseFloat(bookingData.rate_quantity) || 1;
  bookingData.subtotal = Math.round(unitRate * rateQty);
  bookingData.discount_amount = parseFloat(bookingData.discount_amount) || 0;
  bookingData.overtime_fee = parseFloat(bookingData.overtime_fee) || 0;
  bookingData.tax_rate = parseFloat(bookingData.tax_rate) || 0.05;
  const taxableAmount = bookingData.subtotal - bookingData.discount_amount + bookingData.overtime_fee;
  bookingData.tax_amount = Math.round(taxableAmount * bookingData.tax_rate);
  bookingData.total_amount = taxableAmount + bookingData.tax_amount;

  bookingData.deposit_status = bookingData.deposit_status || 'pending';
  bookingData.setup_required = bookingData.setup_required || false;
  bookingData.cleanup_included = bookingData.cleanup_included || false;
  bookingData.contract_signed = bookingData.contract_signed || false;
  bookingData.invoice_required = bookingData.invoice_required || false;
  bookingData.invoice_status = bookingData.invoice_required ? 'pending' : 'not_required';

  bookingData.prepared_by = bookingData.prepared_by || (currentUser ? currentUser.staff_id : '');
  bookingData.handled_by = bookingData.handled_by || (currentUser ? currentUser.staff_id : '');

  return appendSheetRow('Venue_Bookings', bookingData);
}

function updateVenueBooking(bookingId, updates) {
  updates.updated_at = new Date();
  return updateSheetRow('Venue_Bookings', 'booking_id', bookingId, updates);
}

function deleteVenueBooking(bookingId) {
  return updateSheetRow('Venue_Bookings', 'booking_id', bookingId, { is_deleted: true, updated_at: new Date() });
}

function validateVenueBooking(data) {
  const errors = [];
  if (!data.venue_id || data.venue_id.trim() === '') errors.push('場地必填');
  if (!data.customer_id || data.customer_id.trim() === '') errors.push('客戶必填');
  if (!data.booking_start) errors.push('預約開始時間必填');
  if (!data.booking_end) errors.push('預約結束時間必填');
  if (!data.rate_type) errors.push('計費方式必填');

  if (data.booking_start && data.booking_end) {
    const start = new Date(data.booking_start);
    const end = new Date(data.booking_end);
    if (end <= start) {
      errors.push('結束時間必須晚於開始時間');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
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

/**
 * ==================== SCHEDULE / CALENDAR ====================
 */

/**
 * Get schedule data for calendar view
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @return {Object} {rentals: [...], bookings: [...]}
 */
function getScheduleData(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59);

  // Get active rentals in range
  const allRentals = getSheetData('Rentals').filter(r =>
    !r.is_deleted && r.status !== 'cancelled'
  );
  const rentalItems = getSheetData('Rental_Items').filter(ri => !ri.is_deleted);
  const types = getSheetData('Equipment_Types');
  const units = getSheetData('Equipment_Units');
  const allCustomers = getSheetData('Customers');

  const typeMap = {};
  types.forEach(t => { typeMap[t.type_id] = t; });
  const unitMap = {};
  units.forEach(u => { unitMap[u.unit_id] = u; });
  const custMap = {};
  allCustomers.forEach(c => { custMap[c.customer_id] = c; });

  const scheduleRentals = [];
  allRentals.forEach(rental => {
    const rStart = new Date(rental.rental_start);
    const rEnd = new Date(rental.rental_end);
    if (rEnd < start || rStart > end) return;

    const items = rentalItems.filter(ri => ri.rental_id === rental.rental_id);
    const cust = custMap[rental.customer_id] || {};
    scheduleRentals.push({
      rental_id: rental.rental_id,
      customer_name: cust.name || '未知',
      start: rental.rental_start,
      end: rental.rental_end,
      status: rental.status,
      item_count: items.length,
      items: items.map(i => ({
        unit_id: i.unit_id,
        type_name: (typeMap[i.type_id] || {}).type_name || i.type_id,
        internal_code: (unitMap[i.unit_id] || {}).internal_code || i.unit_id
      }))
    });
  });

  // Get venue bookings in range
  const allBookings = getSheetData('Venue_Bookings').filter(b =>
    !b.is_deleted && b.status !== 'cancelled'
  );
  const allVenues = getSheetData('Venues');
  const venueMap = {};
  allVenues.forEach(v => { venueMap[v.venue_id] = v; });

  const scheduleBookings = [];
  allBookings.forEach(booking => {
    const bStart = new Date(booking.booking_start);
    const bEnd = new Date(booking.booking_end);
    if (bEnd < start || bStart > end) return;

    const venue = venueMap[booking.venue_id] || {};
    const cust = custMap[booking.customer_id] || {};
    scheduleBookings.push({
      booking_id: booking.booking_id,
      venue_name: venue.name || venue.venue_name || '未知',
      customer_name: cust.name || '未知',
      start: booking.booking_start,
      end: booking.booking_end,
      status: booking.status,
      rate_type: booking.rate_type
    });
  });

  return { rentals: scheduleRentals, bookings: scheduleBookings };
}

/**
 * ==================== RECEIPT / PRINT ====================
 */

/**
 * Generate rental receipt HTML for printing
 * @param {string} rentalId
 * @return {Object} Receipt data for client-side rendering
 */
function generateRentalReceipt(rentalId) {
  const rental = getSheetData('Rentals').find(r => r.rental_id === rentalId && !r.is_deleted);
  if (!rental) throw new Error('找不到租借單: ' + rentalId);

  const customer = getSheetData('Customers').find(c => c.customer_id === rental.customer_id);
  const items = getSheetData('Rental_Items').filter(ri => ri.rental_id === rentalId && !ri.is_deleted);
  const types = getSheetData('Equipment_Types');
  const units = getSheetData('Equipment_Units');
  const payments = getSheetData('Payments').filter(p => p.rental_id === rentalId && !p.is_deleted);
  const serviceItems = getSheetData('Service_Items').filter(s => s.rental_id === rentalId && !s.is_deleted);

  const typeMap = {};
  types.forEach(t => { typeMap[t.type_id] = t; });
  const unitMap = {};
  units.forEach(u => { unitMap[u.unit_id] = u; });

  const days = calculateRentalDays(rental.rental_start, rental.rental_end);

  const enrichedItems = items.map(item => {
    const type = typeMap[item.type_id] || {};
    const unit = unitMap[item.unit_id] || {};
    return {
      type_name: type.type_name || item.type_id,
      internal_code: unit.internal_code || item.unit_id,
      serial_number: unit.serial_number || '',
      daily_rate: parseFloat(item.daily_rate_snapshot || type.daily_rate || 0),
      days: days,
      line_total: parseFloat(item.line_total || 0),
      discount_amount: parseFloat(item.discount_amount || 0)
    };
  });

  return {
    rental_id: rentalId,
    customer: {
      name: customer ? customer.name : '未知',
      company: customer ? customer.company_name : '',
      phone: customer ? customer.phone : '',
      email: customer ? customer.email : ''
    },
    rental_start: rental.rental_start,
    rental_end: rental.rental_end,
    days: days,
    status: rental.status,
    items: enrichedItems,
    services: serviceItems.map(s => ({
      description: s.description || s.service_type,
      unit_price: parseFloat(s.unit_price || 0),
      quantity: parseInt(s.quantity || 1),
      line_total: parseFloat(s.line_total || 0)
    })),
    total_amount: parseFloat(rental.total_amount || 0),
    paid_amount: parseFloat(rental.paid_amount || 0),
    tax_rate: parseFloat(rental.tax_rate || 0.05),
    deposit_status: rental.deposit_status || '',
    payments: payments.map(p => ({
      payment_id: p.payment_id,
      amount: parseFloat(p.amount || 0),
      method: p.payment_method || '',
      date: p.payment_date || ''
    })),
    notes: rental.notes || '',
    created_at: rental.created_at,
    generated_at: new Date().toISOString()
  };
}

/**
 * Generate venue booking receipt data
 * @param {string} bookingId
 * @return {Object} Booking receipt data
 */
function generateVenueBookingReceipt(bookingId) {
  const booking = getSheetData('Venue_Bookings').find(b => b.booking_id === bookingId && !b.is_deleted);
  if (!booking) throw new Error('找不到預約單: ' + bookingId);

  const customer = getSheetData('Customers').find(c => c.customer_id === booking.customer_id);
  const venue = getSheetData('Venues').find(v => v.venue_id === booking.venue_id);
  const payments = getSheetData('Payments').filter(p => p.booking_id === bookingId && !p.is_deleted);

  return {
    booking_id: bookingId,
    venue: {
      name: venue ? (venue.name || venue.venue_name) : '未知',
      type: venue ? venue.venue_type : '',
      address: venue ? venue.address : ''
    },
    customer: {
      name: customer ? customer.name : '未知',
      company: customer ? customer.company_name : '',
      phone: customer ? customer.phone : '',
      email: customer ? customer.email : ''
    },
    booking_start: booking.booking_start,
    booking_end: booking.booking_end,
    rate_type: booking.rate_type,
    total_amount: parseFloat(booking.total_amount || 0),
    paid_amount: parseFloat(booking.paid_amount || 0),
    status: booking.status,
    special_requirements: booking.special_requirements || '',
    payments: payments.map(p => ({
      payment_id: p.payment_id,
      amount: parseFloat(p.amount || 0),
      method: p.payment_method || '',
      date: p.payment_date || ''
    })),
    created_at: booking.created_at,
    generated_at: new Date().toISOString()
  };
}

/**
 * ==================== QR CODE ====================
 */

/**
 * Generate QR code URL for equipment unit
 * Uses Google Charts API for QR generation
 * @param {string} unitId
 * @return {Object} QR code info
 */
function getEquipmentQRData(unitId) {
  const unit = getSheetData('Equipment_Units').find(u => u.unit_id === unitId && !u.is_deleted);
  if (!unit) throw new Error('找不到器材: ' + unitId);

  const type = getSheetData('Equipment_Types').find(t => t.type_id === unit.type_id);
  const location = getSheetData('Storage_Locations').find(l => l.location_id === unit.location_id);

  const qrData = JSON.stringify({
    id: unit.unit_id,
    code: unit.internal_code,
    type: type ? type.type_name : unit.type_id,
    sn: unit.serial_number || ''
  });

  return {
    unit_id: unit.unit_id,
    internal_code: unit.internal_code || unit.unit_id,
    type_name: type ? type.type_name : unit.type_id,
    category: type ? type.category : '',
    serial_number: unit.serial_number || '',
    status: unit.status,
    location_name: location ? location.location_name : '',
    daily_rate: type ? parseFloat(type.daily_rate || 0) : 0,
    replacement_value: type ? parseFloat(type.replacement_value || 0) : 0,
    qr_url: 'https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=' + encodeURIComponent(qrData)
  };
}

/**
 * Get QR data for multiple units (batch label printing)
 * @param {string[]} unitIds - Array of unit IDs (optional, all if empty)
 * @return {Object[]} Array of QR data objects
 */
function getEquipmentQRBatch(unitIds) {
  const allUnits = getSheetData('Equipment_Units').filter(u => !u.is_deleted);
  const types = getSheetData('Equipment_Types');
  const locations = getSheetData('Storage_Locations');

  const typeMap = {};
  types.forEach(t => { typeMap[t.type_id] = t; });
  const locMap = {};
  locations.forEach(l => { locMap[l.location_id] = l; });

  let targetUnits = allUnits;
  if (unitIds && unitIds.length > 0) {
    targetUnits = allUnits.filter(u => unitIds.includes(u.unit_id));
  }

  return targetUnits.map(unit => {
    const type = typeMap[unit.type_id] || {};
    const loc = locMap[unit.location_id] || {};
    const qrData = JSON.stringify({
      id: unit.unit_id,
      code: unit.internal_code,
      type: type.type_name || unit.type_id,
      sn: unit.serial_number || ''
    });

    return {
      unit_id: unit.unit_id,
      internal_code: unit.internal_code || unit.unit_id,
      type_name: type.type_name || unit.type_id,
      category: type.category || '',
      serial_number: unit.serial_number || '',
      daily_rate: parseFloat(type.daily_rate || 0),
      location_name: loc.location_name || '',
      qr_url: 'https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=' + encodeURIComponent(qrData)
    };
  });
}

/**
 * ==================== EMAIL NOTIFICATIONS ====================
 */

/**
 * Send rental confirmation email
 * @param {string} rentalId
 */
function sendRentalConfirmationEmail(rentalId) {
  const receipt = generateRentalReceipt(rentalId);
  if (!receipt.customer.email) {
    return { success: false, message: '客戶沒有設定電子郵件' };
  }

  const itemLines = receipt.items.map(i =>
    `  - ${i.type_name} (${i.internal_code}) × ${i.days}天 = NT$${i.line_total.toLocaleString()}`
  ).join('\n');

  const subject = `【映奧創意】租借確認 - ${rentalId}`;
  const body = `${receipt.customer.name} 您好，

感謝您的租借！以下是您的租借確認資訊：

租借單號：${receipt.rental_id}
租借期間：${formatDate(receipt.rental_start)} 至 ${formatDate(receipt.rental_end)}（共 ${receipt.days} 天）

租借器材：
${itemLines}

合計金額：NT$${receipt.total_amount.toLocaleString()}
已付金額：NT$${receipt.paid_amount.toLocaleString()}

注意事項：
1. 請於租借開始日前來取件
2. 請於租借結束日當天歸還
3. 逾期將產生額外費用

如有任何問題，請聯繫我們。

映奧創意工作室
`;

  try {
    MailApp.sendEmail({
      to: receipt.customer.email,
      subject: subject,
      body: body
    });
    return { success: true, message: `確認信已寄送至 ${receipt.customer.email}` };
  } catch (e) {
    return { success: false, message: '寄信失敗: ' + e.message };
  }
}

/**
 * Send venue booking confirmation email
 * @param {string} bookingId
 */
function sendVenueBookingConfirmationEmail(bookingId) {
  const receipt = generateVenueBookingReceipt(bookingId);
  if (!receipt.customer.email) {
    return { success: false, message: '客戶沒有設定電子郵件' };
  }

  const rateLabels = { hourly: '時租', half_day: '半日租', daily: '日租' };

  const subject = `【映奧創意】場地預約確認 - ${bookingId}`;
  const body = `${receipt.customer.name} 您好，

感謝您的場地預約！以下是您的預約確認資訊：

預約單號：${receipt.booking_id}
場地名稱：${receipt.venue.name}
預約時段：${receipt.booking_start} 至 ${receipt.booking_end}
計費方式：${rateLabels[receipt.rate_type] || receipt.rate_type}

合計金額：NT$${receipt.total_amount.toLocaleString()}
${receipt.special_requirements ? '特殊需求：' + receipt.special_requirements : ''}

注意事項：
1. 請於預約時段準時到達
2. 使用完畢請恢復場地原貌
3. 如需取消請提前通知

如有任何問題，請聯繫我們。

映奧創意工作室
`;

  try {
    MailApp.sendEmail({
      to: receipt.customer.email,
      subject: subject,
      body: body
    });
    return { success: true, message: `確認信已寄送至 ${receipt.customer.email}` };
  } catch (e) {
    return { success: false, message: '寄信失敗: ' + e.message };
  }
}

/**
 * Send return reminder email (for rentals ending soon)
 * @param {string} rentalId
 */
function sendReturnReminderEmail(rentalId) {
  const receipt = generateRentalReceipt(rentalId);
  if (!receipt.customer.email) {
    return { success: false, message: '客戶沒有設定電子郵件' };
  }

  const subject = `【映奧創意】歸還提醒 - ${rentalId}`;
  const body = `${receipt.customer.name} 您好，

提醒您，以下租借單即將到期：

租借單號：${receipt.rental_id}
歸還日期：${formatDate(receipt.rental_end)}

請準時歸還以避免產生逾期費用。

映奧創意工作室
`;

  try {
    MailApp.sendEmail({
      to: receipt.customer.email,
      subject: subject,
      body: body
    });
    return { success: true, message: `提醒信已寄送至 ${receipt.customer.email}` };
  } catch (e) {
    return { success: false, message: '寄信失敗: ' + e.message };
  }
}

/**
 * Send overdue notice email
 * @param {string} rentalId
 */
function sendOverdueNoticeEmail(rentalId) {
  const receipt = generateRentalReceipt(rentalId);
  if (!receipt.customer.email) {
    return { success: false, message: '客戶沒有設定電子郵件' };
  }

  const subject = `【映奧創意】逾期通知 - ${rentalId}`;
  const body = `${receipt.customer.name} 您好，

您的租借單已逾期，請盡速歸還：

租借單號：${receipt.rental_id}
原定歸還日期：${formatDate(receipt.rental_end)}

逾期將持續產生額外費用，請儘速與我們聯繫處理。

映奧創意工作室
`;

  try {
    MailApp.sendEmail({
      to: receipt.customer.email,
      subject: subject,
      body: body
    });
    return { success: true, message: `逾期通知已寄送至 ${receipt.customer.email}` };
  } catch (e) {
    return { success: false, message: '寄信失敗: ' + e.message };
  }
}

/**
 * Scheduled function: check and send reminders for rentals due tomorrow
 * Set up as a daily time-driven trigger
 */
function scheduledSendReturnReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  const rentals = getSheetData('Rentals').filter(r =>
    !r.is_deleted &&
    (r.status === 'active' || r.status === 'reserved') &&
    formatDate(r.rental_end) === tomorrowStr
  );

  const results = [];
  rentals.forEach(rental => {
    const result = sendReturnReminderEmail(rental.rental_id);
    results.push({ rental_id: rental.rental_id, ...result });
  });

  return { sent: results.length, results: results };
}

/**
 * Scheduled function: check and send overdue notices
 * Set up as a daily time-driven trigger
 */
function scheduledSendOverdueNotices() {
  const today = new Date();
  const todayStr = formatDate(today);

  const rentals = getSheetData('Rentals').filter(r =>
    !r.is_deleted &&
    r.status === 'overdue'
  );

  const results = [];
  rentals.forEach(rental => {
    const result = sendOverdueNoticeEmail(rental.rental_id);
    results.push({ rental_id: rental.rental_id, ...result });
  });

  return { sent: results.length, results: results };
}
