// Contract checks for the REST API the UI depends on. Fast and precise.
import { test, expect, SEED, idOf } from './support/fixtures.js'
import { count, stockOf } from './support/db.js'

const good = { sku: 'API-1', name: 'API Item', category: 'x', cost: 1, price: 2, reorderLevel: 3 }

test.describe('API contract', () => {
  test('GET /api/state returns all four collections, with numbers as numbers', async ({ request }) => {
    const s = await (await request.get('/api/state')).json()
    expect(s.products).toHaveLength(SEED.products)
    expect(s.purchases).toHaveLength(SEED.purchases)
    expect(s.sales).toHaveLength(SEED.sales)
    expect(s.movements).toHaveLength(SEED.movements)
    const kb = s.products.find((p) => p.sku === 'KB-001')
    expect(kb).toMatchObject({ cost: 45, price: 89, reorderLevel: 10 })
    expect(typeof kb.cost).toBe('number') // Postgres numeric must not leak out as a string
  })

  test('product validation errors are 400 with an { error } body and write nothing', async ({ request }) => {
    const bad = [
      { ...good, sku: '' },
      { ...good, name: '   ' },
      { ...good, cost: -1 },
      { ...good, price: 'abc' },
      { ...good, reorderLevel: 1.5 },
      { ...good, reorderLevel: '' },
    ]
    for (const body of bad) {
      const res = await request.post('/api/products', { data: body })
      expect(res.status(), JSON.stringify(body)).toBe(400)
      expect(typeof (await res.json()).error).toBe('string')
    }
    expect(await count('products')).toBe(SEED.products)
  })

  test('duplicate SKU is a 409, also when only the case differs', async ({ request }) => {
    expect((await request.post('/api/products', { data: good })).status()).toBe(200)
    expect((await request.post('/api/products', { data: { ...good, sku: 'api-1' } })).status()).toBe(409)
    expect(await count('products')).toBe(SEED.products + 1)
  })

  test('editing a product to another product\'s SKU is a 409', async ({ request }) => {
    const id = await idOf(request, 'MS-002')
    const res = await request.put(`/api/products/${id}`, { data: { ...good, sku: 'KB-001' } })
    expect(res.status()).toBe(409)
  })

  test('unknown product and unknown route return 404 JSON', async ({ request }) => {
    for (const res of [
      await request.put('/api/products/nope', { data: good }),
      await request.delete('/api/products/nope'),
      await request.post('/api/sales', { data: { productId: 'nope', qty: 1, unitPrice: 1 } }),
      await request.post('/api/purchases', { data: { productId: 'nope', qty: 1, unitCost: 1 } }),
      await request.post('/api/adjustments', { data: { productId: 'nope', qty: 1 } }),
      await request.get('/api/does-not-exist'),
    ]) {
      expect(res.status()).toBe(404)
      expect(typeof (await res.json()).error).toBe('string')
    }
  })

  test('sale and adjustment input validation', async ({ request }) => {
    const id = await idOf(request, 'HS-005')
    for (const qty of [0, -1, 2.5, 'x']) {
      expect((await request.post('/api/sales', { data: { productId: id, qty, unitPrice: 1 } })).status(), `sale qty ${qty}`).toBe(400)
    }
    expect((await request.post('/api/sales', { data: { productId: id, qty: 1, unitPrice: -5 } })).status()).toBe(400)
    expect((await request.post('/api/adjustments', { data: { productId: id, qty: 0 } })).status()).toBe(400)
    expect((await request.post('/api/adjustments', { data: { productId: id, qty: 1.5 } })).status()).toBe(400)
    expect(await count('sales')).toBe(SEED.sales)
    expect(await count('movements')).toBe(SEED.movements)
  })

  test('two concurrent sales cannot oversell the same stock', async ({ request }) => {
    const id = await idOf(request, 'HS-005') // stock 16; two sales of 10 cannot both succeed
    const sale = () => request.post('/api/sales', { data: { productId: id, qty: 10, unitPrice: 139, customer: 'Race' } })
    const results = await Promise.all([sale(), sale()])
    const statuses = results.map((r) => r.status()).sort()
    expect(statuses).toEqual([200, 409])
    expect(await stockOf('HS-005')).toBe(6)
    expect(await count('sales')).toBe(SEED.sales + 1)
  })

  test('mutations return the complete updated state', async ({ request }) => {
    const id = await idOf(request, 'KB-001')
    const s = await (await request.post('/api/adjustments', { data: { productId: id, qty: 2, note: 'api' } })).json()
    expect(s.movements).toHaveLength(SEED.movements + 1)
    expect(s.products).toHaveLength(SEED.products)
  })
})
