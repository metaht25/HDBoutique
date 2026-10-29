import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { reportingResponse } from '../fixtures/reporting'
import { purchase, sale, shift, supplierRows } from '../fixtures/transactions'

async function backend(page: Page, settings: { lostResponse?: boolean; role?: string } = {}) {
  const writes: { path: string; key: string | undefined; body: unknown }[] = [], requested: string[] = []
  let sold = false, bought = false, received = false, suppliers = supplierRows()
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    requested.push(path)
    if (path === '/api/v1/auth/me') return route.fulfill({ json: { user_id: 1, username: 'synthetic', role: settings.role ?? 'Manager', employee_id: 102, is_active: true } })
    if (path === '/api/v1/auth/csrf') return route.fulfill({ json: { csrf_token: 'csrf-test' } })
    if (path === '/api/v1/cash/shifts') return route.fulfill({ json: [shift] })
    const report = reportingResponse(url, settings.role !== 'Cashier')
    if (report) return route.fulfill({ json: report })
    if (path === '/api/v1/products') return route.fulfill({ json: [{ product_id: 109, category_id: 1, size_id: 1, name: 'Camisa', unit_price: '199.50', legacy_stock: 3, legacy_stock_quantity: 12 }] })
    if (path === '/api/v1/customers') return route.fulfill({ json: [{ customer_id: 108, first_names: 'Cliente', last_names: 'Sintético', phone_number: '00000000', address_id: 103, customer_type_id: 1 }] })
    if (path === '/api/v1/addresses') return route.fulfill({ json: [{ address_id: 103, department_id: 1, address_line: null }] })
    if (path === '/api/v1/supplier-products') return route.fulfill({ json: [{ supplier_product_id: 201, product_id: 109, purchase_price: '120.50' }] })
    if (path === '/api/v1/supplier-offerings') return route.fulfill({ json: [{ offering_id: 1, supplier_id: 106, supplier_product_id: 201 }] })
    if (req.method() !== 'GET') {
      writes.push({ path, key: req.headers()['idempotency-key'], body: req.postDataJSON() })
      expect(req.headers()['x-csrf-token']).toBe('csrf-test')
      if (path === '/api/v1/sales') { const first = !sold; sold = true; if (settings.lostResponse && first) return route.abort('failed'); return route.fulfill({ status: 201, json: sale }) }
      if (path === '/api/v1/purchases') { bought = true; return route.fulfill({ status: 201, json: purchase }) }
      if (path.endsWith('/receive')) { received = true; return route.fulfill({ json: { ...purchase, status: 'received' } }) }
      if (path.startsWith('/api/v1/suppliers')) {
        const body = req.postDataJSON() as typeof suppliers[number]
        if (req.method() === 'POST') { suppliers.push({ ...body, supplier_id: 200 }); return route.fulfill({ status: 201, json: suppliers.at(-1) }) }
        const id = Number(path.split('/').at(-1)); suppliers = suppliers.map(row => row.supplier_id === id ? { ...row, ...body } : row)
        return route.fulfill({ json: suppliers.find(row => row.supplier_id === id) })
      }
    }
    if (path === '/api/v1/sales') return route.fulfill({ json: sold ? [sale] : [] })
    if (path === '/api/v1/purchases') return route.fulfill({ json: bought ? [{ ...purchase, status: received ? 'received' : 'registered' }] : [] })
    if (path === '/api/v1/suppliers') return route.fulfill({ json: suppliers })
    return route.fulfill({ status: 404, json: {} })
  })
  return { writes, requested }
}

