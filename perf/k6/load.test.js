// k6 load test: a realistic user journey through all ten inventory workflows.
// Each VU creates and deletes its own product, so VUs never contend for the same rows and the
// database returns to its baseline after every iteration (repeatable runs).
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'
import { PROFILE, scenarios, buildThresholds } from './config.js'

const BASE = __ENV.BASE_URL || 'http://localhost:3200'
const RESULT_DIR = __ENV.RESULT_DIR || 'perf/results/latest'

const statePayload = new Trend('state_payload_bytes') // size of the full-state response

export const options = {
  scenarios,
  thresholds: buildThresholds(PROFILE),
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  tags: { suite: 'inventory-load' },
}

function call(method, path, workflow, name, body) {
  return http.request(method, `${BASE}${path}`, body === undefined ? null : JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    // `name` keeps the URL-with-id from creating one metric series per product.
    tags: { workflow, name: `${method} ${name}` },
  })
}

const json = (res) => {
  try {
    return res.json()
  } catch (e) {
    return null
  }
}

const readState = (workflow) => {
  const res = call('GET', '/api/state', workflow, '/api/state')
  statePayload.add(res.body ? res.body.length : 0)
  return { res, state: json(res) }
}

const stockOf = (state, productId) =>
  state.movements.filter((m) => m.productId === productId).reduce((n, m) => n + m.qty, 0)

const think = () => sleep(PROFILE.thinkSec)

export default function () {
  const sku = `K6-${__VU}-${__ITER}-${Math.random().toString(36).slice(2, 7)}`

  // 1. Load Dashboard: the page shell plus the data its KPI cards are computed from.
  let res = call('GET', '/', 'dashboard', '/')
  check(res, { 'dashboard page 200': (r) => r.status === 200 })
  let { res: stateRes, state } = readState('dashboard')
  check(stateRes, { 'dashboard state 200': (r) => r.status === 200 && !!state && Array.isArray(state.products) })
  think()

  // 2. Product listing (the Products tab renders the same state).
  ;({ res: stateRes, state } = readState('product_listing'))
  check(stateRes, { 'listing 200 with products': (r) => r.status === 200 && !!state && state.products.length >= 5 })
  think()

  // 3. Search products. Search is a client-side filter over the same payload, so the server cost is the
  //    state fetch; the filter is applied here to mimic the browser.
  ;({ res: stateRes, state } = readState('search_products'))
  const hits = state ? state.products.filter((p) => (p.name + p.sku + p.category).toLowerCase().includes('mouse')) : []
  check(stateRes, { 'search 200 and finds seed product': (r) => r.status === 200 && hits.length >= 1 })
  think()

  // 4. Add product.
  res = call('POST', '/api/products', 'add_product', '/api/products', {
    sku, name: `Load Test Item ${sku}`, category: 'k6', cost: 10, price: 25, reorderLevel: 5,
  })
  state = json(res)
  const product = state && state.products ? state.products.find((p) => p.sku === sku) : null
  check(res, { 'add product 200 and returned': (r) => r.status === 200 && !!product })
  think()
  if (!product) return // nothing else in this journey can run without it

  // 5. Edit product.
  res = call('PUT', `/api/products/${product.id}`, 'edit_product', '/api/products/:id', {
    sku, name: `Load Test Item ${sku} (edited)`, category: 'k6', cost: 10, price: 30, reorderLevel: 5,
  })
  state = json(res)
  const edited = state && state.products ? state.products.find((p) => p.id === product.id) : null
  check(res, { 'edit product 200 and applied': (r) => r.status === 200 && !!edited && edited.price === 30 })
  think()

  // 6. Stock in (purchase 50).
  res = call('POST', '/api/purchases', 'stock_in', '/api/purchases', {
    productId: product.id, qty: 50, unitCost: 10, supplier: 'k6 supplier',
  })
  state = json(res)
  check(res, { 'stock in 200, stock is 50': (r) => r.status === 200 && !!state && stockOf(state, product.id) === 50 })
  think()

  // 7. Stock out (sale of 5).
  res = call('POST', '/api/sales', 'stock_out', '/api/sales', {
    productId: product.id, qty: 5, unitPrice: 30, customer: 'k6 customer',
  })
  state = json(res)
  check(res, { 'stock out 200, stock is 45': (r) => r.status === 200 && !!state && stockOf(state, product.id) === 45 })
  think()

  // 8. View transaction history (the Movements ledger).
  ;({ res: stateRes, state } = readState('transaction_history'))
  const mine = state ? state.movements.filter((m) => m.productId === product.id) : []
  check(stateRes, { 'history 200 with my 2 movements': (r) => r.status === 200 && mine.length === 2 })
  think()

  // 9. Generate reports. There is no report endpoint: the dashboard KPIs are the app's report, computed
  //    in the browser from the full state. Recompute them here and check they are consistent.
  ;({ res: stateRes, state } = readState('reports'))
  let ok = false
  if (state) {
    const stockValue = state.products.reduce((n, p) => n + stockOf(state, p.id) * p.cost, 0)
    const sales = state.sales.reduce((n, s) => n + s.qty * s.unitPrice, 0)
    const purchases = state.purchases.reduce((n, p) => n + p.qty * p.unitCost, 0)
    ok = Number.isFinite(stockValue) && sales > 0 && purchases > 0
  }
  check(stateRes, { 'report KPIs computable': (r) => r.status === 200 && ok })
  think()

  // 10. Delete product (also removes its history, returning the DB to baseline).
  res = call('DELETE', `/api/products/${product.id}`, 'delete_product', '/api/products/:id')
  state = json(res)
  check(res, { 'delete 200, product gone': (r) => r.status === 200 && !!state && !state.products.some((p) => p.id === product.id) })
  think()
}

// Removes anything a VU interrupted mid-journey left behind.
export function teardown() {
  const state = json(http.get(`${BASE}/api/state`, { tags: { workflow: 'teardown', name: 'GET /api/state' } }))
  if (!state) return
  for (const p of state.products.filter((x) => x.sku.startsWith('K6-'))) {
    http.del(`${BASE}/api/products/${p.id}`, null, { tags: { workflow: 'teardown', name: 'DELETE /api/products/:id' } })
  }
}

export function handleSummary(data) {
  return { [`${RESULT_DIR}/summary.json`]: JSON.stringify(data, null, 2) }
}
