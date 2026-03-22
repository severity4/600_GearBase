/**
 * PostgreSQL Database Connection & Query Helpers
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * Get all rows from a table (with soft-delete filter)
 */
async function getAll(table, { includeDeleted = false } = {}) {
  const where = includeDeleted ? '' : `WHERE is_deleted = false`;
  const { rows } = await pool.query(`SELECT * FROM "${table}" ${where}`);
  return rows;
}

/**
 * Get filtered rows from a table
 */
async function getFiltered(table, filters = {}, { includeDeleted = false } = {}) {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (!includeDeleted) {
    conditions.push('is_deleted = false');
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    conditions.push(`"${key}" = $${idx}`);
    values.push(value);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM "${table}" ${where}`, values);
  return rows;
}

/**
 * Insert a row and return it
 */
async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`);

  const { rows } = await pool.query(
    `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING *`,
    values
  );
  return rows[0];
}

/**
 * Update a row by ID column
 */
async function update(table, idColumn, idValue, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return null;

  const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`);
  const values = [...Object.values(updates), idValue];

  const { rows } = await pool.query(
    `UPDATE "${table}" SET ${setClauses.join(', ')}
     WHERE "${idColumn}" = $${keys.length + 1}
     RETURNING *`,
    values
  );
  return rows[0];
}

/**
 * Soft delete a row
 */
async function softDelete(table, idColumn, idValue) {
  return update(table, idColumn, idValue, { is_deleted: true });
}

/**
 * Run a raw query
 */
async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, getAll, getFiltered, insert, update, softDelete, query };
