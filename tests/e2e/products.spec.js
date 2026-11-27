import { test, expect, SEED, gotoTab, row } from './support/fixtures.js'
import { count, productBySku, stockOf, movementsFor, query } from './support/db.js'

async function fillProduct(page, p) {
  await page.getByPlaceholder('SKU').fill(p.sku)
  await page.getByPlaceholder('Name').fill(p.name)
  await page.getByPlaceholder('Category').fill(p.category ?? '')
  await page.getByPlaceholder('Cost').fill(String(p.cost))
  await page.getByPlaceholder('Price').fill(String(p.price))
  await page.getByPlaceholder('Reorder level').fill(String(p.reorderLevel))
}

test.describe('Products', () => {
  test.beforeEach(async ({ page }) => {
    await gotoTab(page, 'Products')
  })

  test('lists the seeded products with their derived stock', async ({ page }) => {
    for (const [sku, stock] of Object.entries(SEED.stock)) {
      await expect(row(page, sku).getByRole('cell').nth(5)).toHaveText(String(stock))
    }
  })

  test('adds a product: appears in the list, persisted, form cleared, starts at zero stock', async ({ page }) => {
    await fillProduct(page, { sku: 'WC-100', name: 'Webcam HD', category: 'Video', cost: 20.5, price: 49.99, reorderLevel: 4 })
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    const r = row(page, 'WC-100')
    await expect(r).toContainText('Webcam HD')
    await expect(r).toContainText('$20.50')
    await expect(r).toContainText('$49.99')
    await expect(r.getByRole('cell').nth(5)).toHaveText('0')
    await expect(page.getByPlaceholder('SKU')).toHaveValue('')

    expect(await productBySku('WC-100')).toMatchObject({ name: 'Webcam HD', cost: 20.5, price: 49.99, reorderLevel: 4 })
    expect(await count('products')).toBe(SEED.products + 1)
  })

  test('rejects a duplicate SKU regardless of case and adds nothing', async ({ page }) => {
    await fillProduct(page, { sku: 'kb-001', name: 'Imposter Keyboard', cost: 1, price: 2, reorderLevel: 1 })
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    await expect(page.locator('.banner')).toContainText('already exists')
    await expect(row(page, 'Imposter Keyboard')).toHaveCount(0)
    expect(await count('products')).toBe(SEED.products)
  })

  test('does not submit when required fields are missing', async ({ page }) => {
    await page.getByPlaceholder('Name').fill('No SKU product')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(row(page, 'No SKU product')).toHaveCount(0)
    expect(await count('products')).toBe(SEED.products)
  })

  test('edits a product and keeps its stock history', async ({ page }) => {
    await row(page, 'MS-002').getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit product' })).toBeVisible()
    await page.getByPlaceholder('Price').fill('31.5')
    await page.getByPlaceholder('Name').fill('Wireless Mouse v2')
    await page.getByRole('button', { name: 'Save' }).click()

    const r = row(page, 'MS-002')
    await expect(r).toContainText('Wireless Mouse v2')
    await expect(r).toContainText('$31.50')
    await expect(r.getByRole('cell').nth(5)).toHaveText(String(SEED.stock['MS-002']))
    expect(await productBySku('MS-002')).toMatchObject({ name: 'Wireless Mouse v2', price: 31.5 })
    expect(await count('products')).toBe(SEED.products)
  })

  test('cancelling an edit leaves the product untouched', async ({ page }) => {
    await row(page, 'MS-002').getByRole('button', { name: 'Edit' }).click()
    await page.getByPlaceholder('Name').fill('Should not be saved')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Add product' })).toBeVisible()
    await expect(row(page, 'Wireless Mouse')).toBeVisible()
    expect((await productBySku('MS-002')).name).toBe('Wireless Mouse')
  })

  test('deleting a product removes it together with its purchases, sales and movements', async ({ page }) => {
    const { id } = await productBySku('CB-004')
    page.once('dialog', (d) => d.accept())
    await row(page, 'CB-004').getByRole('button', { name: 'Delete' }).click()

    await expect(row(page, 'CB-004')).toHaveCount(0)
    expect(await count('products')).toBe(SEED.products - 1)
    for (const t of ['purchases', 'sales', 'movements']) {
      const { rows } = await query(`SELECT COUNT(*)::int AS n FROM ${t} WHERE product_id = $1`, [id])
      expect(rows[0].n, `${t} for deleted product`).toBe(0)
    }
    expect(await count('movements')).toBe(SEED.movements - 2)
  })

  test('declining the delete confirmation keeps the product', async ({ page }) => {
    page.once('dialog', (d) => d.dismiss())
    await row(page, 'CB-004').getByRole('button', { name: 'Delete' }).click()
    await expect(row(page, 'CB-004')).toBeVisible()
    expect(await count('products')).toBe(SEED.products)
  })

  test('search filters by name, SKU and category and shows an empty state', async ({ page }) => {
    const search = page.getByPlaceholder('Search products…')
    await search.fill('mouse')
    await expect(row(page, 'MS-002')).toBeVisible()
    await expect(row(page, 'KB-001')).toHaveCount(0)

    await search.fill('audio') // category
    await expect(row(page, 'HS-005')).toBeVisible()
    await expect(row(page, 'MS-002')).toHaveCount(0)

    await search.fill('zzz-nothing')
    await expect(page.getByText('No products found.')).toBeVisible()
  })

  test('negative stock adjustment lowers stock and is recorded with its reason', async ({ page }) => {
    await row(page, 'KB-001').getByRole('button', { name: 'Adjust' }).click()
    await page.getByPlaceholder(/quantity/).fill('-3')
    await page.getByPlaceholder('Reason').fill('Damaged in transit')
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect(row(page, 'KB-001').getByRole('cell').nth(5)).toHaveText('5')
    expect(await stockOf('KB-001')).toBe(5)
    const movements = await movementsFor('KB-001')
    expect(movements.at(-1)).toEqual({ type: 'adjustment', qty: -3, note: 'Damaged in transit' })
  })

  test('positive adjustment without a reason uses the default note', async ({ page }) => {
    await row(page, 'KB-001').getByRole('button', { name: 'Adjust' }).click()
    await page.getByPlaceholder(/quantity/).fill('7')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(row(page, 'KB-001').getByRole('cell').nth(5)).toHaveText('15')
    expect((await movementsFor('KB-001')).at(-1)).toEqual({ type: 'adjustment', qty: 7, note: 'Manual adjustment' })
  })

  test('an adjustment that would make stock negative is rejected', async ({ page }) => {
    await row(page, 'KB-001').getByRole('button', { name: 'Adjust' }).click()
    await page.getByPlaceholder(/quantity/).fill('-100')
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect(page.locator('.banner')).toContainText('negative')
    await expect(row(page, 'KB-001').getByRole('cell').nth(5)).toHaveText('8')
    expect(await stockOf('KB-001')).toBe(8)
    expect(await count('movements')).toBe(SEED.movements)
  })
})
