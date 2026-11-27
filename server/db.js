// Postgres storage (Neon or any Postgres). Reads DATABASE_URL from the environment / .env.
import fs from 'node:fs'
import pg from 'pg'
import { seed } from './seed.js'

if (fs.existsSync('.env')) process.loadEnvFile('.env')
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
  process.exit(1)
}

pg.types.setTypeParser(1700, parseFloat) // numeric -> number
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 })

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  seq bigserial,
  sku text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  cost numeric(12,2) NOT NULL CHECK (cost >= 0),
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  reorder_level integer NOT NULL CHECK (reorder_level >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON products (lower(sku));
CREATE TABLE IF NOT EXISTS purchases (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty integer NOT NULL CHECK (qty > 0),
  unit_cost numeric(12,2) NOT NULL CHECK (unit_cost >= 0),
  supplier text NOT NULL DEFAULT '',
  date timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sales (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty integer NOT NULL CHECK (qty > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  customer text NOT NULL DEFAULT '',
  date timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS movements (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('purchase','sale','adjustment')),
  qty integer NOT NULL,
  note text NOT NULL DEFAULT '',
  date timestamptz NOT NULL DEFAULT now(),
  ref text
);
CREATE INDEX IF NOT EXISTS movements_product_idx ON movements (product_id);
`

async function insertSeed(c) {
  for (const p of seed.products)
    await c.query('INSERT INTO products (id,sku,name,category,cost,price,reorder_level) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [p.id, p.sku, p.name, p.category, p.cost, p.price, p.reorderLevel])
  for (const p of seed.purchases)
    await c.query('INSERT INTO purchases (id,product_id,qty,unit_cost,supplier,date) VALUES ($1,$2,$3,$4,$5,$6)',
      [p.id, p.productId, p.qty, p.unitCost, p.supplier, p.date])
  for (const s of seed.sales)
    await c.query('INSERT INTO sales (id,product_id,qty,unit_price,customer,date) VALUES ($1,$2,$3,$4,$5,$6)',
      [s.id, s.productId, s.qty, s.unitPrice, s.customer, s.date])
  for (const m of seed.movements)
    await c.query('INSERT INTO movements (id,product_id,type,qty,note,date,ref) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [m.id, m.productId, m.type, m.qty, m.note, m.date, m.ref ?? null])
}

/** Run fn(client) inside a transaction. */
export async function tx(fn) {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const out = await fn(c)
    await c.query('COMMIT')
    return out
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    c.release()
  }
}

/** Create tables, and load the sample data if the database is brand new. */
export async function init() {
  await tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(42)') // safe if several instances boot at once
    await c.query(SCHEMA)
    const { rows } = await c.query('SELECT 1 FROM products LIMIT 1')
    if (!rows.length) await insertSeed(c)
  })
}

/** Whole dataset in the shape the frontend expects. */
export async function getState(c = pool) {
  const [products, purchases, sales, movements] = await Promise.all([
    c.query('SELECT id, sku, name, category, cost, price, reorder_level AS "reorderLevel" FROM products ORDER BY seq'),
    c.query('SELECT id, product_id AS "productId", qty, unit_cost AS "unitCost", supplier, date FROM purchases ORDER BY date DESC'),
    c.query('SELECT id, product_id AS "productId", qty, unit_price AS "unitPrice", customer, date FROM sales ORDER BY date DESC'),
    c.query('SELECT id, product_id AS "productId", type, qty, note, date, ref FROM movements ORDER BY date DESC'),
  ])
  return { products: products.rows, purchases: purchases.rows, sales: sales.rows, movements: movements.rows }
}

export async function reset() {
  await tx(async (c) => {
    await c.query('TRUNCATE movements, sales, purchases, products')
    await insertSeed(c)
  })
}
