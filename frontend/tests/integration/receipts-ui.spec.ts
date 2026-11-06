import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { command, signIn } from './helpers'

test('own receipt preserves historical Delivery and mixed payment, PDF numbering and 80 mm printing', async ({ page }, info) => {
  await signIn(page, 'purchasing-cashier')
  const created = await command(page, 'sales', { customer_kind: 'delivery', customer: { first_names: 'Recibo', last_names: 'Sintético', kind: 'delivery', phone_number: '81234567', address: { department_id: 1, municipality_id: 1, address_line: 'Domicilio sintético del recibo' } }, delivery_cost: '25.00', items: [{ product_id: 2, quantity: 1 }], payment: { method: 'mixed', received_amount: '1000.00', transfer_amount: '20.00', transfer_confirmed: true } }, 'POST', 'receipts-ui-original')
  expect(created.status()).toBe(201); const sale = await created.json()
  const original = await (await page.request.get('/api/v1/receipts/' + sale.sale_id)).json()
  expect(original.receipt_number).toBe(String(sale.payment.payment_id))
  await page.goto('/receipts')
  await page.getByLabel('Número de venta o recibo', { exact: true }).fill(original.receipt_number)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await page.getByRole('row').filter({ has: page.getByText(original.receipt_number, { exact: true }) }).getByRole('button', { name: 'Ver', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Vista previa del recibo' }), ticket = preview.getByRole('article', { name: 'Ticket de 80 mm' })
  await expect(ticket).toContainText(`${original.receipt_number} · ${original.sale_number}`)
  await expect(ticket).toContainText('Recibo Sintético'); await expect(ticket).toContainText('Domicilio sintético del recibo')
  await expect(ticket).toContainText('Efectivo aplicado: C$ ' + sale.payment.cash_amount); await expect(ticket).toContainText('Transferencia: C$ 20.00')
  const downloaded = page.waitForEvent('download')
  await preview.getByRole('button', { name: 'Exportar PDF', exact: true }).click()
  const pdf = await downloaded, path = info.outputPath('receipt-80mm.pdf')
  expect(pdf.suggestedFilename()).toBe(original.receipt_number + '.pdf')
  await pdf.saveAs(path); const bytes = await readFile(path)
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-'); expect(bytes.toString('latin1')).toContain('226.7717')
  await page.emulateMedia({ media: 'print' })
  expect(await page.locator('#receipt-print').evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(302)
  await expect(page.locator('#receipt-print article')).toContainText('Domicilio sintético del recibo')
  await page.emulateMedia({ media: 'screen' })
  expect(await (await page.request.get('/api/v1/receipts/' + sale.sale_id)).json()).toEqual(original)
  const before = await page.request.get('/api/v1/products/2'), stock = (await before.json()).legacy_stock
  await preview.getByRole('button', { name: 'Cerrar', exact: true }).click()
  expect((await (await page.request.get('/api/v1/products/2')).json()).legacy_stock).toBe(stock)
})
