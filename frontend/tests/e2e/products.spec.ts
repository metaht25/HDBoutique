import { expect, test } from '@playwright/test'
import { json, mockBoutique, product } from '../fixtures/boutique'
test('product modal calculates the price and sends only cost and audited initial quantity', async ({ page }) => {
  await mockBoutique(page); await page.route('**/api/v1/products', route => json(route, { ...product, product_id: 2 }, 201))
  await page.goto('/products'); await page.getByRole('button', { name: '+ Nuevo producto' }).click()
  const modal = page.getByRole('dialog', { name: 'Nuevo producto' })
  await modal.getByLabel('Nombre', { exact: true }).fill('Prenda creada')
  await modal.getByLabel('Categoría', { exact: true }).selectOption('1'); await modal.getByLabel('Talla', { exact: true }).selectOption('1')
  await modal.getByLabel('Costo (NIO)', { exact: true }).fill('100.10')
  await expect(modal.getByLabel('Precio de venta (+15 %)')).toHaveValue('C$ 115.12')
  await modal.getByLabel('Cantidad inicial').fill('5')
  const request = page.waitForRequest(req => req.url().endsWith('/api/v1/products') && req.method() === 'POST')
  await modal.getByRole('button', { name: 'Guardar producto' }).click()
  const body = (await request).postDataJSON(); expect(body.cost).toBe('100.10'); expect(body.initial_stock).toBe(5); expect(body).not.toHaveProperty('unit_price')
  await expect(modal).toHaveCount(0)
})
test('collaborator sees no costs, supplier columns or product editing', async ({ page }) => {
  await mockBoutique(page, 'Cashier'); await page.goto('/products')
  await expect(page.getByRole('cell', { name: product.name })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Costo', exact: true })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Proveedor', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '+ Nuevo producto' })).toHaveCount(0)
})
