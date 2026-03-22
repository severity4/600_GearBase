/**
 * ID Generation Service - Replaces GAS generateNextId / generateYearBasedId
 */
const { query } = require('../db');

const CATEGORY_CODES = {
  camera: 'CAM', lens: 'LEN', audio: 'AUD', lighting: 'LGT',
  monitor: 'MON', transmission: 'TRX', tripod: 'TRI', motion: 'MOT',
  teleprompter: 'TLP', accessory: 'ACC',
  prop_furniture: 'PROP-F', prop_wardrobe: 'PROP-W', prop_set: 'PROP-S',
  prop_fx: 'PROP-X', prop_vehicle: 'PROP-V', prop_other: 'PROP-O',
};

/**
 * Generic next ID: PREFIX-NNN
 */
async function generateNextId(table, idField, prefix, padLength = 3) {
  const { rows } = await query(
    `SELECT "${idField}" FROM "${table}" WHERE "${idField}" LIKE $1 ORDER BY "${idField}" DESC LIMIT 1`,
    [`${prefix}-%`]
  );

  let nextNum = 1;
  if (rows.length > 0) {
    const match = String(rows[0][idField]).match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  return prefix + '-' + String(nextNum).padStart(padLength, '0');
}

/**
 * Year-based ID: PREFIX-YYYY-NNN
 */
async function generateYearBasedId(table, idField, prefix, padLength = 3) {
  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}-`;

  const { rows } = await query(
    `SELECT "${idField}" FROM "${table}" WHERE "${idField}" LIKE $1 ORDER BY "${idField}" DESC LIMIT 1`,
    [`${yearPrefix}%`]
  );

  let nextNum = 1;
  if (rows.length > 0) {
    const match = String(rows[0][idField]).match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  return yearPrefix + String(nextNum).padStart(padLength, '0');
}

/**
 * Generate equipment internal code: CAT-YYYY-NNN
 */
async function generateInternalCode(categoryKey) {
  const prefix = CATEGORY_CODES[categoryKey] || 'GEN';
  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}-`;

  const { rows } = await query(
    `SELECT internal_code FROM "Equipment_Units" WHERE internal_code LIKE $1 ORDER BY internal_code DESC LIMIT 1`,
    [`${yearPrefix}%`]
  );

  let nextNum = 1;
  if (rows.length > 0) {
    const match = String(rows[0].internal_code).match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  return yearPrefix + String(nextNum).padStart(3, '0');
}

async function generateRentalId() {
  return generateYearBasedId('Rentals', 'rental_id', 'RENT');
}

module.exports = {
  CATEGORY_CODES,
  generateNextId,
  generateYearBasedId,
  generateInternalCode,
  generateRentalId,
};
