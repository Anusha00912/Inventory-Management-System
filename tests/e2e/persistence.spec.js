import { test, expect, SEED, gotoTab, row } from './support/fixtures.js'
import { count } from './support/db.js'

test.describe('Persistence', () => {
  test('data survives a full page reload (it lives in the database, not the browser)', async ({ page }) => {
    await gotoTab(page, 'Products')
    await page.getByPlaceholder('SKU').fill('PERSIST-1')
    await page.getByPlaceholder('Name').fill('Persistent Item')
    await page.getByPlaceholder('Cost').fill('1')
    await page.getByPlaceholder('Price').fill('2')
    await page.getByPlaceholder('Reorder level').fill('1')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(row(page, 'PERSIST-1')).toBeVisible()

    await page.reload()
    await page.getByRole('navigation').getByRole('button', { name: 'Products' }).click()
    await expect(row(page, 'PERSIST-1')).toBeVisible()
  })

  test('data is shared between browser sessions', async ({ browser, request, baseURL }) => {
    const res = await request.post('/api/products', {
      data: { sku: 'SHARED-1', name: 'Shared Item', cost: 1, price: 2, reorderLevel: 1 },
    })
    expect(res.ok()).toBeTruthy()
    const other = await browser.newContext({ baseURL }) // fresh profile: no shared localStorage/cookies
    const p2 = await other.newPage()
    await gotoTab(p2, 'Products')
    await expect(row(p2, 'SHARED-1')).toBeVisible()
    await other.close()
  })

  test('"Reset demo data" restores the seed and drops custom records', async ({ page, request }) => {
    await request.post('/api/products', { data: { sku: 'TEMP-1', name: 'Temp', cost: 1, price: 2, reorderLevel: 1 } })
    expect(await count('products')).toBe(SEED.products + 1)

    await page.goto('/')
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Reset demo data' }).click()
    await page.getByRole('navigation').getByRole('button', { name: 'Products' }).click()

    await expect(row(page, 'TEMP-1')).toHaveCount(0)
    await expect(page.locator('tbody tr')).toHaveCount(SEED.products)
    expect(await count('products')).toBe(SEED.products)
    expect(await count('movements')).toBe(SEED.movements)
  })

  test('declining the reset confirmation changes nothing', async ({ page, request }) => {
    await request.post('/api/products', { data: { sku: 'KEEP-1', name: 'Keep me', cost: 1, price: 2, reorderLevel: 1 } })
    await page.goto('/')
    page.once('dialog', (d) => d.dismiss())
    await page.getByRole('button', { name: 'Reset demo data' }).click()
    expect(await count('products')).toBe(SEED.products + 1)
  })
})
