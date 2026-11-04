import { expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
export const context = { business_date: '2026-11-01', timezone: 'America/Managua' }
export const product = { product_id: 1, name: 'Prenda de prueba', category_id: 1, category_name: 'Ropa', size_id: 1, size_name: 'M', unit_price: '115.00', cost: '100.00', supplier_id: 1, supplier_name: 'Proveedor de prueba', legacy_stock: 2, legacy_stock_quantity: null, is_active: true, status: 'low_stock', description: null }
export const customer = { customer_id: 1, first_names: 'Cliente', last_names: 'Prueba', phone_number: '80000000', kind: 'regular', is_active: true, created_at: null, address_id: 1, address_line: 'Domicilio de prueba', department_id: 1, department_name: 'Departamento de prueba', municipality_id: 1, municipality_name: 'Municipio de prueba' }
export const sale = { sale_id: 1, customer_id: 1, employee_id: 1, customer_kind: 'general', customer_name: 'Cliente general', customer_phone: null, customer_address: null, seller_name: 'Persona de prueba', sale_date: '2026-11-01', created_at: '2026-11-01T15:30:00Z', delivery_cost: '0.00', notes: null, total: '115.00', currency: 'NIO', status: 'confirmed', created_by_user_id: 1, items: [{ sale_item_id: 1, product_id: 1, product_name: product.name, size_name: 'M', quantity: 1, unit_price: '115.00', subtotal: '115.00' }], payment: { payment_id: 1, shift_id: null, method: 'cash', amount: '115.00', cash_amount: '115.00', transfer_amount: '0.00', received_amount: '200.00', change_amount: '85.00', reference: null }, annulment: null }
export const saleRow = { sale_id: 1, receipt_id: 1, sale_date: sale.sale_date, created_at: sale.created_at, customer_name: sale.customer_name, seller_name: sale.seller_name, units: 1, products: product.name, method: 'cash', total: '115.00', status: 'confirmed' }
export async function json(route: Route, body: unknown, status = 200) { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }) }
export async function mockBoutique(page: Page, role = 'Administrator', temporary = false) {
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace('/api/v1/', '')
    if (path === 'auth/me') return json(route, { user_id: 1, username: 'persona-prueba', display_name: 'Persona de prueba', role, is_active: true, employee_id: 1, must_change_password: temporary })
    if (path === 'auth/csrf') return json(route, { csrf_token: 'synthetic-csrf' })
    if (path === 'auth/logout') return route.fulfill({ status: 204 })
    if (path === 'dashboard/overview') return json(route, { context, summary: { today_amount: '115.00', today_count: 1, today_units: 1, month_amount: '115.00', month_count: 1, month_units: 1, low_stock: 1, period_amount: '115.00', period_count: 1 }, period: 'week', recent_sales: [saleRow], low_stock: [product] })
    if (path.startsWith('reports/')) {
      let rows: object[] = []
      if (path.endsWith('product-catalog')) { const publicProduct = Object.fromEntries(Object.entries(product).filter(([key]) => !['cost', 'supplier_id', 'supplier_name'].includes(key))); rows = [role === 'Cashier' ? publicProduct : product] }
      if (path.endsWith('supplier-directory')) rows = [{ supplier_id: 1, company_name: 'Proveedor de prueba', phone_number: '80000000', is_active: true }]
      if (path.endsWith('customer-directory')) rows = [customer]
      if (path.endsWith('sales-ledger')) rows = [saleRow]
      const summary = { total_count: rows.length, active_count: rows.length, low_stock: 1, out_of_stock: 0, total_amount: '115.00', units: 1, average: '115.00', today_count: 1, month_count: 1, ...(role === 'Administrator' ? { inventory_value: '200.00' } : {}) }
      return json(route, { context, summary, items: rows, offset: 0, limit: 20, methods: [{ method: 'cash', total: '115.00', count: 1 }], best_products: [] })
    }
    if (path === 'categories') return json(route, [{ category_id: 1, name: 'Ropa' }])
    if (path === 'sizes') return json(route, [{ size_id: 1, name: 'M' }])
    if (path === 'departments') return json(route, [{ department_id: 1, name: 'Departamento de prueba' }])
    if (path === 'municipalities') return json(route, [{ municipality_id: 1, department_id: 1, name: 'Municipio de prueba' }])
    if (path === 'employee-options') return json(route, [{ employee_id: 1, first_names: 'Persona', last_names: 'Prueba' }])
    if (path === 'sales/1') return json(route, sale)
    if (path === 'receipts/1') return json(route, { sale, receipt_number: '1', sale_number: 'V-00001', boutique: { name: null, phone_number: null, address_line: null, logo_base64: null, ready: false } })
    if (path === 'boutique-profile') return json(route, { name: null, phone_number: null, address_line: null, logo_base64: null, ready: false })
    return json(route, [])
  })
}
export async function openMenu(page: Page) { await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); const toggle = page.getByRole('button', { name: 'Menú', exact: true }); if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click() }
