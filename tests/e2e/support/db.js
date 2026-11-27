// Direct read access to the TEST database only. This module never reads the app's DATABASE_URL.
// Data is reset through the app itself (POST /api/reset, see fixtures.js) so the seed stays in one place.
import pg from 'pg'
import { loadE2eEnv } from './env.js'

let pool
function getPool() {
  if (!pool) {
    const { databaseUrl } = loadE2eEnv()
    pool = new pg.Pool({ connectionString: databaseUrl, max: 2 })
  }
  return pool
}

export const query = (text, params) => getPool().query(text, params)

export async function count(table) {
  // table names come from test code only, never from input
  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM ${table}`)
  return rows[0].n
}

export async function productBySku(sku) {
  const { rows } = await query(
    `SELECT id, sku, name, category, cost::float8 AS cost, price::float8 AS price, reorder_level AS "reorderLevel"
       FROM products WHERE lower(sku) = lower($1)`,
    [sku]
  )
  return rows[0]
}

// Stock = sum of movements, the app's source of truth.
export async function stockOf(sku) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(m.qty), 0)::int AS n
       FROM products p LEFT JOIN movements m ON m.product_id = p.id
      WHERE lower(p.sku) = lower($1)`,
    [sku]
  )
  return rows[0].n
}

export async function movementsFor(sku) {
  const { rows } = await query(
    `SELECT m.type, m.qty, m.note FROM movements m JOIN products p ON p.id = m.product_id
      WHERE lower(p.sku) = lower($1) ORDER BY m.date, m.id`,
    [sku]
  )
  return rows
}

export async function closeDb() {
  if (pool) await pool.end()
  pool = undefined
}
