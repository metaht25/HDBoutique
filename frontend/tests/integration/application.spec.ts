import { expect, test } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { capture, command, customerFromSale, selectAddress, signIn } from './helpers'

test.describe.configure({ mode: 'serial' })
let productId = 0, generalId = 0, regularSale = 0, mixedSale = 0, supplierId = 0, supplierProductId = 0
test('owner creates a supplier, associates a zero-stock product and receives its first purchase', async ({ page }, info) => {
  test.setTimeout(120000)
  await signIn(page)
  expect((await command(page, 'boutique-profile', { name: 'H&D Boutique · Prueba', phone_number: null, address_line: 'Dirección sintética del entorno aislado' }, 'PUT')).status()).toBe(200)
  await expect(page.getByRole('button', { name: /Dueña/ })).toHaveCount(0)
  await page.goto('/purchases'); await page.getByRole('button', { name: '+ Nueva compra' }).click(); await page.getByRole('button', { name: '+ Registrar proveedor' }).click()
  const supplier = page.getByRole('dialog', { name: 'Nuevo proveedor' })
  await supplier.getByLabel('Empresa', { exact: true }).fill('Proveedor de prueba conectada')
  await supplier.getByLabel('Nombres del contacto').fill('Contacto'); await supplier.getByLabel('Apellidos del contacto').fill('Sintético')
  await supplier.getByLabel('Teléfono', { exact: true }).fill('81234567'); await expect(supplier.getByLabel('Teléfono', { exact: true })).toHaveValue('8123-4567')
  await supplier.getByLabel('Correo', { exact: true }).fill('proveedor@example.invalid')
  await expect(supplier.getByLabel('Departamento', { exact: true })).toHaveCount(0)
  await supplier.getByLabel('Dirección exacta (opcional)').fill('Dirección sintética proveedor')
  await capture(page, info, 'owner-supplier-modal')
  await page.setViewportSize({ width: 390, height: 844 }); await capture(page, info, 'owner-mobile-supplier-modal'); await page.setViewportSize({ width: 1440, height: 1000 })
  const savedSupplier = page.waitForResponse(res => res.url().endsWith('/api/v1/purchases/suppliers') && res.request().method() === 'POST')
  await supplier.getByRole('button', { name: 'Guardar proveedor' }).click(); const supplierResponse = await savedSupplier
  expect(supplierResponse.status()).toBe(201); supplierId = (await supplierResponse.json()).supplier_id
  await expect(supplier).toHaveCount(0)
  await page.getByRole('dialog', { name: 'Nueva compra' }).getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.goto('/products'); await page.getByRole('button', { name: '+ Nuevo producto' }).click()
  const product = page.getByRole('dialog', { name: 'Nuevo producto' })
  await product.getByLabel('Nombre', { exact: true }).fill('Prenda de prueba conectada')
  await product.getByLabel('Categoría', { exact: true }).selectOption('1'); await product.getByLabel('Talla', { exact: true }).selectOption('1')
  await product.getByLabel('Costo (NIO)', { exact: true }).fill('100.10')
  await product.getByLabel('Proveedor', { exact: true }).fill('Proveedor de prueba conectada')
  await product.getByRole('option', { name: 'Proveedor de prueba conectada', exact: true }).click()
  await expect(product.getByLabel('Cantidad inicial')).toHaveCount(0)
  await expect(product.getByLabel('Precio de venta (+15 %)')).toHaveValue('C$ 115.12'); await capture(page, info, 'owner-product-modal')
  const saved = page.waitForResponse(res => res.url().endsWith('/api/v1/products') && res.request().method() === 'POST')
  await product.getByRole('button', { name: 'Guardar producto' }).click(); const response = await saved
  expect(response.status()).toBe(201); const row = await response.json(); productId = row.product_id
  expect(row.unit_price).toBe('115.12'); expect(row.legacy_stock).toBe(0); await expect(product).toHaveCount(0)
  const movements = await page.request.get('/api/v1/inventory/movements?product_id=' + productId)
  expect((await movements.json()).find((row: { movement_type: string }) => row.movement_type === 'initial_stock').quantity).toBe(0)
  await page.goto('/purchases'); await page.getByRole('button', { name: '+ Nueva compra' }).click()
  const purchase = page.getByRole('dialog', { name: 'Nueva compra' })
  await purchase.getByLabel('Proveedor', { exact: true }).fill('Proveedor de prueba conectada')
  await purchase.getByRole('option', { name: 'Proveedor de prueba conectada', exact: true }).click()
  await purchase.getByLabel('Producto', { exact: true }).selectOption(String(productId))
  await expect(purchase.getByLabel('Costo de compra (NIO)')).toHaveAttribute('readonly', '')
  await purchase.getByLabel('Cantidad', { exact: true }).fill('8'); await purchase.getByRole('button', { name: 'Agregar producto' }).click()
  const created = page.waitForResponse(res => res.url().endsWith('/api/v1/purchases') && res.request().method() === 'POST')
  await purchase.getByRole('button', { name: 'Guardar compra pendiente' }).click(); const first = await (await created).json()
  expect(first.status).toBe('registered'); supplierProductId = first.items[0].supplier_product_id
  expect((await command(page, 'purchases/' + first.purchase_id + '/receive', {})).status()).toBe(200)
  expect((await (await page.request.get('/api/v1/products/' + productId)).json()).legacy_stock).toBe(8)
})

