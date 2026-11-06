import { expect, test } from '@playwright/test'
import { context, json, mockBoutique, sale, saleRow } from '../fixtures/boutique'

test('sales retain server filters, pagination, statuses and responsive details', async ({ page }, info) => {
  await mockBoutique(page)
  const rows = Array.from({ length: 21 }, (_, index) => ({ ...saleRow, sale_id: index + 1, receipt_id: index + 1, customer_name: `Cliente sintético ${index + 1}`, status: index === 1 ? 'voided' : 'confirmed' }))
  await page.route('**/api/v1/reports/sales-ledger?**', route => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') || 0)
    return json(route, { context, summary: { total_count: 21, total_amount: '2300.00', units: 20 }, items: rows.slice(offset, offset + 20), methods: [{ method: 'cash', count: 20, total: '2300.00' }], best_products: [{ product_id: 1, name: 'Prenda sintética', quantity: 20, total: '2300.00' }] })
  })
  await page.goto('/sales')
  const table = page.getByRole('table', { name: 'Ventas', exact: true })
  await expect(table.getByText('Confirmada', { exact: true }).first()).toBeVisible()
  await expect(table.getByText('Anulada', { exact: true })).toBeVisible()
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (width === 1440 || width === 390) await page.screenshot({ path: info.outputPath(`sales-${width}.png`) })
  }
  const trigger = table.getByRole('button', { name: 'Ver', exact: true }).first()
  await trigger.focus(); await trigger.press('Enter')
  const detail = page.getByRole('dialog', { name: 'Venta V-00001' })
  await expect(detail.getByRole('heading', { name: 'Cliente y entrega', exact: true })).toBeVisible()
  await expect(detail.getByRole('table', { name: 'Detalle de venta' })).toContainText('C$ 115.00')
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (width !== 320) await page.screenshot({ path: info.outputPath(`sale-detail-${width}.png`) })
  }
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused()
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await expect(table.getByText('V-00021', { exact: true })).toBeVisible()
  await page.getByLabel('Desde', { exact: true }).fill('2026-11-01'); await page.getByLabel('Hasta', { exact: true }).fill('2026-11-06')
  await page.getByLabel('Buscar cliente', { exact: true }).fill('Cliente')
  await page.getByLabel('Método de pago', { exact: true }).selectOption('mixed'); await page.getByLabel('Estado', { exact: true }).selectOption('voided')
  const request = page.waitForRequest(req => req.url().includes('sales-ledger?') && new URL(req.url()).searchParams.has('start_date'))
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  expect(Object.fromEntries(new URL((await request).url()).searchParams)).toMatchObject({ start_date: '2026-11-01', end_date: '2026-11-06', customer: 'Cliente', method: 'mixed', status: 'voided', offset: '0', limit: '20', receipts: 'false' })
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click(); await expect(page.getByLabel('Buscar cliente', { exact: true })).toHaveValue('')
})

test('void controls retain mandatory real returns, full refund confirmation and cancel without writes', async ({ page }, info) => {
  await mockBoutique(page)
  let writes = 0
  await page.route('**/api/v1/sales/1/void', route => { writes++; return json(route, sale) })
  await page.goto('/sales'); await page.getByRole('table', { name: 'Ventas', exact: true }).getByRole('button', { name: 'Ver', exact: true }).click()
  const detail = page.getByRole('dialog', { name: 'Venta V-00001' })
  await detail.getByRole('button', { name: 'Anular venta', exact: true }).click()
  const correction = detail.getByRole('region', { name: 'Anulación de venta' })
  await correction.getByRole('button', { name: 'Confirmar anulación total' }).click()
  await expect(correction.getByRole('alert')).toContainText('cantidades realmente devueltas')
  await expect(correction.getByLabel(/Cantidad devuelta de producto/)).toHaveValue('')
  expect(writes).toBe(0)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: info.outputPath(`sale-void-${width}.png`) })
  }
  await detail.getByRole('button', { name: 'Cancelar anulación', exact: true }).click()
  await expect(correction).toHaveCount(0); expect(writes).toBe(0)
})

test('historical sales without payments do not expose receipts or annulment', async ({ page }) => {
  await mockBoutique(page)
  await page.route('**/api/v1/sales/1', route => json(route, { ...sale, payment: null, status: null, total: null, items: [] }))
  await page.goto('/sales'); await page.getByRole('table', { name: 'Ventas', exact: true }).getByRole('button', { name: 'Ver', exact: true }).click()
  const detail = page.getByRole('dialog', { name: 'Venta V-00001' })
  await expect(detail.getByText('Histórica', { exact: true })).toBeVisible()
  await expect(detail.getByText('Sin cobro registrado', { exact: true })).toHaveCount(2)
  await expect(detail.getByRole('button', { name: 'Ver recibo', exact: true })).toHaveCount(0)
  await expect(detail.getByRole('button', { name: 'Anular venta', exact: true })).toHaveCount(0)
})

test('sales distinguish loading, empty and unavailable data', async ({ page }) => {
  await mockBoutique(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v1/reports/sales-ledger?**', async route => { await gate; await json(route, { context, summary: { total_count: 0 }, items: [], methods: [], best_products: [] }) })
  await page.goto('/sales'); await expect(page.getByRole('heading', { name: 'Cargando ventas…' })).toBeVisible()
  release(); await expect(page.getByRole('heading', { name: 'No hay ventas para mostrar' })).toBeVisible()
  await page.route('**/api/v1/reports/sales-ledger?**', route => json(route, { error: { code: 'unavailable', message: 'Consulta de ventas temporalmente no disponible' } }, 503))
  await page.reload(); await expect(page.getByRole('alert').filter({ hasText: 'Consulta de ventas temporalmente no disponible' }).first()).toBeVisible()
})
