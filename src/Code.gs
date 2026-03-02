/**
 * 映奧創意工作室 - 器材管理租借系統
 * Equipment Management & Rental System
 * Main Application Code
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SPREADSHEET = SpreadsheetApp.getActiveSpreadsheet();

// Debug mode flag
const DEBUG_MODE = false;

/**
 * ==================== SCHEMA DEFINITIONS ====================
 * Single source of truth for all sheet definitions.
 * All diagnostic, validation, and repair functions reference this.
 */
function getSchemaDefinitions() {
  return [
    { name: 'Equipment_Types', headers: ['type_id','name','category','sub_category','model','brand','daily_rate','replacement_value','deposit_required','is_consumable','is_batch_item','batch_unit','description','image_url','active','created_by','created_at','type_name','is_deleted'] },
    { name: 'Equipment_Units', headers: ['unit_id','type_id','serial_number','internal_code','purchase_date','purchase_cost','current_condition','location_id','batch_quantity','status','notes','created_by','created_at','category','is_deleted'] },
    { name: 'Customers', headers: ['customer_id','name','phone','email','id_number','company_name','id_doc_url','id_doc_verified','id_doc_verified_by','id_doc_verified_at','id_doc_return_status','id_doc_return_date','blacklisted','blacklist_reason','notes','created_at','credit_balance','is_deleted'] },
    { name: 'Rentals', headers: ['rental_id','customer_id','rental_start','rental_end','actual_pickup_date','actual_return_date','total_days','subtotal','discount_total','overdue_fee','tax_rate','tax_amount','total_amount','deposit_amount','deposit_status','deposit_received_by','delivery_required','delivery_address','delivery_contact','delivery_contact_phone','delivery_notes','use_purpose','use_risk_category','risk_acknowledged','risk_surcharge','risk_doc_url','contract_url','contract_signed','invoice_required','tax_id_number','invoice_title','invoice_number','invoice_status','invoice_url','rental_detail_pdf_url','prepared_by','handled_by','approved_by','status','cancellation_date','cancellation_reason','cancellation_fee','cancellation_refund_amount','cancellation_approved_by','created_at','updated_at','paid_amount','notes','is_deleted'] },
    { name: 'Rental_Items', headers: ['item_id','rental_id','type_id','unit_id','quantity','daily_rate_snapshot','replacement_value_snapshot','days','line_total','discount_rule_id','discount_amount','line_total_after_discount','condition_out','condition_out_photo_url','condition_in','condition_in_photo_url','checked_out_by','checked_in_by','return_status','returned_quantity','return_date','notes','is_deleted'] },
    { name: 'Payments', headers: ['payment_id','rental_id','payment_type','amount','credit_note_id','payment_method','payer_account_last5','receive_channel','received_by','relay_status','relay_date','relay_proof_url','payment_date','receipt_url','receipt_pdf_url','notes','booking_id','is_deleted'] },
    { name: 'Maintenance_Logs', headers: ['log_id','unit_id','maintenance_type','description','performed_by','vendor','cost','start_date','end_date','next_scheduled','before_photo_url','after_photo_url','status','notes','scheduled_date','completed_date','created_at','is_deleted'] },
    { name: 'Inventory_Logs', headers: ['log_id','unit_id','rental_id','log_type','log_date','performed_by','from_location_id','to_location_id','condition_before','condition_after','checklist_completed','checklist_details','accessories_complete','missing_accessories','needs_maintenance','needs_cleaning','damage_found','damage_id','photo_urls','inspection_certificate_url','inspection_deadline','inspection_completed_at','inspection_overdue','checklist_pdf_url','notes','change_type','quantity_change','from_location','to_location','reason','created_at','is_deleted'] },
    { name: 'Storage_Locations', headers: ['location_id','name','location_type','parent_location_id','floor_number','address','capacity_note','responsible_staff','active','notes','location_name','parent_id','capacity','is_deleted'] },
    { name: 'Staff', headers: ['staff_id','name','email','phone','role','can_approve_discount','active','created_at','is_deleted'] },
    { name: 'Discount_Rules', headers: ['rule_id','rule_name','applies_to','target_id','min_days','max_days','discount_type','discount_value','requires_approval','active','created_at','min_amount','applicable_types','applicable_categories','is_deleted'] },
    { name: 'Accessory_Bindings', headers: ['binding_id','parent_type_id','accessory_type_id','quantity','is_mandatory','notes','binding_type','is_deleted'] },
    { name: 'Damage_Records', headers: ['damage_id','rental_id','unit_id','damage_description','damage_severity','within_tolerance','repair_cost','compensation_amount','photo_url','assessed_by','status','resolution_notes','damage_report_pdf_url','created_at','damage_type','description','severity','replacement_cost','reported_by','reported_at','notes','is_deleted'] },
    { name: 'Credit_Notes', headers: ['credit_note_id','rental_id','credit_type','related_item_id','related_damage_id','original_amount','credit_amount','reason','evidence_url','requested_by','approved_by','approval_status','rejection_reason','refund_method','refund_status','created_at','booking_id','customer_id','amount','status','is_deleted'] },
    { name: 'Service_Items', headers: ['service_item_id','rental_id','service_type','description','quantity','unit','unit_price','line_total','performed_by','service_date','service_address','notes','booking_id','is_deleted'] },
    { name: 'Overdue_Rules', headers: ['overdue_rule_id','applies_to','target_category','multiplier','grace_period_hours','max_penalty_rate','forced_purchase_days','forced_purchase_note','active','rule_name','grace_period_days','daily_penalty_rate','max_penalty_percent','is_deleted'] },
    { name: 'Wear_Tolerance', headers: ['tolerance_id','category','acceptable_wear','unacceptable_wear','assessment_checklist','notes','condition_field','acceptable_threshold','is_deleted'] },
    { name: 'Print_Templates', headers: ['template_id','template_name','template_type','google_doc_template_id','output_folder_id','paper_size','orientation','include_company_header','include_signature_line','include_photos','version','active','notes','created_at','updated_at','doc_template_id','is_deleted'] },
    { name: 'Rental_Addendums', headers: ['addendum_id','rental_id','addendum_type','description','original_end_date','new_end_date','additional_amount','addendum_contract_url','signed','created_by','approved_by','created_at','amount_change','is_deleted'] },
    { name: 'Stocktake_Plans', headers: ['plan_id','plan_name','stocktake_type','scope_type','scope_categories','scope_location_id','scheduled_date','deadline','assigned_to','supervised_by','status','total_expected','total_counted','total_matched','total_discrepancy','completion_rate','summary_notes','report_pdf_url','created_by','created_at','completed_at','plan_type','is_deleted'] },
    { name: 'Stocktake_Results', headers: ['result_id','plan_id','unit_id','expected_location_id','actual_location_id','location_match','expected_status','actual_status','status_match','expected_condition','actual_condition','condition_match','expected_quantity','actual_quantity','quantity_match','result','photo_url','resolution_action','resolution_notes','resolved_by','resolved_at','counted_by','counted_at','expected_location','actual_location','physical_count','system_count','condition_found','discrepancy_type','resolution','recorded_at','is_deleted'] },
    { name: 'Venues', headers: ['venue_id','name','venue_type','address','floor','floor_area_sqm','max_capacity','hourly_rate','half_day_rate','daily_rate','overtime_hourly_rate','deposit_required','min_booking_hours','available_start_time','available_end_time','amenities','power_specs','ceiling_height_m','has_cyclorama','cyclorama_color','has_blackout','has_loading_dock','parking_info','rules','description','image_urls','floor_plan_url','location_id','active','notes','created_by','created_at','is_deleted'] },
    { name: 'Venue_Bookings', headers: ['booking_id','venue_id','customer_id','rental_id','booking_start','booking_end','actual_start','actual_end','total_hours','overtime_hours','rate_type','unit_rate','rate_quantity','subtotal','overtime_fee','discount_amount','tax_rate','tax_amount','total_amount','deposit_amount','deposit_status','attendee_count','use_purpose','setup_required','setup_notes','cleanup_included','special_requirements','contract_url','contract_signed','invoice_required','invoice_status','invoice_number','prepared_by','handled_by','approved_by','status','cancellation_date','cancellation_reason','cancellation_fee','post_use_condition','damage_description','damage_fee','notes','paid_amount','created_at','updated_at','is_deleted'] },
    { name: 'Activity_Logs', headers: ['log_id','staff_id','staff_name','action','target_type','target_id','description','ip_info','created_at'] },
    { name: 'Error_Logs', headers: ['error_id','timestamp','function_name','error_message','stack_trace','user_email','severity','context'] }
  ];
}

