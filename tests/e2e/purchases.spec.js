import { test, expect, SEED, gotoTab, row, idOf } from './support/fixtures.js'
import { count, stockOf, movementsFor } from './support/db.js'

test.describe('Purchases', () => {
  test.beforeEach(async ({ page }) => {
    await gotoTab(page, 'Purchases')
  })

  test('selecting a product prefills its unit cost', async ({ page }) => {
    await page.getByRole('combobox').selectOption({ label: 'Mechanical Keyboard' })
    await expect(page.getByPlaceholder('Unit cost')).toHaveValue('45')
  })

  test('records a purchase: history row, increased stock, ledger entry, dashboard total', async ({ page }) => {
    await page.getByRole('combobox').selectOption({ label: 'Mechanical Keyboard' })
    await page.getByPlaceholder('Quantity').fill('10')
    await page.getByPlaceholder('Supplier').fill('KeyCo E2E')
    await page.getByRole('button', { name: 'Add purchase' }).click()

    const r = row(page, 'KeyCo E2E')
    await expect(r).toContainText('Mechanical Keyboard')
    await expect(r).toContainText('$450.00') // 10 x $45

    expect(await stockOf('KB-001')).toBe(SEED.stock['KB-001'] + 10)
    expect((await movementsFor('KB-001')).at(-1)).toEqual({ type: 'purchase', qty: 10, note: 'Purchase from KeyCo E2E' })
    expect(await count('purchases')).toBe(SEED.purchases + 1)

    await page.getByRole('navigation').getByRole('button', { name: 'Dashboard' }).click()
    await expect(page.locator('.card').filter({ hasText: 'Total purchases' }).locator('.value')).toHaveText('$6,490.00')
  })

  test('a purchase without a supplier uses the default ledger note', async ({ page }) => {
    await page.getByRole('combobox').selectOption({ label: 'USB-C Cable 2m' })
    await page.getByPlaceholder('Quantity').fill('5')
    await page.getByRole('button', { name: 'Add purchase' }).click()
    await expect(page.getByRole('row').filter({ hasText: 'USB-C Cable 2m' })).toHaveCount(2) // seed + new
    expect((await movementsFor('CB-004')).at(-1).note).toBe('Purchase from supplier')
  })

  test('the server rejects a zero or fractional quantity', async ({ request }) => {
    const id = await idOf(request, 'KB-001')
    for (const qty of [0, -4, 1.5]) {
      const res = await request.post('/api/purchases', { data: { productId: id, qty, unitCost: 10 } })
      expect(res.status(), `qty ${qty}`).toBe(400)
    }
    expect(await count('purchases')).toBe(SEED.purchases)
  })
})