test('cash endpoints are retired and checkout needs no shift', async ({ page }) => {
  await signIn(page)
  expect((await page.request.get('/api/v1/cash/shifts')).status()).toBe(404)
  await page.goto('/new-sale')
  await expect(page.getByRole('button', { name: 'Gestionar turno' })).toHaveCount(0)
})

test('cash, transfer and mixed delivery sales produce real 80 mm receipts', async ({ page }, info) => {
  test.setTimeout(120000)
  await signIn(page, 'purchasing-cashier')
  for (const method of ['cash', 'transfer', 'mixed']) {
    await page.goto('/new-sale')
    await page.getByLabel('Método de pago').selectOption(method)
    if (method !== 'cash') await customerFromSale(page, method === 'mixed', info)
    if (method === 'mixed') {
      await expect(page.getByText(/8000-0000 · Managua, Managua · Domicilio sintético/)).toBeVisible()
      await page.getByLabel('Costo del delivery (NIO)').fill('25.00')
      await page.getByLabel('Notas (opcional)').fill('Texto sintético <etiqueta> & caracteres especiales. Dirección y observaciones largas deben ajustarse al ancho del ticket sin perder información.')
    }
    await page.getByLabel('Buscar producto', { exact: true }).fill('Prenda de prueba conectada')
    await page.getByRole('button', { name: 'Buscar productos' }).click()
    await page.getByRole('button', { name: '+ Agregar', exact: true }).click()
    if (method === 'cash') await page.getByLabel('Efectivo recibido (NIO)').fill('120.00')
    else {
      if (method === 'mixed') { await page.getByLabel('Monto transferido (NIO)').fill('50.00'); await page.getByLabel('Efectivo recibido (NIO)').fill('100.00') }
      else await page.getByLabel('Monto exacto transferido (NIO)').fill('115.12')
      if (method === 'transfer') await page.getByLabel('Referencia de transferencia').fill('SYNTHETIC-' + method)
      await page.getByLabel('Confirmo que la transferencia fue recibida').check()
    }
    await capture(page, info, 'collaborator-checkout-' + method)
    const response = page.waitForResponse(res => res.url().endsWith('/api/v1/sales') && res.request().method() === 'POST')
    await page.getByRole('button', { name: 'Finalizar venta' }).click()
    const saved = await response; expect(saved.status()).toBe(201); const sale = await saved.json()
    if (method === 'cash') { generalId = sale.customer_id; expect(sale.payment.change_amount).toBe('4.88') }
    if (method === 'transfer') { regularSale = sale.sale_id; expect(sale.total).toBe('115.12') }
    if (method === 'mixed') { mixedSale = sale.sale_id; expect(sale.total).toBe('140.12'); expect(sale.payment.cash_amount).toBe('90.12'); expect(sale.payment.transfer_amount).toBe('50.00'); expect(sale.payment.change_amount).toBe('9.88') }
    await expect(page.getByRole('dialog', { name: '¡Venta completada!' })).toBeVisible()
    await capture(page, info, 'sale-complete-' + method)
    await page.getByRole('button', { name: 'Ver recibo / imprimir' }).click()
    await expect(page.getByRole('dialog', { name: 'Vista previa del recibo' })).toBeVisible()
    await expect(page.getByRole('article', { name: 'Ticket de 80 mm' })).toContainText('H&D Boutique')
    await capture(page, info, 'receipt-' + method)
    if (method === 'mixed') {
      await page.setViewportSize({ width: 390, height: 844 }); await capture(page, info, 'receipt-mobile-mixed'); await page.setViewportSize({ width: 1440, height: 1000 })
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Exportar PDF' }).click()
      const pdf = await download, path = info.outputPath('ticket-mixed-80mm.pdf')
      await pdf.saveAs(path); const bytes = await readFile(path)
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-'); expect(bytes.toString('latin1')).toContain('226.7717')
      await page.emulateMedia({ media: 'print' }); await page.screenshot({ path: info.outputPath('receipt-print-80mm.png'), fullPage: true })
      await page.pdf({ path: info.outputPath('ticket-browser-print-80mm.pdf'), preferCSSPageSize: true, printBackground: true })
      await page.emulateMedia({ media: 'screen' })
    }
  }
  const stock = await (await page.request.get('/api/v1/products/' + productId)).json(); expect(stock.legacy_stock).toBe(5)
  await page.goto('/customers'); await expect(page.getByText('Prueba Regular', { exact: true }).first()).toBeVisible(); await expect(page.getByText('Prueba Delivery', { exact: true }).first()).toBeVisible()
  const products = await (await page.request.get('/api/v1/reports/product-catalog')).json()
  expect(products.summary).not.toHaveProperty('inventory_value')
  for (const row of products.items) { expect(row).not.toHaveProperty('cost'); expect(row).not.toHaveProperty('supplier_name'); expect(row).not.toHaveProperty('supplier_id') }
  expect((await page.request.get('/api/v1/suppliers')).status()).toBe(403)
})

