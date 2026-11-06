import { expect, test } from '@playwright/test'
import { context, json, mockBoutique, saleRow } from '../fixtures/boutique'

test('history retains exact server summaries, search, pagination, responsive cards and report printing', async ({ page }, info) => {
  await mockBoutique(page)
  await page.addInitScript(() => { window.print = () => { document.body.dataset.reportPrinted = 'true' } })
  const rows = Array.from({ length: 21 }, (_, index) => ({ ...saleRow, sale_id: index + 1, receipt_id: index === 2 ? null : index + 1, status: index === 1 ? 'voided' : index === 2 ? 'legacy' : 'confirmed', method: index === 2 ? null : saleRow.method, total: index === 2 ? null : saleRow.total }))
  await page.route('**/api/v1/reports/sales-ledger?**', route => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') || 0)
    return json(route, { context, summary: { total_count: 21, total_amount: '9999999999999999.99', units: 19, average: '115.00' }, items: rows.slice(offset, offset + 20), methods: [], best_products: [] })
  })
  await page.goto('/sales-history')
  const table = page.getByRole('table', { name: 'Ventas', exact: true })
  await expect(page.getByText('C$ 9,999,999,999,999,999.99', { exact: true })).toBeVisible()
  await expect(table.getByText('Histórica', { exact: true })).toBeVisible()
  await expect(table.getByRole('row').filter({ hasText: 'V-00003' }).getByText('Sin cobro registrado', { exact: true })).toBeVisible()
  await expect(table.getByRole('row').filter({ hasText: 'V-00003' }).getByRole('button', { name: 'Recibo', exact: true })).toHaveCount(0)
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (width === 1440 || width === 390) await page.screenshot({ path: info.outputPath(`history-${width}.png`) })
  }
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click(); await expect(table.getByText('V-00021', { exact: true })).toBeVisible()
  await page.getByLabel('Desde', { exact: true }).fill('2026-11-01'); await page.getByLabel('Hasta', { exact: true }).fill('2026-11-06')
  await page.getByLabel('Número de venta o recibo', { exact: true }).fill('V-00021')
  await page.getByLabel('Buscar cliente', { exact: true }).fill('Cliente')
  await page.getByLabel('Método de pago', { exact: true }).selectOption('transfer'); await page.getByLabel('Estado', { exact: true }).selectOption('voided')
  const request = page.waitForRequest(req => req.url().includes('sales-ledger?') && new URL(req.url()).searchParams.has('q'))
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  expect(Object.fromEntries(new URL((await request).url()).searchParams)).toMatchObject({ start_date: '2026-11-01', end_date: '2026-11-06', q: 'V-00021', customer: 'Cliente', method: 'transfer', status: 'voided', offset: '0', receipts: 'false' })
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click(); await expect(page.getByLabel('Número de venta o recibo', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Imprimir resultado', exact: true }).click()
  await expect(page.locator('body')).toHaveAttribute('data-report-printed', 'true')
  await page.emulateMedia({ media: 'print' })
  expect(await table.locator('thead').evaluate(node => getComputedStyle(node).position)).toBe('static')
  await expect(page.getByRole('button', { name: 'Imprimir resultado', exact: true })).toBeHidden()
})

test('history and sales remain administrative while receipts remain available to the collaborator', async ({ page }) => {
  await mockBoutique(page, 'Cashier')
  const calls: string[] = []
  page.on('request', request => { if (request.url().includes('reports/sales-ledger')) calls.push(request.url()) })
  for (const path of ['/sales', '/sales-history']) {
    await page.goto(path)
    await expect(page.getByText('Esta pantalla está disponible únicamente para la dueña.', { exact: true })).toBeVisible()
  }
  expect(calls).toEqual([])
  await page.goto('/receipts'); await expect(page.getByRole('region', { name: 'Recibos', exact: true }).getByRole('table')).toBeVisible()
  expect(calls.length).toBeGreaterThan(0); expect(calls.every(url => new URL(url).searchParams.get('receipts') === 'true')).toBe(true)
})

test('history distinguishes loading, empty and failed results', async ({ page }) => {
  await mockBoutique(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v1/reports/sales-ledger?**', async route => { await gate; await json(route, { context, summary: { total_count: 0 }, items: [], methods: [], best_products: [] }) })
  await page.goto('/sales-history'); await expect(page.getByRole('heading', { name: 'Cargando historial…' })).toBeVisible()
  release(); await expect(page.getByRole('heading', { name: 'Sin operaciones para estos filtros' })).toBeVisible()
  await page.route('**/api/v1/reports/sales-ledger?**', route => json(route, { error: { code: 'unavailable', message: 'Historial temporalmente no disponible' } }, 503))
  await page.reload(); await expect(page.getByRole('alert').filter({ hasText: 'Historial temporalmente no disponible' }).first()).toBeVisible()
})
