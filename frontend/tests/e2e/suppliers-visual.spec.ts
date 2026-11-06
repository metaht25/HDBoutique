import { expect, test } from '@playwright/test'
import { context, json, mockBoutique, product } from '../fixtures/boutique'

const supplier = { supplier_id: 7, company_name: 'Confecciones Primavera', contact_first_names: 'María', contact_last_names: 'Pérez', phone_number: '81234567', work_email: 'contacto@example.invalid', address_line: 'Dirección comercial de prueba', department_name: 'Departamento histórico', municipality_name: 'Municipio histórico', is_active: true }

test('supplier directory remains readable on desktop, tablet and mobile with existing controls', async ({ page }, info) => {
  await mockBoutique(page)
  await page.route('**/reports/supplier-directory?*', route => json(route, { context, summary: { total_count: 2, active_count: 1, inactive_count: 1 }, items: [supplier, { ...supplier, supplier_id: 8, company_name: 'Proveedor histórico', is_active: false, work_email: null, address_line: null }] }))
  await page.goto('/suppliers')
  const directory = page.getByRole('region', { name: 'Directorio', exact: true })
  await expect(directory.getByText('Activo', { exact: true })).toBeVisible()
  await expect(directory.getByText('Inactivo', { exact: true })).toBeVisible()
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await expect(directory.getByText(supplier.company_name, { exact: true })).toBeVisible()
    await expect(directory.getByRole('button', { name: 'Ver detalle' }).first()).toBeVisible()
    if (width === 1440 || width === 390) await page.screenshot({ path: info.outputPath(`suppliers-${width}.png`), fullPage: true })
  }
  await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Registrar desde Compras' })).toHaveAttribute('href', '/purchases')
})

test('search and activation preserve existing requests and allow cancellation', async ({ page }) => {
  await mockBoutique(page)
  await page.route('**/reports/supplier-directory?*', route => json(route, { context, summary: { total_count: 45 }, items: [supplier] }))
  const writes: unknown[] = []
  await page.route('**/api/v1/suppliers/7', route => { writes.push(route.request().postDataJSON()); return json(route, { ...supplier, is_active: false }) })
  await page.goto('/suppliers'); await page.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Paginación' })).toContainText('Página 2 de 3')
  await page.getByLabel('Buscar', { exact: true }).fill('Primavera')
  await page.getByLabel('Estado', { exact: true }).selectOption('active')
  const sent = page.waitForRequest(req => req.url().includes('supplier-directory?') && new URL(req.url()).searchParams.get('q') === 'Primavera')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  const params = new URL((await sent).url()).searchParams
  expect(params.get('offset')).toBe('0'); expect(params.get('limit')).toBe('20'); expect(params.get('status')).toBe('active')
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Desactivar proveedor' })
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click(); expect(writes).toEqual([])
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click()
  await confirmation.getByRole('button', { name: 'Confirmar desactivación' }).click()
  await expect(confirmation).toHaveCount(0); expect(writes).toEqual([{ is_active: false }])
  await expect(page.getByText('Estado actualizado. El historial se conserva.')).toBeVisible()
})

test('supplier details preserve commercial information and server-paginated product associations', async ({ page }, info) => {
  await mockBoutique(page)
  await page.route('**/reports/supplier-directory?*', route => json(route, { context, summary: { total_count: 1 }, items: [supplier] }))
  const requests: URL[] = []
  await page.route('**/reports/product-catalog?*', route => {
    const url = new URL(route.request().url()); requests.push(url)
    const all = Array.from({ length: 125 }, (_, index) => ({ ...product, product_id: index + 1, name: `Prenda asociada ${index + 1}` })).filter(row => row.name.includes(url.searchParams.get('q') ?? ''))
    const offset = Number(url.searchParams.get('offset') ?? 0)
    return json(route, { context, summary: { total_count: all.length }, items: all.slice(offset, offset + 20) })
  })
  await page.goto('/suppliers'); await page.getByRole('button', { name: 'Ver detalle' }).click()
  const detail = page.getByRole('dialog', { name: 'Proveedor #7' })
  await expect(detail.getByText(supplier.work_email, { exact: true })).toBeVisible()
  await expect(detail.getByText(supplier.department_name, { exact: true })).toBeVisible()
  await detail.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await expect(detail.getByText('Prenda asociada 21', { exact: true })).toBeVisible()
  await detail.getByLabel('Buscar producto asociado').fill('Prenda asociada 125')
  await detail.getByRole('button', { name: 'Buscar productos', exact: true }).click()
  await expect(detail.getByText('Prenda asociada 125', { exact: true })).toBeVisible()
  expect(requests.every(url => url.searchParams.get('supplier_id') === '7' && url.searchParams.get('limit') === '20')).toBe(true)
  expect(requests.some(url => url.searchParams.get('offset') === '20')).toBe(true)
  await page.screenshot({ path: info.outputPath('supplier-details.png'), fullPage: true })
})
