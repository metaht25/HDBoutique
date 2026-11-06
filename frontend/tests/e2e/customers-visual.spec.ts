import { expect, test } from '@playwright/test'
import { context, customer, json, mockBoutique } from '../fixtures/boutique'

test('customer directory retains server filters, pagination, keyboard details and responsive cards', async ({ page }, info) => {
  await mockBoutique(page, 'Cashier')
  const rows = Array.from({ length: 21 }, (_, index) => ({ ...customer, customer_id: index + 1, first_names: 'Persona', last_names: `Sintética ${index + 1}`, kind: index === 0 ? 'delivery' : 'regular' }))
  await page.route('**/api/v1/reports/customer-directory?**', route => {
    const url = new URL(route.request().url()), offset = Number(url.searchParams.get('offset') || 0)
    return json(route, { context, summary: { total_count: 21, active_count: 21 }, items: rows.slice(offset, offset + 20) })
  })
  await page.goto('/customers')
  const table = page.getByRole('table', { name: 'Directorio' })
  await expect(page.getByText('Cliente general', { exact: true })).toBeVisible()
  await expect(table.getByText('Cliente general', { exact: true })).toHaveCount(0)
  await expect(table.getByText('Delivery', { exact: true })).toBeVisible()
  await expect(table.getByText('Regular', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Nuevo cliente|Editar|Desactivar/ })).toHaveCount(0)
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (width === 1440 || width === 390) await page.screenshot({ path: info.outputPath(`customers-${width}.png`), fullPage: true })
  }
  const trigger = table.getByRole('button', { name: 'Ver detalle' }).first()
  await trigger.focus(); await trigger.press('Enter')
  const detail = page.getByRole('dialog', { name: 'Cliente #1' })
  await expect(detail.getByRole('heading', { name: 'Datos de Delivery' })).toBeVisible()
  await expect(detail.getByText('Los datos de Delivery se completan o actualizan al seleccionar este cliente en Nueva venta.')).toBeVisible()
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused()
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await expect(table.getByText('Persona Sintética 21', { exact: true })).toBeVisible()
  await page.getByLabel('Buscar', { exact: true }).fill('Persona')
  await page.getByLabel('Departamento', { exact: true }).selectOption('1')
  await page.getByLabel('Estado', { exact: true }).selectOption('active')
  const filtered = page.waitForRequest(request => request.url().includes('customer-directory?') && new URL(request.url()).searchParams.get('q') === 'Persona')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  const url = new URL((await filtered).url())
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ q: 'Persona', department_id: '1', status: 'active', offset: '0', limit: '20' })
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click()
  await expect(page.getByLabel('Buscar', { exact: true })).toHaveValue('')
})

test('customer directory distinguishes loading, empty and failed requests', async ({ page }) => {
  await mockBoutique(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v1/reports/customer-directory?**', async route => { await gate; await json(route, { context, summary: { total_count: 0 }, items: [] }) })
  await page.goto('/customers'); await expect(page.getByRole('heading', { name: 'Cargando clientes…' })).toBeVisible()
  release(); await expect(page.getByRole('heading', { name: 'No hay clientes para mostrar' })).toBeVisible()
  await page.route('**/api/v1/reports/customer-directory?**', route => json(route, { error: { code: 'unavailable', message: 'Directorio temporalmente no disponible' } }, 503))
  await page.reload(); await expect(page.getByRole('alert').filter({ hasText: 'Directorio temporalmente no disponible' }).first()).toBeVisible()
})

test('existing delivery form preserves identity, required fields and cancel without writes', async ({ page }, info) => {
  await mockBoutique(page, 'Cashier')
  const writes: string[] = []
  page.on('request', request => { if (request.method() !== 'GET' && /\/customers|\/sales$/.test(new URL(request.url()).pathname)) writes.push(request.url()) })
  await page.goto('/new-sale'); await page.getByLabel('Tipo de cliente', { exact: true }).selectOption('delivery')
  await page.getByLabel('Seleccionar cliente', { exact: true }).fill('Cliente')
  await page.getByRole('option', { name: 'Cliente Prueba', exact: true }).click()
  await page.getByRole('button', { name: 'Completar datos de entrega' }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar cliente' })
  await expect(dialog.getByLabel('Nombres', { exact: true })).toHaveAttribute('readonly', '')
  await expect(dialog.getByLabel('Apellidos', { exact: true })).toHaveAttribute('readonly', '')
  await expect(dialog.getByRole('heading', { name: 'Información personal' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Datos de Delivery' })).toBeVisible()
  await dialog.getByLabel('Teléfono', { exact: true }).fill('')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(dialog).toBeVisible()
  expect(await dialog.getByLabel('Teléfono', { exact: true }).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: info.outputPath(`customer-delivery-${width}.png`) })
  }
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(dialog).toHaveCount(0); expect(writes).toEqual([])
})
