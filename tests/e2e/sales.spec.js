import { test, expect, SEED, gotoTab, row, idOf } from './support/fixtures.js'
import { count, stockOf, movementsFor, query } from './support/db.js'

async function selectProduct(page, label) {
  await page.getByRole('combobox').selectOption({ label })
}

test.describe('Sales', () => {
  test.beforeEach(async ({ page }) => {
    await gotoTab(page, 'Sales')
  })

  test('selecting a product shows its stock and prefills the unit price', async ({ page }) => {
    await selectProduct(page, 'Wireless Mouse (12 in stock)')
    await expect(page.getByPlaceholder('Unit price')).toHaveValue('29')
  })

  test('records a sale: history row, reduced stock, ledger entry', async ({ page }) => {
    await selectProduct(page, 'Wireless Mouse (12 in stock)')
    await page.getByPlaceholder('Quantity').fill('5')
    await page.getByPlaceholder('Customer').fill('E2E Corp')
    await page.getByRole('button', { name: 'Add sale' }).click()

    const r = row(page, 'E2E Corp')
    await expect(r).toContainText('Wireless Mouse')
    await expect(r).toContainText('$145.00') // 5 x $29
    // form reset and the dropdown now reflects the new stock
    await expect(page.getByPlaceholder('Quantity')).toHaveValue('')
    await expect(page.getByRole('option', { name: 'Wireless Mouse (7 in stock)' })).toBeAttached()

    expect(await stockOf('MS-002')).toBe(7)
    expect((await movementsFor('MS-002')).at(-1)).toEqual({ type: 'sale', qty: -5, note: 'Sale to E2E Corp' })
    expect(await count('sales')).toBe(SEED.sales + 1)
  })

  test('a custom unit price is used for the sale total', async ({ page }) => {
    await selectProduct(page, 'Mechanical Keyboard (8 in stock)')
    await page.getByPlaceholder('Quantity').fill('2')
    await page.getByPlaceholder('Unit price').fill('80')
    await page.getByPlaceholder('Customer').fill('Discount Co')
    await page.getByRole('button', { name: 'Add sale' }).click()

    await expect(row(page, 'Discount Co')).toContainText('$160.00')
    const { rows } = await query(`SELECT unit_price::float8 AS p FROM sales WHERE customer = 'Discount Co'`)
    expect(rows[0].p).toBe(80)
  })

  test('blocks overselling in the UI and records nothing', async ({ page }) => {
    await selectProduct(page, 'Wireless Mouse (12 in stock)')
    await page.getByPlaceholder('Quantity').fill('13')
    await page.getByRole('button', { name: 'Add sale' }).click()

    await expect(page.getByText('Only 12 in stock.')).toBeVisible()
    expect(await count('sales')).toBe(SEED.sales)
    expect(await stockOf('MS-002')).toBe(12)
  })

  test('selling exactly the remaining stock is allowed and leaves zero', async ({ page }) => {
    await selectProduct(page, 'Wireless Mouse (12 in stock)')
    await page.getByPlaceholder('Quantity').fill('12')
    await page.getByRole('button', { name: 'Add sale' }).click()

    await expect(page.getByRole('option', { name: 'Wireless Mouse (0 in stock)' })).toBeAttached()
    expect(await stockOf('MS-002')).toBe(0)
  })

  test('the server rejects an oversell even when the client check is bypassed', async ({ request }) => {
    const id = await idOf(request, 'HS-005') // stock 16
    const res = await request.post('/api/sales', { data: { productId: id, qty: 999, unitPrice: 139, customer: 'Bypass' } })
    expect(res.status()).toBe(409)
    expect((await res.json()).error).toContain('Only 16')
    expect(await count('sales')).toBe(SEED.sales)
    expect(await stockOf('HS-005')).toBe(16)
  })

  test('requires a product and quantity before submitting', async ({ page }) => {
    await page.getByRole('button', { name: 'Add sale' }).click()
    expect(await count('sales')).toBe(SEED.sales)
  })
})
