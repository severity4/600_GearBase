/**
 * Database Migration - Create all 25 tables for GearBase
 * Run with: node server/migrate.js
 */
const { pool } = require('./db');

const migration = `
-- ==================== Equipment ====================

CREATE TABLE IF NOT EXISTS "Equipment_Types" (
  type_id TEXT PRIMARY KEY,
  name TEXT,
  category TEXT,
  sub_category TEXT,
  model TEXT,
  brand TEXT,
  daily_rate NUMERIC(10,2) DEFAULT 0,
  replacement_value NUMERIC(10,2) DEFAULT 0,
  deposit_required NUMERIC(10,2) DEFAULT 0,
  is_consumable BOOLEAN DEFAULT false,
  is_batch_item BOOLEAN DEFAULT false,
  batch_unit TEXT,
  description TEXT,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  type_name TEXT,
  is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Equipment_Units" (
  unit_id TEXT PRIMARY KEY,
  type_id TEXT REFERENCES "Equipment_Types"(type_id),
  serial_number TEXT,
  internal_code TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC(10,2),
  current_condition TEXT DEFAULT 'good',
  location_id TEXT,
  batch_quantity INTEGER,
  status TEXT DEFAULT 'available',
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  category TEXT,
  is_deleted BOOLEAN DEFAULT false
);

-- ==================== Customers ====================

CREATE TABLE IF NOT EXISTS "Customers" (
  customer_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  id_number TEXT,
  company_name TEXT,
  id_doc_url TEXT,
  id_doc_verified BOOLEAN DEFAULT false,
  id_doc_verified_by TEXT,
  id_doc_verified_at TIMESTAMPTZ,
  id_doc_return_status TEXT DEFAULT 'na',
  id_doc_return_date DATE,
  blacklisted BOOLEAN DEFAULT false,
  blacklist_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  credit_balance NUMERIC(10,2) DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false
);

-- ==================== Staff ====================

CREATE TABLE IF NOT EXISTS "Staff" (
  staff_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'viewer',
  can_approve_discount BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  password_hash TEXT,
  is_deleted BOOLEAN DEFAULT false
);

-- ==================== Rentals ====================

CREATE TABLE IF NOT EXISTS "Rentals" (
  rental_id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES "Customers"(customer_id),
  rental_start DATE,
  rental_end DATE,
  actual_pickup_date TIMESTAMPTZ,
  actual_return_date TIMESTAMPTZ,
  total_days INTEGER,
  subtotal NUMERIC(10,2) DEFAULT 0,
  discount_total NUMERIC(10,2) DEFAULT 0,
  overdue_fee NUMERIC(10,2) DEFAULT 0,
  tax_rate NUMERIC(5,4) DEFAULT 0.05,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0,
  deposit_amount NUMERIC(10,2) DEFAULT 0,
  deposit_status TEXT DEFAULT 'pending',
  deposit_received_by TEXT,
  delivery_required BOOLEAN DEFAULT false,
  delivery_address TEXT,
  delivery_contact TEXT,
  delivery_contact_phone TEXT,
  delivery_notes TEXT,
  use_purpose TEXT,
  use_risk_category TEXT,
  risk_acknowledged BOOLEAN DEFAULT false,
  risk_surcharge NUMERIC(10,2) DEFAULT 0,
  risk_doc_url TEXT,
  contract_url TEXT,
  contract_signed BOOLEAN DEFAULT false,
  invoice_required BOOLEAN DEFAULT false,
  tax_id_number TEXT,
  invoice_title TEXT,
  invoice_number TEXT,
  invoice_status TEXT,
  invoice_url TEXT,
  rental_detail_pdf_url TEXT,
  prepared_by TEXT,
  handled_by TEXT,
  approved_by TEXT,
  status TEXT DEFAULT 'draft',
  cancellation_date TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancellation_fee NUMERIC(10,2) DEFAULT 0,
  cancellation_refund_amount NUMERIC(10,2) DEFAULT 0,
  cancellation_approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_amount NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Rental_Items" (
  item_id TEXT PRIMARY KEY,
  rental_id TEXT REFERENCES "Rentals"(rental_id),
  type_id TEXT,
  unit_id TEXT,
  quantity INTEGER DEFAULT 1,
  daily_rate_snapshot NUMERIC(10,2),
  replacement_value_snapshot NUMERIC(10,2),
  days INTEGER,
  line_total NUMERIC(10,2) DEFAULT 0,
  discount_rule_id TEXT,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  line_total_after_discount NUMERIC(10,2) DEFAULT 0,
  condition_out TEXT,
  condition_out_photo_url TEXT,
  condition_in TEXT,
  condition_in_photo_url TEXT,
  checked_out_by TEXT,
  checked_in_by TEXT,
  return_status TEXT DEFAULT 'with_customer',
  returned_quantity INTEGER,
  return_date TIMESTAMPTZ,
  notes TEXT,
  is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Service_Items" (
  service_item_id TEXT PRIMARY KEY,
  rental_id TEXT,
  service_type TEXT,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  unit TEXT,
  unit_price NUMERIC(10,2) DEFAULT 0,
  line_total NUMERIC(10,2) DEFAULT 0,
  performed_by TEXT,
  service_date DATE,
  service_address TEXT,
  notes TEXT,
  booking_id TEXT,
  is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Rental_Addendums" (
  addendum_id TEXT PRIMARY KEY,
  rental_id TEXT REFERENCES "Rentals"(rental_id),
  addendum_type TEXT,
  description TEXT,
  original_end_date DATE,
  new_end_date DATE,
  additional_amount NUMERIC(10,2) DEFAULT 0,
  addendum_contract_url TEXT,
  signed BOOLEAN DEFAULT false,
  created_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  amount_change NUMERIC(10,2) DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false
);

-- ==================== Payments ====================

CREATE TABLE IF NOT EXISTS "Payments" (
  payment_id TEXT PRIMARY KEY,
  rental_id TEXT,
  payment_type TEXT,
  amount NUMERIC(10,2),
  credit_note_id TEXT,
  payment_method TEXT,
  payer_account_last5 TEXT,
  receive_channel TEXT,
  received_by TEXT,
  relay_status TEXT,
  relay_date DATE,
  relay_proof_url TEXT,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  receipt_url TEXT,
  receipt_pdf_url TEXT,
  notes TEXT,
  booking_id TEXT,
  is_deleted BOOLEAN DEFAULT false
);

-- ==================== Maintenance & Inventory ====================

CREATE TABLE IF NOT EXISTS "Maintenance_Logs" (
  log_id TEXT PRIMARY KEY,
  unit_id TEXT,
  maintenance_type TEXT,
  description TEXT,
  performed_by TEXT,
  vendor TEXT,
  cost NUMERIC(10,2),
  start_date DATE,
  end_date DATE,
  next_scheduled DATE,
  before_photo_url TEXT,
  after_photo_url TEXT,
  status TEXT,
  notes TEXT,
  scheduled_date DATE,
  completed_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Storage_Locations" (
  location_id TEXT PRIMARY KEY,
  name TEXT,
  location_type TEXT,
  parent_location_id TEXT,
  floor_number TEXT,
  address TEXT,
  capacity_note TEXT,
  responsible_staff TEXT,
  active BOOLEAN DEFAULT true,
  notes TEXT,
  location_name TEXT,
  parent_id TEXT,
  capacity TEXT,
  is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Inventory_Logs" (
  log_id TEXT PRIMARY KEY,
  unit_id TEXT,
  rental_id TEXT,
  log_type TEXT,
  log_date TIMESTAMPTZ,
  performed_by TEXT,
  from_location_id TEXT,
  to_location_id TEXT,
  condition_before TEXT,
  condition_after TEXT,
  checklist_completed BOOLEAN DEFAULT false,
  checklist_details TEXT,
  accessories_complete BOOLEAN DEFAULT true,
  missing_accessories TEXT,
  needs_maintenance BOOLEAN DEFAULT false,
  needs_cleaning BOOLEAN DEFAULT false,
  damage_found BOOLEAN DEFAULT false,
  damage_id TEXT,
  photo_urls TEXT,
  inspection_certificate_url TEXT,
  inspection_deadline TIMESTAMPTZ,
  inspection_completed_at TIMESTAMPTZ,
  inspection_overdue BOOLEAN DEFAULT false,
  checklist_pdf_url TEXT,
  notes TEXT,
  change_type TEXT,
  quantity_change INTEGER,
  from_location TEXT,
  to_location TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false
);

-- ==================== Business Rules ====================

CREATE TABLE IF NOT EXISTS "Discount_Rules" (
  rule_id TEXT PRIMARY KEY,
  rule_name TEXT,
  applies_to TEXT,
  target_id TEXT,
  min_days INTEGER,
  max_days INTEGER,
  discount_type TEXT,
  discount_value NUMERIC(10,2),
  requires_approval BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  min_amount NUMERIC(10,2),
  applicable_types TEXT,
  applicable_categories TEXT,
  is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Accessory_Bindings" (
  binding_id TEXT PRIMARY KEY,
  parent_type_id TEXT,
  accessory_type_id TEXT,
  quantity INTEGER DEFAULT 1,
  is_mandatory BOOLEAN DEFAULT false,
  notes TEXT,
  binding_type TEXT,
  is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Overdue_Rules" (
  overdue_rule_id TEXT PRIMARY KEY,
  applies_to TEXT,
  target_category TEXT,
  multiplier NUMERIC(5,2) DEFAULT 1.5,
  grace_period_hours INTEGER DEFAULT 0,
  max_penalty_rate NUMERIC(5,2),
  forced_purchase_days INTEGER,
  forced_purchase_note TEXT,
  active BOOLEAN DEFAULT true,
  rule_name TEXT,
  grace_period_days INTEGER,
  daily_penalty_rate NUMERIC(5,2),
  max_penalty_percent NUMERIC(5,2),
  is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Wear_Tolerance" (
  tolerance_id TEXT PRIMARY KEY,
  category TEXT,
  acceptable_wear TEXT,
  unacceptable_wear TEXT,
  assessment_checklist TEXT,
  notes TEXT,
  condition_field TEXT,
  acceptable_threshold TEXT,
  is_deleted BOOLEAN DEFAULT false
);

-- ==================== Damage & Credits ====================

CREATE TABLE IF NOT EXISTS "Damage_Records" (
  damage_id TEXT PRIMARY KEY,
  rental_id TEXT,
  unit_id TEXT,
  damage_description TEXT,
  damage_severity TEXT,
  within_tolerance BOOLEAN DEFAULT false,
  repair_cost NUMERIC(10,2),
  compensation_amount NUMERIC(10,2),
  photo_url TEXT,
  assessed_by TEXT,
  status TEXT DEFAULT 'pending',
  resolution_notes TEXT,
  damage_report_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  damage_type TEXT,
  description TEXT,
  severity TEXT,
  replacement_cost NUMERIC(10,2),
  reported_by TEXT,
  reported_at TIMESTAMPTZ,
  notes TEXT,
  is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Credit_Notes" (
  credit_note_id TEXT PRIMARY KEY,
  rental_id TEXT,
  credit_type TEXT,
  related_item_id TEXT,
  related_damage_id TEXT,
  original_amount NUMERIC(10,2),
  credit_amount NUMERIC(10,2),
  reason TEXT,
  evidence_url TEXT,
  requested_by TEXT,
  approved_by TEXT,
  approval_status TEXT,
  rejection_reason TEXT,
  refund_method TEXT,
  refund_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  booking_id TEXT,
  customer_id TEXT,
  amount NUMERIC(10,2),
  status TEXT,
  is_deleted BOOLEAN DEFAULT false
);

-- ==================== Print Templates ====================

CREATE TABLE IF NOT EXISTS "Print_Templates" (
  template_id TEXT PRIMARY KEY,
  template_name TEXT,
  template_type TEXT,
  google_doc_template_id TEXT,
  output_folder_id TEXT,
  paper_size TEXT,
  orientation TEXT,
  include_company_header BOOLEAN DEFAULT true,
  include_signature_line BOOLEAN DEFAULT true,
  include_photos BOOLEAN DEFAULT false,
  version TEXT,
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  doc_template_id TEXT,
  is_deleted BOOLEAN DEFAULT false
);

-- ==================== Stocktake ====================

CREATE TABLE IF NOT EXISTS "Stocktake_Plans" (
  plan_id TEXT PRIMARY KEY,
  plan_name TEXT,
  stocktake_type TEXT,
  scope_type TEXT,
  scope_categories TEXT,
  scope_location_id TEXT,
  scheduled_date DATE,
  deadline DATE,
  assigned_to TEXT,
  supervised_by TEXT,
  status TEXT DEFAULT 'draft',
  total_expected INTEGER,
  total_counted INTEGER,
  total_matched INTEGER,
  total_discrepancy INTEGER,
  completion_rate NUMERIC(5,2),
  summary_notes TEXT,
  report_pdf_url TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  plan_type TEXT,
  is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Stocktake_Results" (
  result_id TEXT PRIMARY KEY,
  plan_id TEXT REFERENCES "Stocktake_Plans"(plan_id),
  unit_id TEXT,
  expected_location_id TEXT,
  actual_location_id TEXT,
  location_match BOOLEAN,
  expected_status TEXT,
  actual_status TEXT,
  status_match BOOLEAN,
  expected_condition TEXT,
  actual_condition TEXT,
  condition_match BOOLEAN,
  expected_quantity INTEGER,
  actual_quantity INTEGER,
  quantity_match BOOLEAN,
  result TEXT,
  photo_url TEXT,
  resolution_action TEXT,
  resolution_notes TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  counted_by TEXT,
  counted_at TIMESTAMPTZ,
  expected_location TEXT,
  actual_location TEXT,
  physical_count INTEGER,
  system_count INTEGER,
  condition_found TEXT,
  discrepancy_type TEXT,
  resolution TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false
);

-- ==================== Venues ====================

CREATE TABLE IF NOT EXISTS "Venues" (
  venue_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  venue_type TEXT,
  address TEXT,
  floor TEXT,
  floor_area_sqm NUMERIC(8,2),
  max_capacity INTEGER,
  hourly_rate NUMERIC(10,2) DEFAULT 0,
  half_day_rate NUMERIC(10,2),
  daily_rate NUMERIC(10,2),
  overtime_hourly_rate NUMERIC(10,2),
  deposit_required NUMERIC(10,2) DEFAULT 0,
  min_booking_hours INTEGER,
  available_start_time TEXT DEFAULT '09:00',
  available_end_time TEXT DEFAULT '22:00',
  amenities TEXT,
  power_specs TEXT,
  ceiling_height_m NUMERIC(5,2),
  has_cyclorama BOOLEAN DEFAULT false,
  cyclorama_color TEXT,
  has_blackout BOOLEAN DEFAULT false,
  has_loading_dock BOOLEAN DEFAULT false,
  parking_info TEXT,
  rules TEXT,
  description TEXT,
  image_urls TEXT,
  floor_plan_url TEXT,
  location_id TEXT,
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Venue_Bookings" (
  booking_id TEXT PRIMARY KEY,
  venue_id TEXT REFERENCES "Venues"(venue_id),
  customer_id TEXT REFERENCES "Customers"(customer_id),
  rental_id TEXT,
  booking_start TIMESTAMPTZ,
  booking_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  total_hours NUMERIC(6,2),
  overtime_hours NUMERIC(6,2),
  rate_type TEXT,
  unit_rate NUMERIC(10,2),
  rate_quantity NUMERIC(6,2),
  subtotal NUMERIC(10,2) DEFAULT 0,
  overtime_fee NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  tax_rate NUMERIC(5,4) DEFAULT 0.05,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0,
  deposit_amount NUMERIC(10,2) DEFAULT 0,
  deposit_status TEXT DEFAULT 'pending',
  attendee_count INTEGER,
  use_purpose TEXT,
  setup_required BOOLEAN DEFAULT false,
  setup_notes TEXT,
  cleanup_included BOOLEAN DEFAULT false,
  special_requirements TEXT,
  contract_url TEXT,
  contract_signed BOOLEAN DEFAULT false,
  invoice_required BOOLEAN DEFAULT false,
  invoice_status TEXT,
  invoice_number TEXT,
  prepared_by TEXT,
  handled_by TEXT,
  approved_by TEXT,
  status TEXT DEFAULT 'draft',
  cancellation_date TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancellation_fee NUMERIC(10,2) DEFAULT 0,
  post_use_condition TEXT,
  damage_description TEXT,
  damage_fee NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false
);

-- ==================== Activity & Error Logs ====================

CREATE TABLE IF NOT EXISTS "Activity_Logs" (
  log_id TEXT PRIMARY KEY,
  staff_id TEXT,
  staff_name TEXT,
  action TEXT,
  target_type TEXT,
  target_id TEXT,
  description TEXT,
  ip_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Error_Logs" (
  error_id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  function_name TEXT,
  error_message TEXT,
  stack_trace TEXT,
  user_email TEXT,
  severity TEXT DEFAULT 'error',
  context TEXT
);

-- ==================== Indexes ====================

CREATE INDEX IF NOT EXISTS idx_equipment_units_type ON "Equipment_Units"(type_id);
CREATE INDEX IF NOT EXISTS idx_equipment_units_status ON "Equipment_Units"(status);
CREATE INDEX IF NOT EXISTS idx_rentals_customer ON "Rentals"(customer_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON "Rentals"(status);
CREATE INDEX IF NOT EXISTS idx_rental_items_rental ON "Rental_Items"(rental_id);
CREATE INDEX IF NOT EXISTS idx_payments_rental ON "Payments"(rental_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON "Payments"(booking_id);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_venue ON "Venue_Bookings"(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_customer ON "Venue_Bookings"(customer_id);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_status ON "Venue_Bookings"(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON "Activity_Logs"(created_at DESC);
`;

async function migrate() {
  console.log('Running database migration...');
  await pool.query(migration);
  console.log('Migration completed successfully.');
}

if (require.main === module) {
  migrate().then(() => pool.end()).catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = { migrate };
