/**
 * 資料遷移腳本：Google Sheets → PostgreSQL
 *
 * 使用方式：
 * 1. 從 Google Sheets 匯出各工作表為 CSV，放到 server/data/ 資料夾
 * 2. 執行 npm run migrate:from-sheets
 *
 * 或者用 Google Apps Script 匯出 JSON：
 * 1. 在 GAS 中執行 exportAllSheetsAsJson()
 * 2. 將 JSON 檔案放到 server/data/ 資料夾
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const DATA_DIR = path.join(__dirname, '..', 'data');

// Sheet name → Prisma model mapping
const SHEET_MODEL_MAP: Record<string, string> = {
  'Storage_Locations': 'storageLocation',
  'Equipment_Types': 'equipmentType',
  'Equipment_Units': 'equipmentUnit',
  'Accessory_Bindings': 'accessoryBinding',
  'Maintenance_Logs': 'maintenanceLog',
  'Customers': 'customer',
  'Staff': 'staff',
  'Rentals': 'rental',
  'Rental_Items': 'rentalItem',
  'Service_Items': 'serviceItem',
  'Rental_Addendums': 'rentalAddendum',
  'Discount_Rules': 'discountRule',
  'Overdue_Rules': 'overdueRule',
  'Damage_Records': 'damageRecord',
  'Wear_Tolerance': 'wearTolerance',
  'Credit_Notes': 'creditNote',
  'Payments': 'payment',
  'Inventory_Logs': 'inventoryLog',
  'Print_Templates': 'printTemplate',
  'Stocktake_Plans': 'stocktakePlan',
  'Stocktake_Results': 'stocktakeResult',
  'Venues': 'venue',
  'Venue_Bookings': 'venueBooking',
  'Activity_Logs': 'activityLog',
  'Error_Logs': 'errorLog',
};

// Import order (respects foreign key dependencies)
const IMPORT_ORDER = [
  'Storage_Locations',
  'Equipment_Types',
  'Equipment_Units',
  'Accessory_Bindings',
  'Staff',
  'Customers',
  'Discount_Rules',
  'Overdue_Rules',
  'Wear_Tolerance',
  'Print_Templates',
  'Rentals',
  'Rental_Items',
  'Service_Items',
  'Rental_Addendums',
  'Maintenance_Logs',
  'Inventory_Logs',
  'Damage_Records',
  'Credit_Notes',
  'Payments',
  'Venues',
  'Venue_Bookings',
  'Stocktake_Plans',
  'Stocktake_Results',
  'Activity_Logs',
  'Error_Logs',
];

function parseCSV(content: string): Record<string, any>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, any> = {};
    headers.forEach((header, idx) => {
      let val: any = values[idx] ?? '';
      if (val === '' || val === 'NULL' || val === 'null') {
        val = null;
      } else if (val === 'TRUE' || val === 'true') {
        val = true;
      } else if (val === 'FALSE' || val === 'false') {
        val = false;
      } else if (/^\d+$/.test(val)) {
        val = parseInt(val, 10);
      } else if (/^\d+\.\d+$/.test(val)) {
        val = parseFloat(val);
      }
      row[header] = val;
    });
    rows.push(row);
  }
  return rows;
}

function parseJSON(content: string): Record<string, any>[] {
  return JSON.parse(content);
}

async function importSheet(sheetName: string) {
  const modelName = SHEET_MODEL_MAP[sheetName];
  if (!modelName) {
    console.log(`  ⚠ No model mapping for ${sheetName}, skipping`);
    return;
  }

  // Try JSON first, then CSV
  const jsonPath = path.join(DATA_DIR, `${sheetName}.json`);
  const csvPath = path.join(DATA_DIR, `${sheetName}.csv`);

  let rows: Record<string, any>[] = [];

  if (fs.existsSync(jsonPath)) {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    rows = parseJSON(content);
    console.log(`  📄 Found ${sheetName}.json (${rows.length} rows)`);
  } else if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, 'utf-8');
    rows = parseCSV(content);
    console.log(`  📄 Found ${sheetName}.csv (${rows.length} rows)`);
  } else {
    console.log(`  ⏭ No data file for ${sheetName}, skipping`);
    return;
  }

  if (rows.length === 0) {
    console.log(`  ⏭ Empty data for ${sheetName}`);
    return;
  }

  // Batch insert
  const model = (prisma as any)[modelName];
  let imported = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      await model.create({ data: row });
      imported++;
    } catch (err: any) {
      errors++;
      if (errors <= 3) {
        console.log(`    ✗ Error row: ${JSON.stringify(row).slice(0, 100)}...`);
        console.log(`      ${err.message.slice(0, 200)}`);
      }
    }
  }

  console.log(`  ✓ ${sheetName}: ${imported} imported, ${errors} errors`);
}

async function main() {
  console.log('==========================================');
  console.log('GearBase 資料遷移: Google Sheets → PostgreSQL');
  console.log('==========================================\n');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`📁 Created data directory: ${DATA_DIR}`);
    console.log('   請將 Google Sheets 匯出的 CSV 或 JSON 檔案放入此資料夾\n');
    console.log('   檔案命名規則：{工作表名稱}.csv 或 {工作表名稱}.json');
    console.log('   例如：Equipment_Types.csv, Customers.json\n');
    return;
  }

  console.log(`📁 Data directory: ${DATA_DIR}\n`);

  for (const sheetName of IMPORT_ORDER) {
    console.log(`\n🔄 Processing: ${sheetName}`);
    await importSheet(sheetName);
  }

  console.log('\n==========================================');
  console.log('遷移完成！');
  console.log('==========================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