test('owner registers a pending purchase, receives once and supervises a mixed void', async ({ page }, info) => {
  await signIn(page); await page.goto('/purchases'); await page.getByRole('button', { name: '+ Nueva compra' }).click()
  const modal = page.getByRole('dialog', { name: 'Nueva compra' })
  await modal.getByLabel('Proveedor', { exact: true }).fill('Proveedor de prueba conectada'); await modal.getByRole('option', { name: 'Proveedor de prueba conectada', exact: true }).click()
  await modal.getByLabel('Producto', { exact: true }).selectOption(String(productId)); await expect(modal.getByLabel('Costo de compra (NIO)')).toHaveValue('C$ 100.10'); await modal.getByLabel('Cantidad', { exact: true }).fill('3'); await modal.getByRole('button', { name: 'Agregar producto' }).click()
  await modal.getByLabel('Costo de envío (NIO)').fill('10.00'); await modal.getByLabel('Descripción (opcional)').fill('Recepción sintética completa')
  await capture(page, info, 'owner-purchase-modal')
  const saved = page.waitForResponse(res => res.url().endsWith('/api/v1/purchases') && res.request().method() === 'POST')
  await modal.getByRole('button', { name: 'Guardar compra pendiente' }).click(); const purchase = await (await saved).json()
  expect(purchase.status).toBe('registered'); expect(purchase.total).toBe('310.30')
  supplierProductId = purchase.items[0].supplier_product_id
  await expect(modal).toHaveCount(0)
  await page.getByRole('row').filter({ hasText: '#' + purchase.purchase_id }).getByRole('button', { name: 'Ver / recibir' }).click()
  const detail = page.getByRole('dialog', { name: 'Compra #' + purchase.purchase_id })
  await expect(detail.getByLabel('Responsable de recepción')).toHaveCount(0)
  await detail.getByRole('button', { name: 'Marcar como recibida' }).click(); await expect(detail.getByText('Recibida', { exact: true })).toBeVisible()
  const again = await command(page, 'purchases/' + purchase.purchase_id + '/receive', { employee_id: 1 }); expect(again.status()).toBe(200)
  expect((await (await page.request.get('/api/v1/products/' + productId)).json()).legacy_stock).toBe(8)
  await page.goto('/sales-history'); await page.getByLabel('Número de venta o recibo').fill(String(mixedSale)); await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await page.getByRole('row').filter({ hasText: 'Prueba Delivery' }).getByRole('button', { name: 'Ver', exact: true }).click()
  await page.getByRole('button', { name: 'Anular venta', exact: true }).click()
  await page.getByLabel('Motivo de anulación').fill('Corrección sintética supervisada')
  await page.getByLabel(/Cantidad devuelta de producto/).fill('0')
  await page.getByLabel('Referencia del reintegro por transferencia').fill('SYNTHETIC-REFUND')
  await page.getByLabel('Confirmo el reintegro completo al cliente y las cantidades devueltas').check()
  await page.getByRole('button', { name: 'Confirmar anulación total' }).click()
  await expect(page.getByRole('dialog').getByText('Anulada', { exact: true })).toBeVisible()
  expect((await (await page.request.get('/api/v1/products/' + productId)).json()).legacy_stock).toBe(8)
  const ledger = await (await page.request.get('/api/v1/reports/sales-ledger')).json()
  expect(ledger.summary.total_amount).toBe('230.24')
  expect(ledger.summary.units).toBe(2)
  expect(ledger.items.map((row: { units: number }) => row.units)).toEqual([1, 1, 1])
  const sale = await (await page.request.get('/api/v1/sales/' + mixedSale)).json()
  expect(sale.annulment.cash_amount).toBe('90.12'); expect(sale.annulment.transfer_amount).toBe('50.00')
  await capture(page, info, 'owner-void-detail')
  const pdf = await page.request.get('/api/v1/receipts/' + mixedSale + '/pdf')
  expect(pdf.status()).toBe(200); expect(pdf.headers()['content-type']).toBe('application/pdf')
  await writeFile(info.outputPath('ticket-void-mixed-80mm.pdf'), await pdf.body())
})

