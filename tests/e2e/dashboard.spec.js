import { test, expect, SEED, gotoTab, idOf } from './support/fixtures.js'

const card = (page, label) => page.locator('.card').filter({ hasText: label })

test.describe('Dashboard', () => {
  test('shows KPIs computed from the seed data', async ({ page }) => {
    await page.goto('/')
    await expect(card(page, 'Products').locator('.value')).toHaveText(String(SEED.products))
    await expect(card(page, 'Stock value').locator('.value')).toHaveText(SEED.stockValue)
    await expect(card(page, 'Total sales').locator('.value')).toHaveText(SEED.totalSales)
    await expect(card(page, 'Total purchases').locator('.value')).toHaveText(SEED.totalPurchases)
    await expect(card(page, 'Low-stock').locator('.value')).toHaveText(String(SEED.lowStock))
  })

  test('low-stock list contains items at/below reorder level only', async ({ page }) => {
    await page.goto('/')
    for (const sku of ['KB-001', 'MS-002', 'MN-003', 'CB-004']) {
      await expect(page.getByRole('cell', { name: sku, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('cell', { name: 'HS-005', exact: true })).toHaveCount(0)
  })

  test('restocking a low item removes it from the alerts and raises stock value', async ({ page, request }) => {
    const id = await idOf(request, 'CB-004') // stock 25, reorder 30, cost $2
    const res = await request.post('/api/purchases', { data: { productId: id, qty: 10, unitCost: 2, supplier: 'E2E' } })
    expect(res.ok()).toBeTruthy()

    await page.goto('/')
    await expect(page.getByRole('cell', { name: 'CB-004', exact: true })).toHaveCount(0)
    await expect(card(page, 'Low-stock').locator('.value')).toHaveText(String(SEED.lowStock - 1))
    await expect(card(page, 'Stock value').locator('.value')).toHaveText('$2,334.00') // 2314 + 10*$2
  })

  test('shows the all-clear message when nothing is low', async ({ page, request }) => {
    for (const [sku, qty] of [['KB-001', 50], ['MS-002', 50], ['MN-003', 50], ['CB-004', 50]]) {
      const id = await idOf(request, sku)
      expect((await request.post('/api/purchases', { data: { productId: id, qty, unitCost: 1 } })).ok()).toBeTruthy()
    }
    await gotoTab(page, 'Dashboard')
    await expect(page.getByText('Everything is well stocked.')).toBeVisible()
  })
})
