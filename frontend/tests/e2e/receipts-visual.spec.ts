import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { context, json, mockBoutique, sale, saleRow } from '../fixtures/boutique'

const receipt = {
  receipt_number: '73', sale_number: 'V-00001', boutique: { name: 'Boutique sintética', phone_number: null, address_line: 'Dirección comercial sintética', logo_base64: null, ready: true },
  sale: { ...sale, customer_kind: 'delivery', customer_name: 'Cliente sintético', customer_phone: '81234567', customer_address: 'Domicilio sintético de entrega', seller_name: 'Vendedor sintético', delivery_cost: '25.00', total: '140.12', items: [{ ...sale.items[0]!, unit_price: '115.12', subtotal: '115.12' }], payment: { ...sale.payment, method: 'mixed', amount: '140.12', cash_amount: '90.12', transfer_amount: '50.00', received_amount: '100.00', change_amount: '9.88', reference: 'SYNTHETIC-TRANSFER' } },
}
async function mockReceipt(page: Page, role = 'Administrator') {
  await mockBoutique(page, role)
  await page.route('**/api/v1/receipts/1', route => json(route, receipt))
}

test('receipt directory preserves numbering, filters, pagination, keyboard preview and responsive information', async ({ page }, info) => {
  await mockReceipt(page)
  const rows = Array.from({ length: 21 }, (_, index) => ({ ...saleRow, sale_id: index + 1, receipt_id: index + 73, status: index === 1 ? 'voided' : 'confirmed' }))
  await page.route('**/api/v1/reports/sales-ledger?**', route => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') || 0)
    return json(route, { context, summary: { total_count: 21, today_count: 1, month_count: 21, total_amount: '2300.00' }, items: rows.slice(offset, offset + 20), methods: [], best_products: [] })
  })
  await page.goto('/receipts'); const table = page.getByRole('table', { name: 'Recibos', exact: true })
  await expect(table.getByText('73', { exact: true })).toBeVisible(); await expect(table.getByText('Anulada', { exact: true })).toBeVisible()
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (width === 1440 || width === 390) await page.screenshot({ path: info.outputPath(`receipts-${width}.png`) })
  }
  const trigger = table.getByRole('button', { name: 'Ver', exact: true }).first()
  await trigger.focus(); await trigger.press('Enter')
  const preview = page.getByRole('dialog', { name: 'Vista previa del recibo' }), ticket = preview.getByRole('article', { name: 'Ticket de 80 mm' })
  await expect(ticket).toContainText('73 · V-00001')
  for (const text of ['Cliente sintético', 'Vendedor sintético', 'Domicilio sintético de entrega', '81234567', 'Delivery', 'C$ 25.00', 'C$ 90.12', 'C$ 50.00', 'C$ 9.88', 'TOTAL C$ 140.12']) await expect(ticket).toContainText(text)
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (width === 1440 || width === 390) await page.screenshot({ path: info.outputPath(`receipt-preview-${width}.png`) })
  }
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused()
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click(); await expect(table.getByText('93', { exact: true })).toBeVisible()
  await page.getByLabel('Número de venta o recibo', { exact: true }).fill('93')
  await page.getByLabel('Desde', { exact: true }).fill('2026-11-01'); await page.getByLabel('Hasta', { exact: true }).fill('2026-11-06')
  await page.getByLabel('Buscar cliente', { exact: true }).fill('Cliente')
  await page.getByLabel('Método de pago', { exact: true }).selectOption('mixed'); await page.getByLabel('Estado', { exact: true }).selectOption('voided')
  const request = page.waitForRequest(req => req.url().includes('sales-ledger?') && new URL(req.url()).searchParams.has('q'))
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  expect(Object.fromEntries(new URL((await request).url()).searchParams)).toMatchObject({ q: '93', receipts: 'true', offset: '0', start_date: '2026-11-01', end_date: '2026-11-06', customer: 'Cliente', method: 'mixed', status: 'voided' })
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click(); await expect(page.getByLabel('Número de venta o recibo', { exact: true })).toHaveValue('')
})

