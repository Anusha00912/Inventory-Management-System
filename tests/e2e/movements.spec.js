import { test, expect, SEED, gotoTab, idOf } from './support/fixtures.js'

const dataRows = (page) => page.locator('tbody tr')

test.describe('Movements ledger', () => {
  test.beforeEach(async ({ page }) => {
    await gotoTab(page, 'Movements')
  })

  test('lists every seeded movement', async ({ page }) => {
    await expect(dataRows(page)).toHaveCount(SEED.movements)
  })

  test('filters by type', async ({ page }) => {
    const type = page.getByRole('combobox').nth(0)
    const product = page.getByRole('combobox').nth(1)
    await type.selectOption('sale')
    await expect(dataRows(page)).toHaveCount(SEED.sales)
    await expect(dataRows(page).filter({ hasText: 'purchase' })).toHaveCount(0)

    await type.selectOption('adjustment')
    await expect(dataRows(page)).toHaveCount(0)

    await type.selectOption('all')
    await product.selectOption({ label: 'Mechanical Keyboard' })
    await expect(dataRows(page)).toHaveCount(2) // one purchase, one sale
  })

  test('shows signed quantities', async ({ page }) => {
    await page.getByRole('combobox').nth(1).selectOption({ label: 'Mechanical Keyboard' })
    await expect(page.getByRole('cell', { name: '+40', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: '-32', exact: true })).toBeVisible()
  })

  test('a new sale shows up as the newest entry', async ({ page, request }) => {
    const id = await idOf(request, 'HS-005')
    expect((await request.post('/api/sales', { data: { productId: id, qty: 3, unitPrice: 139, customer: 'Ledger Test' } })).ok()).toBeTruthy()
    await page.reload()
    await page.getByRole('navigation').getByRole('button', { name: 'Movements' }).click()
    await expect(dataRows(page)).toHaveCount(SEED.movements + 1)
    await expect(dataRows(page).first()).toContainText('Sale to Ledger Test')
    await expect(dataRows(page).first()).toContainText('-3')
  })
})
