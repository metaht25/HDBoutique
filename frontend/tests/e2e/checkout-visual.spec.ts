import { expect, test } from '@playwright/test'
import { context, json, mockBoutique, product, sale } from '../fixtures/boutique'

test('owner: cash, mixed payment and delivery keep their amounts and sale payload', async ({ page }, testInfo) => {
  await mockBoutique(page)
  const requests: unknown[] = []
  await page.route('**/api/v1/sales', async route => {
    requests.push(route.request().postDataJSON())
    await json(route, { ...sale, total: '140.00' }, 201)
  })
  await page.goto('/new-sale')
  await expect(page.getByText('Tu carrito está vacío')).toBeVisible()
  await page.getByRole('button', { name: '+ Agregar', exact: true }).click()
  const cart = page.getByRole('list', { name: 'Carrito', exact: true })
  await expect(cart).toContainText('C$ 115.00')
  await page.getByLabel('Efectivo recibido (NIO)').fill('200.00')
  await expect(page.getByText('Cambio:', { exact: false }).filter({ hasText: '85.00' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).not.toBeInViewport()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('owner-cash.png'), fullPage: true })

  await page.getByLabel('Método de pago').selectOption('mixed')
  await expect(page.getByLabel('Efectivo recibido (NIO)')).toHaveValue('')
  await page.getByLabel('Monto transferido (NIO)').fill('50.00')
  await expect(page.getByLabel('Efectivo a aplicar (NIO)')).toHaveValue('65.00')
  await page.getByLabel('Efectivo recibido (NIO)').fill('100.00')
  await page.getByLabel('Tipo de cliente', { exact: true }).selectOption('delivery')
  await page.getByRole('combobox', { name: 'Seleccionar cliente' }).click()
  await page.getByRole('option', { name: 'Cliente Prueba', exact: true }).click()
  const delivery = page.getByRole('region', { name: 'Datos de entrega' })
  await expect(delivery).toContainText('80000000')
  await expect(delivery).toContainText('Domicilio de prueba')
  await page.getByLabel('Costo del delivery (NIO)').fill('25.00')
  await expect(page.getByLabel('Efectivo a aplicar (NIO)')).toHaveValue('90.00')
  await expect(page.getByText('Cambio:', { exact: false }).filter({ hasText: '10.00' })).toBeVisible()
  await expect(page.getByLabel('Resumen de venta')).toContainText('140.00')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('owner-delivery-mixed.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)

  await page.getByRole('button', { name: 'Completar datos de entrega' }).click()
  const modal = page.getByRole('dialog', { name: 'Editar cliente' })
  await expect(modal.getByLabel('Teléfono', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('delivery-details.png') })
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()

  await page.getByRole('button', { name: 'Finalizar venta' }).click()
  await expect(page.getByRole('alert')).toContainText('Confirma manualmente')
  expect(requests).toHaveLength(0)
  await page.getByLabel('Confirmo que la transferencia fue recibida').check()
  await page.getByRole('button', { name: 'Finalizar venta' }).click()
  await expect(page.getByRole('dialog', { name: '¡Venta completada!' })).toBeVisible()
  expect(requests).toEqual([{
    customer_kind: 'delivery', customer_id: 1, delivery_cost: '25.00', notes: null,
    items: [{ product_id: 1, quantity: 1 }],
    payment: { method: 'mixed', received_amount: '100.00', reference: null, transfer_confirmed: true, transfer_amount: '50.00' },
  }])
})

test('cashier: transfer still requires the exact amount and manual confirmation', async ({ page }, testInfo) => {
  await mockBoutique(page, 'Cashier')
  const requests: unknown[] = []
  await page.route('**/api/v1/sales', async route => {
    requests.push(route.request().postDataJSON())
    await json(route, sale, 201)
  })
  await page.goto('/new-sale')
  await page.getByRole('button', { name: '+ Agregar', exact: true }).click()
  await page.getByLabel('Método de pago').selectOption('transfer')
  await expect(page.getByLabel('Efectivo recibido (NIO)')).toHaveCount(0)
  await page.getByLabel('Monto exacto transferido (NIO)').fill('114.00')
  await page.getByLabel('Confirmo que la transferencia fue recibida').check()
  await page.getByRole('button', { name: 'Finalizar venta' }).click()
  await expect(page.getByRole('alert')).toContainText('Deben cubrir el total completo')
  expect(requests).toHaveLength(0)
  await page.getByLabel('Monto exacto transferido (NIO)').fill('115.00')
  await page.getByRole('button', { name: 'Aumentar Prenda de prueba' }).click()
  await expect(page.getByLabel('Resumen de venta')).toContainText('230.00')
  await page.getByRole('button', { name: 'Disminuir Prenda de prueba' }).click()
  await expect(page.getByLabel('Referencia de transferencia (opcional)')).not.toHaveAttribute('required')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('cashier-transfer.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.getByRole('button', { name: 'Finalizar venta' }).click()
  await expect(page.getByRole('dialog', { name: '¡Venta completada!' })).toBeVisible()
  expect(requests).toEqual([{
    customer_kind: 'general', delivery_cost: '0.00', notes: null, items: [{ product_id: 1, quantity: 1 }],
    payment: { method: 'transfer', received_amount: '115.00', reference: null, transfer_confirmed: true },
  }])
})

test('catalog search keeps empty and error states readable without horizontal overflow', async ({ page }, testInfo) => {
  await mockBoutique(page, 'Cashier')
  await page.route('**/reports/product-catalog?*', route => {
    const params = new URL(route.request().url()).searchParams
    expect(params.get('status')).toBe('sellable')
    expect(params.get('limit')).toBe('20')
    if (params.get('q') === 'error') return json(route, { error: { code: 'database_unavailable', message: 'Catálogo no disponible' } }, 503)
    const items = params.get('q') ? [] : ['Blusa de lino', 'Vestido midi', 'Camisa de algodón', 'Pantalón de vestir'].map((name, index) => ({ ...product, name, product_id: index + 1 }))
    return json(route, { context, items, summary: { total_count: items.length }, offset: 0, limit: 20 })
  })
  await page.goto('/new-sale')
  await expect(page.getByRole('button', { name: '+ Agregar', exact: true })).toHaveCount(4)
  await page.screenshot({ path: testInfo.outputPath('cashier-catalog.png'), fullPage: true })
  const viewport = page.viewportSize()!
  for (const width of [1024, 768, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(viewport)
  await page.getByLabel('Buscar producto', { exact: true }).fill('sin coincidencias')
  await page.getByRole('button', { name: 'Buscar productos', exact: true }).click()
  await expect(page.getByText('Todavía no hay registros para estos filtros.')).toBeVisible()
  await page.getByLabel('Buscar producto', { exact: true }).fill('error')
  await page.getByRole('button', { name: 'Buscar productos', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Catálogo no disponible')
})
