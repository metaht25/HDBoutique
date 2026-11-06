import { expect, test } from '@playwright/test'
import { context, json, mockBoutique } from '../fixtures/boutique'

const purchase = { purchase_id: 1, purchase_date: '2026-11-05', supplier_id: 1, supplier_name: 'Proveedor de prueba', products: 'Prenda de prueba', units: 3, shipping_cost: '10.00', total: '310.00', status: 'registered', items: [{ purchase_item_id: 1, product_id: 1, quantity: 3, unit_cost: '100.00', subtotal: '300.00' }] }

test('purchases keep states and all fields readable across responsive widths', async ({ page }, info) => {
  await mockBoutique(page)
  await page.route('**/reports/purchase-ledger?*', route => json(route, { context, summary: { total_count: 2, month_amount: '620.00', active_suppliers: 1, invested_amount: '620.00' }, items: [purchase, { ...purchase, purchase_id: 2, status: 'received' }] }))
  await page.goto('/purchases')
  const table = page.getByRole('region', { name: 'Compras', exact: true })
  await expect(table.getByText('Pendiente', { exact: true })).toBeVisible()
  await expect(table.getByText('Recibida', { exact: true })).toBeVisible()
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await expect(table.getByRole('button', { name: 'Ver / recibir', exact: true })).toBeVisible()
    if (width === 1440 || width === 390) await page.screenshot({ path: info.outputPath(`purchases-${width}.png`), fullPage: true })
  }
})

test('new purchase retains quantities, read-only cost, total and original API body', async ({ page }, info) => {
  await mockBoutique(page)
  await page.route('**/api/v1/purchases', route => json(route, purchase, 201))
  await page.goto('/purchases'); await page.getByRole('button', { name: '+ Nueva compra' }).click()
  const modal = page.getByRole('dialog', { name: 'Nueva compra' })
  await expect(modal.getByRole('combobox', { name: 'Producto' })).toBeDisabled()
  await modal.getByRole('combobox', { name: 'Proveedor', exact: true }).fill('Proveedor')
  await modal.getByRole('option', { name: 'Proveedor de prueba', exact: true }).click()
  await modal.getByRole('combobox', { name: 'Producto', exact: true }).fill('Prenda')
  await modal.getByRole('option', { name: 'Prenda de prueba', exact: true }).click()
  await expect(modal.getByLabel('Costo de compra (NIO)')).toHaveAttribute('readonly', '')
  await modal.getByLabel('Cantidad', { exact: true }).fill('3')
  await modal.getByRole('button', { name: 'Agregar producto' }).click()
  await modal.getByLabel('Costo de envío (NIO)').fill('10.00')
  await expect(modal.getByText('C$ 310.00', { exact: true })).toBeVisible()
  await expect(modal.getByText('Se guardará como Pendiente', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('new-purchase.png'), fullPage: true })
  const sent = page.waitForRequest(req => req.url().endsWith('/api/v1/purchases') && req.method() === 'POST')
  await modal.getByRole('button', { name: 'Guardar compra pendiente' }).click()
  const request = await sent
  expect(request.postDataJSON()).toMatchObject({ supplier_id: 1, shipping_cost: '10.00', items: [{ product_id: 1, quantity: 3 }] })
  expect(request.postDataJSON()).not.toHaveProperty('total')
  expect(request.headers()['idempotency-key']).toBeTruthy()
  await expect(modal).toHaveCount(0)
})

test('receipt requires explicit confirmation and an uncertain retry uses the same key and body', async ({ page }) => {
  await mockBoutique(page)
  await page.route('**/reports/purchase-ledger?*', route => json(route, { context, summary: { total_count: 1 }, items: [purchase] }))
  await page.route('**/api/v1/purchases/1', route => json(route, purchase))
  const writes: { key: string | undefined; body: unknown }[] = []
  await page.route('**/api/v1/purchases/1/receive', async route => {
    writes.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() })
    if (writes.length === 1) return route.abort('failed')
    return json(route, { ...purchase, status: 'received' })
  })
  await page.goto('/purchases'); await page.getByRole('button', { name: 'Ver / recibir' }).click()
  const detail = page.getByRole('dialog', { name: 'Compra #1', exact: true })
  await detail.getByRole('button', { name: 'Marcar como recibida' }).click()
  const confirm = page.getByRole('dialog', { name: 'Confirmar recepción', exact: true })
  await expect(confirm.getByText(/todos los productos y cantidades/)).toBeVisible()
  expect(writes).toHaveLength(0)
  await confirm.getByRole('button', { name: 'Cancelar', exact: true }).click()
  expect(writes).toHaveLength(0)
  await detail.getByRole('button', { name: 'Marcar como recibida' }).click()
  await confirm.getByRole('button', { name: 'Confirmar recepción', exact: true }).click()
  await expect(confirm.getByRole('alert')).toBeVisible()
  await confirm.getByRole('button', { name: 'Confirmar recepción', exact: true }).click()
  await expect(confirm).toHaveCount(0)
  expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]); expect(writes[0]!.key).toBeTruthy()
})