test('preview preserves the 80 mm print surface, original PDF filename and download validation', async ({ page }) => {
  await mockReceipt(page)
  await page.addInitScript(() => { window.print = () => { document.body.dataset.ticketPrinted = 'true' } })
  await page.route('**/api/v1/receipts/1/pdf', route => route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\nSynthetic isolated download fixture\n%%EOF' }))
  await page.goto('/receipts'); await page.getByRole('button', { name: 'Imprimir / PDF', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Vista previa del recibo' })
  await preview.getByRole('button', { name: 'Imprimir ticket', exact: true }).click()
  await expect(page.locator('body')).toHaveAttribute('data-ticket-printed', 'true')
  const downloaded = page.waitForEvent('download')
  await preview.getByRole('button', { name: 'Exportar PDF', exact: true }).click(); expect((await downloaded).suggestedFilename()).toBe('73.pdf')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#receipt-print')).toBeVisible()
  expect(await page.locator('#receipt-print').evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(302)
  await expect(page.locator('#receipt-print article')).toContainText('73 · V-00001')
  await expect(page.locator('#receipt-print article')).toContainText('TOTAL C$ 140.12')
  await expect(preview.getByRole('button', { name: 'Exportar PDF', exact: true })).toBeHidden()
  await page.emulateMedia({ media: 'screen' })
  await page.route('**/api/v1/receipts/1/pdf', route => route.fulfill({ status: 200, contentType: 'application/pdf', body: 'This is not a PDF' }))
  await preview.getByRole('button', { name: 'Exportar PDF', exact: true }).click()
  await expect(preview.getByRole('alert')).toContainText('No se pudo descargar el PDF.')
  await expect(preview.getByRole('article', { name: 'Ticket de 80 mm' })).toBeVisible()
})

test('receipt loading, empty and unavailable previews retain safe disabled actions', async ({ page }) => {
  await mockReceipt(page)
  let releaseList!: () => void
  const listGate = new Promise<void>(resolve => { releaseList = resolve })
  await page.route('**/api/v1/reports/sales-ledger?**', async route => { await listGate; await json(route, { context, summary: { total_count: 0 }, items: [], methods: [], best_products: [] }) })
  await page.goto('/receipts'); await expect(page.getByRole('heading', { name: 'Cargando recibos…' })).toBeVisible()
  releaseList(); await expect(page.getByRole('heading', { name: 'No hay recibos para mostrar' })).toBeVisible()
  await page.route('**/api/v1/reports/sales-ledger?**', route => json(route, { context, summary: { total_count: 1 }, items: [saleRow], methods: [], best_products: [] }))
  let releaseReceipt!: () => void
  const receiptGate = new Promise<void>(resolve => { releaseReceipt = resolve })
  await page.route('**/api/v1/receipts/1', async route => { await receiptGate; await json(route, { error: { code: 'not_found', message: 'Recibo no disponible' } }, 404) })
  await page.reload(); await page.getByRole('button', { name: 'Ver', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Vista previa del recibo' })
  await expect(preview.getByRole('heading', { name: 'Cargando recibo…' })).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Imprimir ticket', exact: true })).toBeDisabled()
  releaseReceipt(); await expect(preview.getByRole('alert')).toContainText('Recibo no disponible')
  await expect(preview.getByRole('button', { name: 'Exportar PDF', exact: true })).toBeDisabled()
  await expect(page.locator('#receipt-print')).toHaveCount(0)
  await preview.getByRole('button', { name: 'Cerrar', exact: true }).click(); await expect(preview).toHaveCount(0)
})

test('collaborator preview keeps annulment and refund history without administrative actions', async ({ page }) => {
  await mockReceipt(page, 'Cashier')
  await page.route('**/api/v1/receipts/1', route => json(route, { ...receipt, sale: { ...receipt.sale, status: 'voided', annulment: { reason: 'Devolución sintética supervisada', amount: '140.12', cash_amount: '90.12', transfer_amount: '50.00', reference: 'SYNTHETIC-REFUND' } } }))
  await page.goto('/receipts'); await expect(page.getByRole('heading', { name: 'Tus recibos', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Vista previa del recibo' }), ticket = preview.getByRole('article', { name: 'Ticket de 80 mm' })
  await expect(ticket).toContainText('ANULADO'); await expect(ticket).toContainText('Devolución sintética supervisada')
  await expect(ticket).toContainText('Efectivo reintegrado: C$ 90.12'); await expect(ticket).toContainText('Transferencia reintegrada: C$ 50.00')
  await expect(preview.getByRole('button', { name: 'Anular venta', exact: true })).toHaveCount(0)
  await expect(page.locator('body')).toHaveAttribute('data-role', 'Cashier')
})
