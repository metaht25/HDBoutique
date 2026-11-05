import { expect, test } from '@playwright/test'
import { origin, signIn } from './helpers'

test('F04: real paginated selectors reach products and suppliers beyond 100 without crossing supplier associations', async ({ page }) => {
  test.setTimeout(180000)
  await signIn(page)
  const csrf = (await (await page.request.get('/api/v1/auth/csrf')).json()).csrf_token
  const headers = { Origin: origin, 'X-CSRF-Token': csrf }
  const supplierIds: number[] = []
  for (let index = 1; index <= 125; index++) {
    const response = await page.request.post('/api/v1/purchases/suppliers', { headers: { ...headers, 'Idempotency-Key': `f04-supplier-${index}` }, data: {
      company_name: `F04 Supplier ${String(index).padStart(3, '0')}`, contact_first_names: 'Synthetic', contact_last_names: 'Contact', phone_number: String(80010000 + index),
    } })
    expect(response.status()).toBe(201); supplierIds.push((await response.json()).supplier_id)
  }
  const category = await page.request.post('/api/v1/categories', { headers, data: { name: 'F04 synthetic' } })
  expect(category.status()).toBe(201)
  const categoryId = (await category.json()).category_id
  let oldestProduct = 0
  for (let index = 1; index <= 125; index++) {
    const response = await page.request.post('/api/v1/products', { headers, data: {
      name: `F04 Product ${String(index).padStart(3, '0')}`, category_id: categoryId, size_id: 1, cost: '100.00', supplier_ids: [supplierIds[0]], initial_stock: 0,
    } })
    expect(response.status()).toBe(201)
    if (index === 1) oldestProduct = (await response.json()).product_id
  }
  const selectorRequests: URL[] = []
  page.on('request', request => {
    if (request.url().includes('/reports/product-catalog?') || request.url().includes('/reports/supplier-directory?')) selectorRequests.push(new URL(request.url()))
  })
  await page.goto('/purchases')
  const historySupplier = page.getByRole('combobox', { name: 'Proveedor', exact: true })
  await historySupplier.fill('F04 Supplier 001')
  await page.getByRole('option', { name: 'F04 Supplier 001', exact: true }).click()
  const filtered = page.waitForResponse(response => response.url().includes('/reports/purchase-ledger?') && new URL(response.url()).searchParams.get('supplier_id') === String(supplierIds[0]))
  await page.getByRole('button', { name: 'Buscar', exact: true }).click(); await filtered
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click()
  await expect(historySupplier).toHaveValue('')
  await page.getByRole('button', { name: '+ Nueva compra' }).click()
  const modal = page.getByRole('dialog', { name: 'Nueva compra' })
  await modal.getByRole('combobox', { name: 'Proveedor' }).fill('F04 Supplier 001')
  await modal.getByRole('option', { name: 'F04 Supplier 001', exact: true }).click()
  const product = modal.getByRole('combobox', { name: 'Producto' })
  await product.click()
  await expect(modal.getByRole('option', { name: 'F04 Product 125', exact: true })).toBeVisible()
  const pages = modal.getByRole('group', { name: 'Páginas de Producto' })
  for (let pageNumber = 2; pageNumber <= 7; pageNumber++) {
    await pages.getByRole('button', { name: 'Siguiente' }).click()
    await expect(pages).toContainText(`Página ${pageNumber} de 7`)
    const first = String(125 - 20 * (pageNumber - 1)).padStart(3, '0')
    await expect(modal.getByRole('option', { name: `F04 Product ${first}`, exact: true })).toBeVisible()
  }
  await modal.getByRole('option', { name: 'F04 Product 001', exact: true }).click()
  await expect(modal.getByLabel('Costo de compra (NIO)')).toHaveValue('C$ 100.00')
  await modal.getByRole('button', { name: 'Agregar producto' }).click()
  await modal.getByRole('combobox', { name: 'Proveedor' }).fill('F04 Supplier 125')
  await modal.getByRole('option', { name: 'F04 Supplier 125', exact: true }).click()
  await product.click(); await expect(modal.getByText('Sin coincidencias', { exact: true })).toBeVisible()
  await expect(modal.getByRole('table')).not.toContainText('F04 Product 001')
  await modal.getByRole('combobox', { name: 'Proveedor' }).fill('F04 Supplier 001')
  await modal.getByRole('option', { name: 'F04 Supplier 001', exact: true }).click()
  await product.fill('F04 Product 001')
  await modal.getByRole('option', { name: 'F04 Product 001', exact: true }).click()
  await modal.getByRole('button', { name: 'Agregar producto' }).click()
  const saved = page.waitForResponse(response => response.url().endsWith('/api/v1/purchases') && response.request().method() === 'POST')
  await modal.getByRole('button', { name: 'Guardar compra pendiente' }).click()
  const response = await saved
  expect(response.status()).toBe(201)
  expect((await response.json()).items[0].product_id).toBe(oldestProduct)
  expect(selectorRequests.every(url => url.searchParams.get('limit') === '20')).toBe(true)
  expect(selectorRequests.filter(url => url.pathname.includes('product-catalog')).every(url => url.searchParams.has('supplier_id'))).toBe(true)
})