test('personal receipts are protected and general identity is reused', async ({ page }) => {
  await signIn(page)
  const body = { customer_kind: 'general', items: [{ product_id: productId, quantity: 1 }], payment: { method: 'cash', received_amount: '120.00' } }
  const saved = await command(page, 'sales', body, 'POST', 'browser-owner-general')
  expect(saved.status()).toBe(201); const sale = await saved.json(); expect(sale.customer_id).toBe(generalId)
  const repeat = await command(page, 'sales', body, 'POST', 'browser-owner-general'); expect(await repeat.json()).toEqual(sale)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await signIn(page, 'purchasing-cashier')
  expect((await page.request.get('/api/v1/receipts/' + sale.sale_id)).status()).toBe(404)
  expect((await page.request.get('/api/v1/receipts/' + sale.sale_id + '/pdf')).status()).toBe(404)
  expect((await page.request.get('/api/v1/receipts/' + regularSale)).status()).toBe(200)
  const own = await (await page.request.get('/api/v1/reports/sales-ledger?receipts=true')).json()
  expect(own.items.every((row: { sale_id: number }) => row.sale_id !== sale.sale_id)).toBe(true)
  for (const path of ['suppliers', 'supplier-products', 'supplier-offerings', 'purchases', 'employees', 'users', 'boutique-profile', 'reports/sales', 'reports/supplier-directory', 'reports/employee-directory']) {
    expect((await page.request.get('/api/v1/' + path)).status()).toBe(403)
  }
})

test('inactive products and suppliers block new operations until reactivated', async ({ page }) => {
  await signIn(page)
  const sale = { customer_kind: 'general', items: [{ product_id: productId, quantity: 1 }], payment: { method: 'cash', received_amount: '120.00' } }
  const regular = await (await page.request.get('/api/v1/sales/' + regularSale)).json()
  const before = await (await page.request.get('/api/v1/products/' + productId)).json()
  for (const [path, name, id] of [['products', 'Prenda de prueba conectada', productId], ['suppliers', 'Proveedor de prueba conectada', supplierId]] as const) {
    await page.goto('/' + path)
    const row = page.getByRole('row').filter({ hasText: name })
    await row.getByRole('button', { name: 'Desactivar', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: path === 'products' ? 'Confirmar' : 'Confirmar desactivación', exact: true }).click()
    await expect(row.getByRole('button', { name: 'Activar', exact: true })).toBeVisible()
    expect((await (await page.request.get('/api/v1/' + path + '/' + id)).json()).is_active).toBe(false)
    const payload = path === 'suppliers' ? { supplier_id: supplierId, purchase_date: regular.sale_date, items: [{ supplier_product_id: supplierProductId, quantity: 1 }] } : sale
    const blocked = await command(page, path === 'suppliers' ? 'purchases' : 'sales', payload, 'POST', 'inactive-' + path)
    expect(blocked.status()).toBe(422)
    await row.getByRole('button', { name: 'Activar', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: path === 'products' ? 'Confirmar' : 'Confirmar activación', exact: true }).click()
    await expect(row.getByRole('button', { name: 'Desactivar', exact: true })).toBeVisible()
    expect((await (await page.request.get('/api/v1/' + path + '/' + id)).json()).is_active).toBe(true)
  }
  expect((await (await page.request.get('/api/v1/products/' + productId)).json()).legacy_stock).toBe(before.legacy_stock)
})

