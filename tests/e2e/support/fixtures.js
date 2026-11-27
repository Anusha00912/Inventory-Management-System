import { test as base, expect } from '@playwright/test'
import { closeDb } from './db.js'

// Independent oracle for the seed data (server/seed.js). If the seed changes on purpose,
// update these numbers: they are what the app is expected to show, not computed from the app.
export const SEED = {
  products: 5,
  purchases: 5,
  sales: 5,
  movements: 10,
  stockValue: '$2,314.00',
  totalSales: '$7,463.00',
  totalPurchases: '$6,040.00',
  lowStock: 4, // KB-001, MS-002, MN-003, CB-004 (HS-005 is above its reorder level)
  stock: { 'KB-001': 8, 'MS-002': 12, 'MN-003': 4, 'CB-004': 25, 'HS-005': 16 },
}

const TABS = ['Dashboard', 'Products', 'Purchases', 'Sales', 'Movements']

export async function openTab(page, name) {
  if (!TABS.includes(name)) throw new Error(`unknown tab ${name}`)
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
}

export async function gotoTab(page, name) {
  await page.goto('/')
  await openTab(page, name)
}

export const row = (page, text) => page.getByRole('row').filter({ hasText: text })

// Product id by SKU via the public API.
export async function idOf(request, sku) {
  const state = await (await request.get('/api/state')).json()
  const p = state.products.find((x) => x.sku === sku)
  if (!p) throw new Error(`No product with SKU ${sku}`)
  return p.id
}

export const test = base.extend({
  // Closes the test-DB pool when the worker exits.
  dbPool: [
    async ({}, use) => {
      await use()
      await closeDb()
    },
    { scope: 'worker', auto: true },
  ],
  // Every test starts from the known seed data.
  cleanDb: [
    async ({ request }, use) => {
      const res = await request.post('/api/reset')
      expect(res.ok(), `reset failed: ${res.status()}`).toBeTruthy()
      await use()
    },
    { auto: true },
  ],
})

export { expect }
