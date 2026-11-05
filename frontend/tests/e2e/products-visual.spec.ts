import { expect, test } from '@playwright/test'
import { context, json, mockBoutique, product } from '../fixtures/boutique'

const products = [
  { ...product, product_id: 1, name: 'Blusa de lino', legacy_stock: 0, status: 'out_of_stock', suppliers: ['Taller del Norte', 'Confecciones Primavera'] },
  { ...product, product_id: 2, name: 'Vestido de algodón con nombre largo para comprobar la lectura', legacy_stock: 3, status: 'low_stock' },
  { ...product, product_id: 3, name: 'Pantalón clásico', legacy_stock: 18, status: 'available' },
  { ...product, product_id: 4, name: 'Prenda histórica', legacy_stock: null, status: 'unknown', is_active: false },
]

test('inventory keeps all real fields readable on desktop, tablet and mobile', async ({ page }, info) => {
  await mockBoutique(page)
  await page.route('**/reports/product-catalog?*', route => json(route, { context, summary: { total_count: products.length, low_stock: 1, out_of_stock: 1, inventory_value: '2100.00' }, items: products }))
  await page.goto('/products')
  const catalog = page.getByRole('region', { name: 'Listado de productos' })
  await expect(catalog.getByText('Agotado', { exact: true })).toBeVisible()
  await expect(catalog.getByText('Stock bajo', { exact: true })).toBeVisible()
  await expect(catalog.getByText('Suficiente', { exact: true })).toBeVisible()
  await expect(catalog.getByText('Inactivo', { exact: true })).toBeVisible()
  await expect(catalog.getByText('Taller del Norte', { exact: true })).toBeVisible()
  await expect(catalog.getByText('Confecciones Primavera', { exact: true })).toBeVisible()
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    for (const row of products) {
      const item = catalog.getByRole('row').filter({ hasText: row.name })
      await expect(item.getByText(row.name, { exact: true })).toBeVisible()
      await expect(item.getByRole('button', { name: 'Editar', exact: true })).toBeVisible()
      const bounds = await item.boundingBox()
      expect(bounds!.width).toBeLessThanOrEqual(width)
    }
    if (width === 1440 || width === 390) await page.screenshot({ path: info.outputPath(`products-${width}.png`), fullPage: true })
  }
})

test('filters use the existing server contract, reset page and offer recovery from empty results', async ({ page }) => {
  await mockBoutique(page)
  await page.route('**/reports/product-catalog?*', route => {
    const url = new URL(route.request().url()), empty = url.searchParams.get('q') === 'No existe'
    return json(route, { context, summary: { total_count: empty ? 0 : 45 }, items: empty ? [] : [product] })
  })
  await page.goto('/products')
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Paginación' })).toContainText('Página 2 de 3')
  await page.getByLabel('Buscar producto', { exact: true }).fill('No existe')
  await page.getByLabel('Estado', { exact: true }).selectOption('low_stock')
  const request = page.waitForRequest(req => req.url().includes('product-catalog?') && new URL(req.url()).searchParams.get('q') === 'No existe')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  const url = new URL((await request).url())
  expect(url.searchParams.get('status')).toBe('low_stock'); expect(url.searchParams.get('offset')).toBe('0'); expect(url.searchParams.get('limit')).toBe('20')
  await expect(page.getByRole('heading', { name: 'No encontramos productos' })).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click()
  await expect(page.getByLabel('Buscar producto', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Estado', { exact: true })).toHaveValue('')
  await expect(page.getByRole('region', { name: 'Listado de productos' })).toBeVisible()
})

test('editing and confirmation keep original values, keyboard focus and safe cancellation', async ({ page }, info) => {
  await mockBoutique(page)
  const writes: string[] = []
  page.on('request', req => { if (req.method() === 'PATCH') writes.push(req.url()) })
  await page.goto('/products')
  const edit = page.getByRole('button', { name: 'Editar', exact: true })
  await edit.click()
  const modal = page.getByRole('dialog', { name: 'Editar producto' })
  await expect(modal.getByLabel('Costo (NIO)', { exact: true })).toHaveValue('100.00')
  await expect(modal.getByLabel('Precio de venta (+15 %)')).toHaveValue('C$ 115.00')
  for (const text of ['Información del producto', 'Costo y precio de venta', 'Proveedores']) await expect(modal.getByRole('heading', { name: new RegExp(text) })).toBeVisible()
  await page.screenshot({ path: info.outputPath('product-edit.png'), fullPage: true })
  await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0); await expect(edit).toBeFocused()
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Desactivar producto' })
  await expect(confirmation.getByText(/Se conservará todo su historial/)).toBeVisible()
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click()
  expect(writes).toEqual([])
})

test('loading, server error and retry remain visible and accessible', async ({ page }) => {
  await mockBoutique(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let first = true
  await page.route('**/reports/product-catalog?*', async route => {
    if (first) { first = false; await gate; return json(route, { error: { code: 'database_unavailable', message: 'Database unavailable' } }, 503) }
    return json(route, { context, summary: { total_count: 0 }, items: [] })
  })
  await page.goto('/products')
  try { await expect(page.getByText('Cargando productos…', { exact: true })).toBeVisible() } finally { release() }
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible()
  await expect(page.getByRole('alert').first()).toContainText('El servicio no está disponible')
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tu catálogo está por comenzar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar primer producto' })).toBeVisible()
})

test('server validation identifies the field and preserves the editing draft and API payload', async ({ page }) => {
  await mockBoutique(page)
  await page.route('**/api/v1/products/1', route => json(route, { error: { code: 'validation_error', message: 'Invalid request', fields: [{ location: ['body', 'cost'], type: 'greater_than' }] } }, 422))
  await page.goto('/products'); await page.getByRole('button', { name: 'Editar', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Editar producto' })
  await modal.getByLabel('Nombre', { exact: true }).fill('Prenda revisada')
  const request = page.waitForRequest(req => req.url().endsWith('/api/v1/products/1') && req.method() === 'PATCH')
  await modal.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  const body = (await request).postDataJSON()
  expect(body.cost).toBe('100.00'); expect(body.name).toBe('Prenda revisada')
  for (const field of ['unit_price', 'initial_stock', 'legacy_stock', 'size_id']) expect(body).not.toHaveProperty(field)
  const cost = modal.getByLabel('Costo (NIO)', { exact: true })
  await expect(cost).toHaveAttribute('aria-invalid', 'true')
  await expect(modal.getByRole('alert')).toContainText('Costo:')
  await expect(modal.getByLabel('Nombre', { exact: true })).toHaveValue('Prenda revisada')
  const errorId = await cost.getAttribute('aria-describedby')
  await expect(modal.locator(`[id="${errorId}"]`)).toContainText('mínimo permitido')
})
