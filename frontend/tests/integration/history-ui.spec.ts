import { expect, test } from '@playwright/test'
import { command, signIn } from './helpers'

test('history keeps server summaries excluding annulments and restricts collaborator activity', async ({ page, browser }) => {
  await signIn(page)
  const created = await command(page, 'sales', { customer_kind: 'general', items: [{ product_id: 1, quantity: 1 }], payment: { method: 'cash', received_amount: '1000.00' } }, 'POST', 'history-ui-original')
  expect(created.status()).toBe(201); const sale = await created.json()
  const cancelled = await command(page, `sales/${sale.sale_id}/void`, { reason: 'Prueba sintética de exclusión en historial', refund_confirmed: true, items: sale.items.map((item: { sale_item_id: number }) => ({ sale_item_id: item.sale_item_id, returned_quantity: 0 })) }, 'POST', 'history-ui-void')
  expect(cancelled.status()).toBe(201)
  await page.goto('/sales-history')
  await page.getByLabel('Número de venta o recibo', { exact: true }).fill(`V-${String(sale.sale_id).padStart(5, '0')}`)
  await page.getByLabel('Estado', { exact: true }).selectOption('voided')
  const filtered = page.waitForResponse(response => response.url().includes('/reports/sales-ledger?') && new URL(response.url()).searchParams.has('q'))
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  const report = await (await filtered).json()
  expect(report.summary.total_count).toBe(1); expect(report.summary.total_amount).toBe('0.00'); expect(report.summary.units).toBe(0)
  await expect(page.getByText('Total vendido', { exact: true }).locator('..').locator('..')).toContainText('C$ 0.00')
  const row = page.getByRole('row').filter({ hasText: `V-${String(sale.sale_id).padStart(5, '0')}` })
  await expect(row.getByText('Anulada', { exact: true })).toBeVisible()
  await row.getByRole('button', { name: 'Ver', exact: true }).click()
  await expect(page.getByRole('dialog').getByText(/Prueba sintética de exclusión en historial/)).toBeVisible()
  const colleagueContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' }), colleague = await colleagueContext.newPage()
  try {
    await signIn(colleague, 'purchasing-cashier')
    await colleague.goto('/sales-history'); await expect(colleague.getByText('Esta pantalla está disponible únicamente para la dueña.', { exact: true })).toBeVisible()
    const own = await (await colleague.request.get('/api/v1/reports/sales-ledger?receipts=true&limit=100')).json()
    expect(own.items.every((row: { sale_id: number }) => row.sale_id !== sale.sale_id)).toBe(true)
    expect((await colleague.request.get('/api/v1/receipts/' + sale.sale_id)).status()).toBe(404)
  } finally { await colleagueContext.close() }
})