/**
 * ==================== DEBUG / DIAGNOSTICS ====================
 */

/**
 * Check all required sheets exist and report status
 * @return {Object} Diagnostics result
 */
function debugCheckSheets() {
  requirePermission('*', '僅管理員可使用診斷功能');
  const requiredSheets = getSchemaDefinitions();

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
 * Validate database schema: compare actual sheet headers against expected definitions.
 * Reports missing sheets, missing columns, extra columns, and column order mismatches.
 * @return {Object} Validation result
 */
function validateDatabaseSchema() {
  requirePermission('*', '僅管理員可使用資料庫檢查功能');

  const requiredSheets = getSchemaDefinitions();

  const allSheets = SPREADSHEET.getSheets().map(s => s.getName());
  const report = {
    timestamp: new Date().toISOString(),
    total_expected: requiredSheets.length,
    total_existing: 0,
    missing_sheets: [],
    extra_sheets: [],
    sheets: [],
    errors: 0,
    warnings: 0
  };

  // Check each required sheet
  requiredSheets.forEach(req => {
    const sheet = SPREADSHEET.getSheetByName(req.name);
    const entry = {
      name: req.name,
      status: 'ok',
      rows: 0,
      expected_columns: req.headers.length,
      actual_columns: 0,
      missing_columns: [],
      extra_columns: [],
      order_mismatch: false,
      details: []
    };

    if (!sheet) {
      entry.status = 'missing';
      entry.details.push('工作表不存在');
      report.missing_sheets.push(req.name);
      report.errors++;
      report.sheets.push(entry);
      return;
    }

    report.total_existing++;
    const lastRow = sheet.getLastRow();
    entry.rows = Math.max(0, lastRow - 1);

    // Get actual headers
    const rawHeaders = lastRow > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    const actualHeaders = rawHeaders.map(h => String(h).trim().toLowerCase());
    const expectedHeaders = req.headers.map(h => h.toLowerCase());
    entry.actual_columns = actualHeaders.length;

    // Find missing columns (expected but not in sheet)
    expectedHeaders.forEach((col, idx) => {
      if (!actualHeaders.includes(col)) {
        entry.missing_columns.push({ column: req.headers[idx], expected_position: idx + 1 });
      }
    });

    // Find extra columns (in sheet but not expected)
    actualHeaders.forEach((col, idx) => {
      if (col && !expectedHeaders.includes(col)) {
        entry.extra_columns.push({ column: rawHeaders[idx], position: idx + 1 });
      }
    });

    // Check column order
    if (entry.missing_columns.length === 0 && entry.extra_columns.length === 0) {
      for (let i = 0; i < expectedHeaders.length; i++) {
        if (actualHeaders[i] !== expectedHeaders[i]) {
          entry.order_mismatch = true;
          entry.details.push(`欄位順序不一致：位置 ${i + 1} 預期「${req.headers[i]}」但實際是「${rawHeaders[i]}」`);
        }
      }
    }

    // Set status
    if (entry.missing_columns.length > 0) {
      entry.status = 'error';
      entry.details.push(`缺少 ${entry.missing_columns.length} 個欄位：${entry.missing_columns.map(c => c.column).join(', ')}`);
      report.errors++;
    }
    if (entry.extra_columns.length > 0) {
      entry.status = entry.status === 'error' ? 'error' : 'warning';
      entry.details.push(`多出 ${entry.extra_columns.length} 個欄位：${entry.extra_columns.map(c => c.column).join(', ')}`);
      report.warnings++;
    }
    if (entry.order_mismatch && entry.status === 'ok') {
      entry.status = 'warning';
      report.warnings++;
    }

    report.sheets.push(entry);
  });

  // Find extra sheets not in definition
  const requiredNames = requiredSheets.map(r => r.name);
  allSheets.forEach(name => {
    if (!requiredNames.includes(name)) {
      report.extra_sheets.push(name);
    }
  });

  return report;
}

/**
 * Auto-repair database schema: add missing columns to existing sheets,
 * create missing sheets. Does NOT delete extra columns (data safety).
 * @return {Object} Repair result
 */
function repairDatabaseSchema() {
  requirePermission('*', '僅管理員可使用資料庫修復功能');

  const validation = validateDatabaseSchema();
  const actions = [];

  const defMap = {};
  getSchemaDefinitions().forEach(r => { defMap[r.name] = r.headers; });

  validation.sheets.forEach(entry => {
    if (entry.status === 'missing') {
      // Create missing sheet
      const headers = defMap[entry.name];
      if (headers) {
        const newSheet = SPREADSHEET.insertSheet(entry.name);
        newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        newSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        newSheet.setFrozenRows(1);
        actions.push({ sheet: entry.name, action: 'created', detail: `建立工作表，${headers.length} 個欄位` });
      }
    } else if (entry.missing_columns.length > 0) {
      // Append missing columns to existing sheet
      const sheet = SPREADSHEET.getSheetByName(entry.name);
      const lastCol = sheet.getLastColumn();
      entry.missing_columns.forEach(col => {
        const newCol = lastCol + 1 + entry.missing_columns.indexOf(col);
        sheet.getRange(1, newCol).setValue(col.column).setFontWeight('bold');
        actions.push({ sheet: entry.name, action: 'added_column', detail: `新增欄位「${col.column}」於第 ${newCol} 欄` });
      });
    }
  });

  return {
    success: true,
    message: actions.length > 0 ? `已執行 ${actions.length} 項修復` : '無需修復，資料庫結構正確',
    actions: actions,
    revalidate_needed: actions.length > 0
  };
}

/**
 * Auto-create all missing sheets with proper headers
 * @return {Object} Creation result
 */
function ensureRequiredSheets() {
  requirePermission('*', '僅管理員可使用此功能');
  const diag = debugCheckSheets();
  const created = [];

  if (diag.missing.length === 0) {
    return { message: '所有必要的工作表都已存在', created: [] };
  }

  const defMap = {};
  getSchemaDefinitions().forEach(r => { defMap[r.name] = r.headers; });

  diag.missing.forEach(sheetName => {
    const headers = defMap[sheetName];
    if (headers) {
      const newSheet = SPREADSHEET.insertSheet(sheetName);
      newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
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
  requirePermission('*', '僅管理員可使用 debugCall');
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
  requirePermission('*', '僅管理員可使用診斷功能');
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

/**
 * ==================== ERROR LOGGING ====================
 * Write errors to Error_Logs sheet for persistent, queryable debugging.
 * This runs independently of Logger.log and is visible from the debug panel.
 */
function logError(functionName, error, severity, context) {
  try {
    const sheet = SPREADSHEET.getSheetByName('Error_Logs');
    if (!sheet) return; // Don't throw if sheet doesn't exist yet

    let email = '';
    try { email = Session.getActiveUser().getEmail(); } catch (_) {}

    const row = [
      'ERR-' + Date.now(),
      new Date(),
      functionName || '',
      error instanceof Error ? error.message : String(error || ''),
      error instanceof Error ? (error.stack || '') : '',
      email,
      severity || 'error',
      typeof context === 'object' ? JSON.stringify(context) : String(context || '')
    ];
    sheet.appendRow(row);
  } catch (e) {
    // Last resort — don't let error logging itself crash the app
    Logger.log('logError failed: ' + e.toString());
  }
}

/**
 * Get recent error logs for the debug panel
 */
function getRecentErrors(limit) {
  requirePermission('*', '僅管理員可使用診斷功能');
  const count = limit || 50;
  try {
    const data = getSheetData('Error_Logs');
    data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return data.slice(0, count);
  } catch (e) {
    return [];
  }
}

/**
 * Clear old error logs (keep last N entries)
 */
function clearOldErrors(keepCount) {
  requirePermission('*', '僅管理員可使用診斷功能');
  const keep = keepCount || 200;
  const sheet = SPREADSHEET.getSheetByName('Error_Logs');
  if (!sheet) return { cleared: 0 };
  const lastRow = sheet.getLastRow();
  if (lastRow <= keep + 1) return { cleared: 0 }; // +1 for header
  const deleteCount = lastRow - keep - 1;
  sheet.deleteRows(2, deleteCount); // Keep header row
  return { cleared: deleteCount, remaining: keep };
}

/**
 * Comprehensive data integrity diagnosis.
 * Checks for orphaned records, broken references, and inconsistencies.
 * Returns a structured report that Claude or admins can read.
 */
function debugDiagnoseData() {
  requirePermission('*', '僅管理員可使用診斷功能');

  const report = { timestamp: new Date().toISOString(), issues: [], summary: {} };

  try {
    // Load core data
    const rentals    = getSheetData('Rentals');
    const items      = getSheetData('Rental_Items');
    const payments   = getSheetData('Payments');
    const customers  = getSheetData('Customers');
    const types      = getSheetData('Equipment_Types');
    const units      = getSheetData('Equipment_Units');
    const staff      = getSheetData('Staff');
    const bookings   = getSheetData('Venue_Bookings');
    const venues     = getSheetData('Venues');

    const custIds   = new Set(customers.map(c => c.customer_id));
    const rentalIds = new Set(rentals.map(r => r.rental_id));
    const typeIds   = new Set(types.map(t => t.type_id));
    const unitIds   = new Set(units.map(u => u.unit_id));
    const staffIds  = new Set(staff.map(s => s.staff_id));
    const venueIds  = new Set(venues.map(v => v.venue_id));

    // 1. Rentals referencing non-existent customers
    rentals.filter(r => !r.is_deleted && r.customer_id && !custIds.has(r.customer_id)).forEach(r => {
      report.issues.push({ severity: 'error', type: 'orphan_ref', table: 'Rentals', id: r.rental_id, detail: `customer_id "${r.customer_id}" 不存在於 Customers` });
    });

    // 2. Rental_Items referencing non-existent rentals
    items.filter(i => !i.is_deleted && i.rental_id && !rentalIds.has(i.rental_id)).forEach(i => {
      report.issues.push({ severity: 'error', type: 'orphan_ref', table: 'Rental_Items', id: i.item_id, detail: `rental_id "${i.rental_id}" 不存在於 Rentals` });
    });

    // 3. Rental_Items referencing non-existent types or units
    items.filter(i => !i.is_deleted && i.type_id && !typeIds.has(i.type_id)).forEach(i => {
      report.issues.push({ severity: 'warning', type: 'orphan_ref', table: 'Rental_Items', id: i.item_id, detail: `type_id "${i.type_id}" 不存在於 Equipment_Types` });
    });
    items.filter(i => !i.is_deleted && i.unit_id && !unitIds.has(i.unit_id)).forEach(i => {
      report.issues.push({ severity: 'warning', type: 'orphan_ref', table: 'Rental_Items', id: i.item_id, detail: `unit_id "${i.unit_id}" 不存在於 Equipment_Units` });
    });

    // 4. Payments referencing non-existent rentals
    payments.filter(p => !p.is_deleted && p.rental_id && !rentalIds.has(p.rental_id)).forEach(p => {
      report.issues.push({ severity: 'error', type: 'orphan_ref', table: 'Payments', id: p.payment_id, detail: `rental_id "${p.rental_id}" 不存在於 Rentals` });
    });

    // 5. Venue_Bookings referencing non-existent venues or customers
    bookings.filter(b => !b.is_deleted && b.venue_id && !venueIds.has(b.venue_id)).forEach(b => {
      report.issues.push({ severity: 'error', type: 'orphan_ref', table: 'Venue_Bookings', id: b.booking_id, detail: `venue_id "${b.venue_id}" 不存在於 Venues` });
    });
    bookings.filter(b => !b.is_deleted && b.customer_id && !custIds.has(b.customer_id)).forEach(b => {
      report.issues.push({ severity: 'error', type: 'orphan_ref', table: 'Venue_Bookings', id: b.booking_id, detail: `customer_id "${b.customer_id}" 不存在於 Customers` });
    });

    // 6. Equipment_Units referencing non-existent types
    units.filter(u => !u.is_deleted && u.type_id && !typeIds.has(u.type_id)).forEach(u => {
      report.issues.push({ severity: 'warning', type: 'orphan_ref', table: 'Equipment_Units', id: u.unit_id, detail: `type_id "${u.type_id}" 不存在於 Equipment_Types` });
    });

    // 7. Rentals with payment mismatch
    rentals.filter(r => !r.is_deleted && r.status !== 'draft' && r.status !== 'cancelled').forEach(r => {
      const totalPaid = payments
        .filter(p => !p.is_deleted && p.rental_id === r.rental_id)
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const expected = parseFloat(r.total_amount) || 0;
      if (expected > 0 && Math.abs(totalPaid - expected) > 1) {
        report.issues.push({ severity: 'info', type: 'payment_mismatch', table: 'Rentals', id: r.rental_id, detail: `應收 ${expected}，已收 ${totalPaid}，差額 ${(expected - totalPaid).toFixed(0)}` });
      }
    });

    // 8. Staff with no email (can't login)
    staff.filter(s => !s.is_deleted && s.active !== false && s.active !== 'false' && !s.email).forEach(s => {
      report.issues.push({ severity: 'warning', type: 'missing_data', table: 'Staff', id: s.staff_id, detail: `員工「${s.name}」缺少 email，無法登入` });
    });

    // Summary
    const errors   = report.issues.filter(i => i.severity === 'error').length;
    const warnings = report.issues.filter(i => i.severity === 'warning').length;
    const infos    = report.issues.filter(i => i.severity === 'info').length;
    report.summary = {
      total_issues: report.issues.length,
      errors, warnings, infos,
      tables_checked: ['Rentals','Rental_Items','Payments','Customers','Equipment_Types','Equipment_Units','Staff','Venue_Bookings','Venues'],
      record_counts: {
        rentals: rentals.length, rental_items: items.length, payments: payments.length,
        customers: customers.length, types: types.length, units: units.length,
        staff: staff.length, bookings: bookings.length, venues: venues.length
      }
    };

  } catch (e) {
    report.issues.push({ severity: 'fatal', type: 'diagnosis_error', detail: e.message, stack: e.stack });
    logError('debugDiagnoseData', e, 'fatal');
  }

  return report;
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
    const emailLower = email.toLowerCase().trim();
    const staff = getSheetData('Staff').find(s => {
      const deleted = s.is_deleted;
      if (deleted === true || deleted === 'true' || deleted === 'TRUE') return false;
      const active = s.active;
      if (active === false || active === 'false' || active === 'FALSE') return false;
      return String(s.email || '').toLowerCase().trim() === emailLower;
    });
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
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Get the customer-facing URL
 * @return {string} URL with ?mode=customer
 */
function getCustomerAppUrl() {
  return ScriptApp.getService().getUrl() + '?mode=customer';
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
  return getSheetData('Equipment_Types').filter(t => !t.is_deleted);
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
  requirePermission('update', '無權限編輯器材類型');
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
  return getSheetDataFiltered('Equipment_Units', filters).filter(u => !u.is_deleted);
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
  requirePermission('update', '無權限編輯器材個體');
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
  return getSheetDataFiltered('Customers', filters).filter(c => !c.is_deleted);
}

function createCustomer(customerData) {
  requirePermission('create', '無權限建立客戶');
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
  requirePermission('update', '無權限編輯客戶資料');
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
  if (!data.email || data.email.trim() === '') {
    errors.push('電子郵件必填');
  } else if (!isValidEmail(data.email)) {
    errors.push('電子郵件格式不正確');
  }

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
  return getSheetDataFiltered('Rentals', filters).filter(r => !r.is_deleted);
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
  requirePermission('update', '無權限編輯租借單');
  updates.updated_at = new Date();
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
  return getSheetDataFiltered('Rental_Items', { rental_id: rentalId }).filter(ri => !ri.is_deleted);
}

function createRentalItem(itemData) {
  requirePermission('create', '無權限建立租借項目');
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
  requirePermission('update', '無權限編輯租借項目');
  return updateSheetRow('Rental_Items', 'item_id', itemId, updates);
}

/**
 * ==================== PAYMENT FUNCTIONS ====================
 */

function getPayments(filters = {}) {
  return getSheetDataFiltered('Payments', filters).filter(p => !p.is_deleted);
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
  return getSheetDataFiltered('Maintenance_Logs', filters).filter(l => !l.is_deleted);
}

function createMaintenanceLog(logData) {
  requirePermission('create', '無權限建立維護紀錄');
  logData.log_id = generateNextId('Maintenance_Logs', 'log_id', 'ML');
  logData.logged_at = new Date();
  logData.is_deleted = false;

  return appendSheetRow('Maintenance_Logs', logData);
}

/**
 * ==================== INVENTORY FUNCTIONS ====================
 */

function getInventoryLogs(filters = {}) {
  return getSheetDataFiltered('Inventory_Logs', filters).filter(l => !l.is_deleted);
}

function createInventoryLog(logData) {
  requirePermission('create', '無權限建立庫存紀錄');
  logData.log_id = generateNextId('Inventory_Logs', 'log_id', 'IL');
  logData.logged_at = new Date();
  logData.is_deleted = false;

  return appendSheetRow('Inventory_Logs', logData);
}

/**
 * ==================== STOCKTAKE FUNCTIONS ====================
 */

function getStocktakePlans(filters = {}) {
  return getSheetDataFiltered('Stocktake_Plans', filters).filter(p => !p.is_deleted);
}

function createStocktakePlan(planData) {
  requirePermission('create', '無權限建立盤點計畫');
  planData.plan_id = generateYearBasedId('Stocktake_Plans', 'plan_id', 'SP');
  planData.created_at = new Date();
  planData.status = 'draft';
  planData.is_deleted = false;

  return appendSheetRow('Stocktake_Plans', planData);
}

function getStocktakeResults(planId) {
  return getSheetDataFiltered('Stocktake_Results', { stocktake_plan_id: planId }).filter(r => !r.is_deleted);
}

function createStocktakeResult(resultData) {
  requirePermission('create', '無權限建立盤點結果');
  resultData.result_id = generateNextId('Stocktake_Results', 'result_id', 'SR');
  resultData.recorded_at = new Date();
  resultData.is_deleted = false;

  return appendSheetRow('Stocktake_Results', resultData);
}

/**
 * Bootstrap: seed the first admin account when Staff sheet is empty.
 * Uses the currently logged-in Google account as the admin.
 * Can only be called once (no-ops if any staff exist).
 * @return {Object} result
 */
function bootstrapFirstAdmin() {
  const allStaff = getSheetData('Staff');
  if (allStaff.length > 0) {
    throw new Error('系統已有員工資料，無法使用此功能。請以管理員帳號登入後新增員工。');
  }

  const email = Session.getActiveUser().getEmail();
  if (!email) {
    throw new Error('無法取得目前登入者的 Email，請確認已授權 Google 帳號。');
  }

  const staffData = {
    staff_id: generateNextId('Staff', 'staff_id', 'S'),
    name: email.split('@')[0],
    email: email,
    phone: '',
    role: 'admin',
    can_approve_discount: true,
    active: true,
    created_at: new Date(),
    is_deleted: false
  };

  appendSheetRow('Staff', staffData);
  return {
    success: true,
    message: `已建立管理員帳號：${email}`,
    staff: staffData
  };
}

/**
 * ==================== STAFF FUNCTIONS ====================
 */

function getStaff(filters = {}) {
  return getSheetDataFiltered('Staff', filters).filter(s => !s.is_deleted);
}

function createStaff(staffData) {
  requirePermission('manage_staff', '無權限建立員工');
  staffData.staff_id = generateNextId('Staff', 'staff_id', 'S');
  staffData.created_at = new Date();
  staffData.is_deleted = false;

  return appendSheetRow('Staff', staffData);
}

function updateStaff(staffId, updates) {
  requirePermission('manage_staff', '無權限編輯員工');
  return updateSheetRow('Staff', 'staff_id', staffId, updates);
}

function deleteStaff(staffId) {
  requirePermission('manage_staff', '無權限刪除員工');
  return updateSheetRow('Staff', 'staff_id', staffId, { is_deleted: true, active: false });
}

/**
 * Get role permission definitions for frontend display
 */
function getRolePermissions() {
  requirePermission('manage_staff', '無權限檢視角色權限');
  return {
    roles: ROLE_PERMISSIONS,
    labels: {
      admin: '管理員',
      manager: '經理',
      staff: '員工',
      viewer: '僅檢視'
    },
    permissionLabels: {
      '*': '完整權限',
      'read': '查看資料',
      'create': '新增資料',
      'update': '編輯資料',
      'delete': '刪除資料',
      'approve_discount': '核准折扣',
      'approve_credit_note': '核准折讓單',
      'approve_cancellation': '核准取消',
      'manage_staff': '管理員工',
      'manage_rules': '管理規則',
      'run_reports': '執行報表',
      'process_check_in': '處理取件',
      'process_check_out': '處理還件',
      'create_rental': '建立租借單',
      'create_payment': '收款'
    }
  };
}

/**
 * ==================== ACTIVITY LOGS ====================
 */

function logActivity(action, targetType, targetId, description) {
  const user = getCurrentUser();
  const logData = {
    log_id: 'AL-' + Date.now(),
    staff_id: user ? user.staff_id : 'system',
    staff_name: user ? user.name : '系統',
    action: action,
    target_type: targetType || '',
    target_id: targetId || '',
    description: description || '',
    ip_info: '',
    created_at: new Date()
  };

  try {
    appendSheetRow('Activity_Logs', logData);
  } catch (e) {
    Logger.log('logActivity error: ' + e.toString());
  }
  return logData;
}

function getActivityLogs(filters = {}) {
  requirePermission('manage_staff', '無權限檢視活動紀錄');
  const logs = getSheetDataFiltered('Activity_Logs', filters);
  // Sort by created_at descending
  logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return logs;
}

function getRecentActivityLogs(limit) {
  requirePermission('manage_staff', '無權限檢視活動紀錄');
  const count = limit || 50;
  const logs = getActivityLogs();
  return logs.slice(0, count);
}

/**
 * ==================== DASHBOARD STATISTICS ====================
 */

function getDashboardStats() {
  // Use CacheService to avoid loading 6 full sheets on every call
  const cache = CacheService.getScriptCache();
  const cached = cache.get('dashboardStats');
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

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

  const stats = {
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

  // Cache for 60 seconds to speed up repeated loads
  try { cache.put('dashboardStats', JSON.stringify(stats), 60); } catch (_) {}
  return stats;
}

/**
 * ==================== STORAGE LOCATIONS ====================
 */

function getStorageLocations(filters = {}) {
  return getSheetDataFiltered('Storage_Locations', filters).filter(l => !l.is_deleted);
}

function createStorageLocation(locationData) {
  requirePermission('create', '無權限建立儲存位置');
  locationData.location_id = generateNextId('Storage_Locations', 'location_id', 'LOC');
  locationData.created_at = new Date();
  locationData.is_deleted = false;

  return appendSheetRow('Storage_Locations', locationData);
}

/**
 * ==================== DISCOUNT RULES ====================
 */

function getDiscountRules(filters = {}) {
  return getSheetDataFiltered('Discount_Rules', filters).filter(r => !r.is_deleted);
}

function createDiscountRule(ruleData) {
  requirePermission('manage_rules', '無權限建立折扣規則');
  ruleData.rule_id = generateNextId('Discount_Rules', 'rule_id', 'DR');
  ruleData.created_at = new Date();
  ruleData.is_deleted = false;

  return appendSheetRow('Discount_Rules', ruleData);
}

/**
 * ==================== ACCESSORY BINDINGS ====================
 */

function getAccessoryBindings(filters = {}) {
  return getSheetDataFiltered('Accessory_Bindings', filters).filter(b => !b.is_deleted);
}

function createAccessoryBinding(bindingData) {
  requirePermission('create', '無權限建立配件綁定');
  bindingData.binding_id = generateNextId('Accessory_Bindings', 'binding_id', 'AB');
  bindingData.created_at = new Date();
  bindingData.is_deleted = false;

  return appendSheetRow('Accessory_Bindings', bindingData);
}

/**
 * ==================== DAMAGE RECORDS ====================
 */

function getDamageRecords(filters = {}) {
  return getSheetDataFiltered('Damage_Records', filters).filter(d => !d.is_deleted);
}

function createDamageRecord(recordData) {
  requirePermission('create', '無權限建立損壞紀錄');
  recordData.damage_id = generateNextId('Damage_Records', 'damage_id', 'DM');
  recordData.created_at = new Date();
  recordData.is_deleted = false;

  return appendSheetRow('Damage_Records', recordData);
}

/**
 * ==================== CREDIT NOTES ====================
 */

function getCreditNotes(filters = {}) {
  return getSheetDataFiltered('Credit_Notes', filters).filter(n => !n.is_deleted);
}

function createCreditNote(noteData) {
  requirePermission('approve_credit_note', '無權限建立折讓單');
  noteData.credit_note_id = generateYearBasedId('Credit_Notes', 'credit_note_id', 'CN');
  noteData.created_at = new Date();
  noteData.is_deleted = false;

  return appendSheetRow('Credit_Notes', noteData);
}

/**
 * ==================== VENUE FUNCTIONS ====================
 */

function getVenues(filters = {}) {
  return getSheetDataFiltered('Venues', filters).filter(v => !v.is_deleted);
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
  requirePermission('update', '無權限編輯場地');
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
  return getSheetDataFiltered('Venue_Bookings', filters).filter(b => !b.is_deleted);
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
  requirePermission('update', '無權限編輯場地預約');
  updates.updated_at = new Date();
  return updateSheetRow('Venue_Bookings', 'booking_id', bookingId, updates);
}

function deleteVenueBooking(bookingId) {
  requirePermission('delete', '無權限刪除場地預約');
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
  requirePermission('create', '無權限寄送郵件');
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
  requirePermission('create', '無權限寄送郵件');
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
  requirePermission('create', '無權限寄送郵件');
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
  requirePermission('create', '無權限寄送郵件');
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