for (const role of ['owner', 'collaborator']) {
  test(role + ' desktop and mobile visual inventory of every primary screen', async ({ page }, info) => {
    test.setTimeout(120000)
    await signIn(page, role === 'owner' ? 'purchasing-administrator' : 'purchasing-cashier')
    const paths = role === 'owner' ? ['dashboard', 'new-sale', 'sales', 'sales-history', 'receipts', 'products', 'purchases', 'suppliers', 'customers', 'employees'] : ['dashboard', 'new-sale', 'products', 'customers', 'receipts']
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
      for (const path of paths) {
        await page.goto('/' + path); await capture(page, info, role + '-' + width + '-' + path)
        if (path === 'dashboard') await expect(page.getByText('Anulada', { exact: true })).toBeVisible()
        if (width === 390 && path === 'dashboard') {
          await page.getByRole('button', { name: 'Menú', exact: true }).click()
          await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()
          await capture(page, info, role + '-mobile-menu')
          await page.getByRole('button', { name: 'Menú', exact: true }).click()
        }
        if (width === 390 && role === 'owner') {
          const forms: Record<string, string> = { products: '+ Nuevo producto', employees: '+ Nuevo empleado', purchases: '+ Nueva compra' }
          const form = forms[path]
          if (form) {
            await page.getByRole('button', { name: form, exact: true }).click()
            const dialog = page.getByRole('dialog')
            await expect(dialog).toBeVisible()
            await capture(page, info, 'owner-mobile-modal-' + path)
            const submit = dialog.locator('button').last()
            await submit.scrollIntoViewIfNeeded(); await expect(submit).toBeInViewport()
            await capture(page, info, 'owner-mobile-modal-footer-' + path)
            await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
          }
        }
      }
    }
  })
}

test('existing regular client requests delivery and later buys in person with the same identity', async ({ page }, info) => {
  test.setTimeout(120000)
  await signIn(page)
  const original = await (await page.request.get('/api/v1/sales/' + regularSale)).json()
  await page.goto('/new-sale')
  await page.getByLabel('Tipo de cliente', { exact: true }).selectOption('delivery')
  await page.getByLabel('Seleccionar cliente', { exact: true }).fill('Prueba Regular')
  await page.getByRole('option', { name: 'Prueba Regular', exact: true }).click()
  await page.getByRole('button', { name: 'Completar datos de entrega' }).click()
  const details = page.getByRole('dialog', { name: 'Editar cliente' })
  await expect(details.getByLabel('Nombres', { exact: true })).toHaveAttribute('readonly', '')
  await details.getByLabel('Teléfono', { exact: true }).fill('81234567')
  await selectAddress(page)
  await capture(page, info, 'existing-client-delivery-details')
  await details.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await page.getByLabel('Costo del delivery (NIO)').fill('5.00')
  await page.getByLabel('Buscar producto', { exact: true }).fill('Prenda de prueba conectada')
  await page.getByRole('button', { name: 'Buscar productos' }).click()
  await page.getByRole('button', { name: '+ Agregar', exact: true }).click()
  await page.getByLabel('Efectivo recibido (NIO)').fill('200.00')
  const deliveryResponse = page.waitForResponse(res => res.url().endsWith('/api/v1/sales') && res.request().method() === 'POST')
  await page.getByRole('button', { name: 'Finalizar venta' }).click()
  const saved = await deliveryResponse; expect(saved.status()).toBe(201)
  const delivery = await saved.json(); expect(delivery.customer_id).toBe(original.customer_id)
  expect(delivery.customer_phone).toBe('81234567')
  await page.goto('/new-sale'); await page.getByLabel('Tipo de cliente', { exact: true }).selectOption('regular')
  await page.getByLabel('Seleccionar cliente', { exact: true }).fill('Prueba Regular')
  await page.getByRole('option', { name: 'Prueba Regular', exact: true }).click()
  await expect(page.getByLabel('Teléfono', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Costo del delivery (NIO)')).toHaveCount(0)
  await page.getByLabel('Buscar producto', { exact: true }).fill('Prenda de prueba conectada')
  await page.getByRole('button', { name: 'Buscar productos' }).click()
  await page.getByRole('button', { name: '+ Agregar', exact: true }).click()
  await page.getByLabel('Efectivo recibido (NIO)').fill('200.00')
  const regularResponse = page.waitForResponse(res => res.url().endsWith('/api/v1/sales') && res.request().method() === 'POST')
  await page.getByRole('button', { name: 'Finalizar venta' }).click()
  const regular = await (await regularResponse).json()
  expect(regular.customer_id).toBe(original.customer_id); expect(regular.customer_phone).toBeNull(); expect(regular.customer_address).toBeNull()
  expect(await (await page.request.get('/api/v1/sales/' + regularSale)).json()).toEqual(original)
  expect((await (await page.request.get('/api/v1/customers/' + original.customer_id)).json()).phone_number).toBe('81234567')
})
