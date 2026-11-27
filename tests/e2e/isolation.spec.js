// Canary: proves the server under test is wired to the TEST database (not the app's own).
// If this fails, stop and fix the wiring before trusting any other result.
import { test, expect } from './support/fixtures.js'
import { productBySku, count } from './support/db.js'

test('the app under test writes to the dedicated e2e database', async ({ request }) => {
  const res = await request.post('/api/products', {
    data: { sku: 'CANARY-1', name: 'Isolation canary', category: 'e2e', cost: 1, price: 2, reorderLevel: 1 },
  })
  expect(res.status()).toBe(200)

  // Read it back through the e2e-only connection string.
  const inTestDb = await productBySku('CANARY-1')
  expect(inTestDb?.name).toBe('Isolation canary')
  expect(await count('products')).toBe(6)
})