test('lost sale responses recover with the identical payload and key after reload', async ({ page }) => {
  const api = await backend(page, { lostResponse: true })
  await page.goto('/sales')
  await page.getByRole('combobox', { name: 'Cliente', exact: true }).selectOption('108')
  await page.getByRole('combobox', { name: 'Producto', exact: true }).selectOption('109')
  await page.getByRole('button', { name: 'Agregar línea' }).click()
  await page.getByRole('textbox', { name: 'Efectivo recibido (NIO)' }).fill('200.00')
  await page.getByRole('button', { name: 'Confirmar venta' }).click()
  await expect(page.getByRole('button', { name: 'Reintentar misma solicitud' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Cliente', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Reintentar misma solicitud' }).click()
  await expect(page.getByText(/Venta #1 registrada correctamente/)).toBeVisible()
  expect(api.writes).toHaveLength(2)
  expect(api.writes[0]?.key).toBeTruthy()
  expect(api.writes[0]).toEqual(api.writes[1])
  expect(api.writes[0]?.body).toEqual({ customer_id: 108, sale_date: '2026-10-28', payment: { shift_id: 1, method: 'cash', received_amount: '200.00' }, items: [{ product_id: 109, quantity: 1 }] })
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0)
  expect(api.requested.every(path => path.startsWith('/api/v1/'))).toBe(true)
})

test('purchase register and receipt are separate and preserve historical amounts', async ({ page }) => {
  const api = await backend(page)
  await page.goto('/purchases')
  await page.getByRole('combobox', { name: 'Proveedor', exact: true }).selectOption('106')
  await page.getByRole('combobox', { name: 'Producto ofrecido por el proveedor' }).selectOption('201')
  await page.getByRole('button', { name: 'Agregar línea' }).click()
  await page.getByRole('textbox', { name: 'Costo de envío (NIO)' }).fill('50.00')
  await page.getByRole('button', { name: 'Registrar compra' }).dblclick()
  await expect(page.getByText(/Compra #1 registrada correctamente. Total: C\$170.50/)).toBeVisible()
  expect(api.writes).toHaveLength(1)
  await page.getByRole('button', { name: 'Confirmar recepción completa' }).dblclick()
  await expect(page.getByText('Compra #1 recibida correctamente.')).toBeVisible()
  expect(api.writes).toHaveLength(2)
  await page.reload()
  await expect(page.getByRole('cell', { name: 'Recibida', exact: true })).toBeVisible()
})

test('Cashier can use sales but cannot load purchasing or suppliers', async ({ page }) => {
  const api = await backend(page, { role: 'Cashier' })
  await page.goto('/sales')
  await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeVisible()
  await page.goto('/purchases')
  await expect(page.getByRole('alert')).toHaveText('No tienes permiso para consultar compras.')
  await page.goto('/suppliers')
  await expect(page.getByRole('alert')).toHaveText('No tienes permiso para consultar proveedores.')
  expect(api.requested.some(path => path.includes('supplier') || path.includes('purchases'))).toBe(false)
})

test('suppliers create and edit through one metadata request with textual phone', async ({ page }) => {
  const api = await backend(page)
  await page.goto('/suppliers')
  await page.getByRole('textbox', { name: 'Empresa', exact: true }).fill('Nueva empresa')
  await page.getByRole('textbox', { name: 'Nombres del contacto' }).fill('Contacto')
  await page.getByRole('textbox', { name: 'Apellidos del contacto' }).fill('Prueba')
  await page.getByRole('textbox', { name: 'Teléfono', exact: true }).fill('0012345678')
  await page.getByRole('combobox', { name: 'Dirección existente' }).selectOption('103')
  await page.getByRole('button', { name: 'Guardar proveedor' }).dblclick()
  await expect(page.getByText('Proveedor #200 guardado correctamente.')).toBeVisible()
  expect(api.writes).toHaveLength(1)
  await page.reload()
  await page.getByRole('button', { name: 'Editar proveedor 200', exact: true }).click()
  await page.getByRole('textbox', { name: 'Empresa', exact: true }).fill('Empresa editada')
  await page.getByRole('button', { name: 'Actualizar proveedor' }).click()
  await expect(page.getByText('Proveedor #200 guardado correctamente.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('row').filter({ hasText: 'Empresa editada' })).toContainText('0012345678')
})
