import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import * as db from './db.js'

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const str = (v, name, required = true) => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (required && !s) throw new HttpError(400, `${name} is required`)
  return s
}
const num = (v, name, { min = 0, integer = false } = {}) => {
  const n = Number(v)
  if (v === '' || v === null || v === undefined || !Number.isFinite(n) || n < min || (integer && !Number.isInteger(n)))
    throw new HttpError(400, `${name} must be ${integer ? 'a whole number' : 'a number'}${min > -Infinity ? ` >= ${min}` : ''}`)
  return n
}

// Locks the product row so concurrent sales/adjustments can't oversell.
async function lockProduct(c, id) {
  const { rows } = await c.query('SELECT id, name FROM products WHERE id = $1 FOR UPDATE', [id])
  if (!rows.length) throw new HttpError(404, 'Product not found')
  return rows[0]
}
const stockOf = async (c, id) =>
  Number((await c.query('SELECT COALESCE(SUM(qty),0) AS n FROM movements WHERE product_id = $1', [id])).rows[0].n)

function productFields(b) {
  return {
    sku: str(b.sku, 'SKU'),
    name: str(b.name, 'Name'),
    category: str(b.category, 'Category', false),
    cost: num(b.cost, 'Cost'),
    price: num(b.price, 'Price'),
    reorderLevel: num(b.reorderLevel, 'Reorder level', { integer: true }),
  }
}

// Wraps a mutation: runs it in a transaction, then responds with the full updated state.
const mutate = (fn) => async (req, res, next) => {
  try {
    await db.tx((c) => fn(c, req))
    res.json(await db.getState())
  } catch (e) {
    next(e.code === '23505' ? new HttpError(409, 'SKU already exists') : e)
  }
}

export const api = Router()

api.get('/state', async (req, res, next) => {
  try { res.json(await db.getState()) } catch (e) { next(e) }
})

api.post('/products', mutate(async (c, req) => {
  const p = productFields(req.body)
  await c.query('INSERT INTO products (id,sku,name,category,cost,price,reorder_level) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [randomUUID(), p.sku, p.name, p.category, p.cost, p.price, p.reorderLevel])
}))

api.put('/products/:id', mutate(async (c, req) => {
  await lockProduct(c, req.params.id)
  const p = productFields(req.body)
  await c.query('UPDATE products SET sku=$2,name=$3,category=$4,cost=$5,price=$6,reorder_level=$7 WHERE id=$1',
    [req.params.id, p.sku, p.name, p.category, p.cost, p.price, p.reorderLevel])
}))

api.delete('/products/:id', mutate(async (c, req) => {
  await lockProduct(c, req.params.id)
  await c.query('DELETE FROM products WHERE id = $1', [req.params.id]) // history cascades
}))

api.post('/purchases', mutate(async (c, req) => {
  const b = req.body
  const product = await lockProduct(c, b.productId)
  const qty = num(b.qty, 'Quantity', { min: 1, integer: true })
  const unitCost = num(b.unitCost, 'Unit cost')
  const supplier = str(b.supplier, 'Supplier', false)
  const id = randomUUID()
  await c.query('INSERT INTO purchases (id,product_id,qty,unit_cost,supplier) VALUES ($1,$2,$3,$4,$5)', [id, product.id, qty, unitCost, supplier])
  await c.query('INSERT INTO movements (id,product_id,type,qty,note,ref) VALUES ($1,$2,$3,$4,$5,$6)',
    [randomUUID(), product.id, 'purchase', qty, `Purchase from ${supplier || 'supplier'}`, id])
}))

api.post('/sales', mutate(async (c, req) => {
  const b = req.body
  const product = await lockProduct(c, b.productId)
  const qty = num(b.qty, 'Quantity', { min: 1, integer: true })
  const unitPrice = num(b.unitPrice, 'Unit price')
  const customer = str(b.customer, 'Customer', false)
  const available = await stockOf(c, product.id)
  if (qty > available) throw new HttpError(409, `Only ${available} of ${product.name} in stock`)
  const id = randomUUID()
  await c.query('INSERT INTO sales (id,product_id,qty,unit_price,customer) VALUES ($1,$2,$3,$4,$5)', [id, product.id, qty, unitPrice, customer])
  await c.query('INSERT INTO movements (id,product_id,type,qty,note,ref) VALUES ($1,$2,$3,$4,$5,$6)',
    [randomUUID(), product.id, 'sale', -qty, `Sale to ${customer || 'customer'}`, id])
}))

api.post('/adjustments', mutate(async (c, req) => {
  const b = req.body
  const product = await lockProduct(c, b.productId)
  const qty = num(b.qty, 'Quantity', { min: -Infinity, integer: true })
  if (qty === 0) throw new HttpError(400, 'Quantity cannot be 0')
  const available = await stockOf(c, product.id)
  if (available + qty < 0) throw new HttpError(409, `Adjustment would make stock negative (currently ${available})`)
  await c.query('INSERT INTO movements (id,product_id,type,qty,note) VALUES ($1,$2,$3,$4,$5)',
    [randomUUID(), product.id, 'adjustment', qty, str(b.note, 'Note', false) || 'Manual adjustment'])
}))

api.post('/reset', async (req, res, next) => {
  try {
    await db.reset()
    res.json(await db.getState())
  } catch (e) { next(e) }
})

api.use((req, res) => res.status(404).json({ error: 'Not found' }))

// eslint-disable-next-line no-unused-vars
api.use((err, req, res, next) => {
  const status = err.status || 500
  if (status === 500) console.error(err)
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message })
})
