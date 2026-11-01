import { expect, test } from '@playwright/test'
import { json, mockBoutique, sale } from '../fixtures/boutique'
test('cart respects stock and recovers an uncertain sale with the identical request', async ({ page }) => {
  await mockBoutique(page, 'Cashier')
  const attempts: { key: string | undefined; body: unknown }[] = []
  await page.route('**/api/v1/sales', async route => {
    attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() })
    if (attempts.length === 1) await route.abort('failed'); else await json(route, sale, 201)
  })
  await page.goto('/new-sale'); await page.getByRole('button', { name: '+ Agregar', exact: true }).click()
  await page.getByRole('button', { name: 'Aumentar Prenda de prueba' }).click()
  await expect(page.getByRole('button', { name: 'Aumentar Prenda de prueba' })).toBeDisabled()
  await page.getByRole('button', { name: 'Disminuir Prenda de prueba' }).click()
  await page.getByLabel('Efectivo recibido (NIO)').fill('200.00')
  await page.getByRole('button', { name: 'Finalizar venta' }).click()
  await expect(page.getByRole('button', { name: 'Reintentar misma venta' })).toBeVisible()
  await page.reload(); await page.getByRole('button', { name: 'Reintentar misma venta' }).click()
  await expect(page.getByRole('dialog', { name: '¡Venta completada!' })).toBeVisible()
  expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0]); expect(attempts[0]?.key).toBeTruthy()
})
