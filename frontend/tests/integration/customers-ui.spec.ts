import { expect, test } from '@playwright/test'
import { command, customerFromSale, selectAddress, signIn } from './helpers'

test('customer UI preserves general identity, reuses regular clients and updates Delivery on the same record', async ({ page }) => {
  test.setTimeout(90000)
  await signIn(page, 'purchasing-cashier')
  const body = { customer_kind: 'general', items: [{ product_id: 1, quantity: 1 }], payment: { method: 'cash', received_amount: '500.00' } }
  const general = await command(page, 'sales', body, 'POST', 'customers-ui-general-one')
  expect(general.status()).toBe(201)
  const generalAgain = await command(page, 'sales', body, 'POST', 'customers-ui-general-two')
  expect(generalAgain.status()).toBe(201)
  expect((await generalAgain.json()).customer_id).toBe((await general.json()).customer_id)
  const generalId = (await general.json()).customer_id
  const identities = (await (await page.request.get('/api/v1/reports/customer-directory?limit=100')).json()).items
  expect(identities.every((row: { customer_id: number }) => row.customer_id !== generalId)).toBe(true)
  let originalId = 0
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto('/new-sale')
    if (attempt === 0) await customerFromSale(page)
    else {
      await page.getByLabel('Tipo de cliente', { exact: true }).selectOption('regular')
      await page.getByLabel('Seleccionar cliente', { exact: true }).fill('Prueba Regular')
      await page.getByRole('option', { name: 'Prueba Regular', exact: true }).click()
    }
    await page.getByRole('button', { name: '+ Agregar', exact: true }).first().click()
    await page.getByLabel('Efectivo recibido (NIO)').fill('500.00')
    const saved = page.waitForResponse(response => response.url().endsWith('/api/v1/sales') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Finalizar venta' }).click()
    const response = await saved; expect(response.status()).toBe(201)
    const sale = await response.json()
    if (attempt === 0) originalId = sale.customer_id
    else expect(sale.customer_id).toBe(originalId)
    await page.getByRole('dialog', { name: '¡Venta completada!' }).getByRole('button', { name: 'Cerrar', exact: true }).click()
  }
  await page.goto('/new-sale'); await page.getByLabel('Tipo de cliente', { exact: true }).selectOption('delivery')
  await page.getByLabel('Seleccionar cliente', { exact: true }).fill('Prueba Regular')
  await page.getByRole('option', { name: 'Prueba Regular', exact: true }).click()
  await page.getByRole('button', { name: 'Completar datos de entrega' }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar cliente' })
  await expect(dialog.getByLabel('Nombres', { exact: true })).toHaveAttribute('readonly', '')
  await dialog.getByLabel('Teléfono', { exact: true }).fill('81234567'); await selectAddress(page)
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  const beforeSale = await (await page.request.get('/api/v1/customers/' + originalId)).json()
  expect(beforeSale.phone_number).toBeNull()
  await page.getByRole('button', { name: '+ Agregar', exact: true }).first().click()
  await page.getByLabel('Efectivo recibido (NIO)').fill('500.00')
  const saved = page.waitForResponse(response => response.url().endsWith('/api/v1/sales') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Finalizar venta' }).click()
  const response = await saved; expect(response.status()).toBe(201); expect((await response.json()).customer_id).toBe(originalId)
  const updated = await (await page.request.get('/api/v1/customers/' + originalId)).json()
  expect(updated.phone_number).toBe('81234567')
  const directory = await (await page.request.get('/api/v1/reports/customer-directory?limit=100')).json()
  expect(directory.items.filter((row: { first_names: string; last_names: string }) => row.first_names === 'Prueba' && row.last_names === 'Regular')).toHaveLength(1)
  await page.goto('/customers')
  const row = page.getByRole('row').filter({ hasText: 'Prueba Regular' })
  await expect(row.getByText('81234567', { exact: true })).toBeVisible()
  await row.getByRole('button', { name: 'Ver detalle' }).click()
  await expect(page.getByRole('dialog').getByText('Domicilio sintético para prueba aislada', { exact: true })).toBeVisible()
})
