import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { reportingResponse } from '../fixtures/reporting'
import { purchase, sale, shift, supplierRows } from '../fixtures/transactions'

const account = { user_id: 101, username: 'synthetic-manager', role: 'Manager', is_active: true, employee_id: 102 }
const routes = [
  ['/dashboard', 'Dashboard'], ['/products', 'Productos'], ['/customers', 'Clientes'],
  ['/sales', 'Ventas'], ['/purchases', 'Compras'], ['/suppliers', 'Proveedores'],
  ['/cash-register', 'Caja'], ['/reports', 'Reportes'],
] as const

async function syntheticApi(page: Page, options: {
  anonymous?: boolean; sessionUnavailable?: boolean; productError?: boolean; suppliers?: number
} = {}) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/auth/me') {
      const status = options.sessionUnavailable ? 503 : options.anonymous ? 401 : 200
      return route.fulfill({ status, json: status === 200 ? account : {
        error: { code: status === 401 ? 'authentication_required' : 'database_unavailable',
          message: status === 401 ? 'Authentication required' : 'Servicio de sesión no disponible' },
      } })
    }
    if (path === '/api/v1/employee-options') return route.fulfill({ json: [{ employee_id: 102, first_names: 'Empleado', last_names: 'Prueba' }] })
    if (path === '/api/v1/auth/csrf') return route.fulfill({ json: { csrf_token: 'synthetic-csrf-token' } })
    if (path === '/api/v1/auth/logout') return route.fulfill({ status: 204 })
    const report = reportingResponse(new URL(route.request().url()))
    if (report) return route.fulfill({ json: report })
    if (options.productError && path === '/api/v1/products') return route.fulfill({
      status: 503, json: { error: { code: 'database_unavailable', message: 'Productos no disponibles temporalmente' } },
    })
    if (path === '/api/v1/products') return route.fulfill({ json: [{
      product_id: 109, category_id: 104, size_id: 105, name: 'Camisa de prueba',
      unit_price: '199.50', legacy_stock: 3, legacy_stock_quantity: 12,
    }] })
    if (path === '/api/v1/categories') return route.fulfill({ json: [{ category_id: 104, name: 'Ropa' }] })
    if (path === '/api/v1/sizes') return route.fulfill({ json: [{ size_id: 105, name: 'M' }] })
    if (path === '/api/v1/customers') return route.fulfill({ json: [{ customer_id: 108, first_names: 'Cliente', last_names: 'Sintético',
      phone_number: '0000000000', address_id: 103, customer_type_id: 107 }] })
    if (path === '/api/v1/customer-types') return route.fulfill({ json: [{ customer_type_id: 107, name: 'Registrado' }] })
    if (path === '/api/v1/addresses') return route.fulfill({ json: [{ address_id: 103, department_id: 101, address_line: 'Dirección sintética' }] })
    if (path === '/api/v1/departments') return route.fulfill({ json: [{ department_id: 101, name: 'Managua' }] })
    if (path === '/api/v1/sales') return route.fulfill({ json: [sale] })
    if (path === '/api/v1/cash/shifts') return route.fulfill({ json: [shift] })
    if (path === '/api/v1/purchases') return route.fulfill({ json: [purchase] })
    if (path === '/api/v1/supplier-products') return route.fulfill({ json: [{ supplier_product_id: 201, product_id: 109, purchase_price: '120.50' }] })
    if (path === '/api/v1/supplier-offerings') return route.fulfill({ json: [{ offering_id: 1, supplier_id: 106, supplier_product_id: 201 }] })
    if (path === '/api/v1/suppliers') {
      const url = new URL(route.request().url()), offset = Number(url.searchParams.get('offset') ?? 0)
      const filtered = supplierRows(options.suppliers).filter(row => row.company_name.includes(url.searchParams.get('q') ?? ''))
      return route.fulfill({ json: filtered.slice(offset, offset + Number(url.searchParams.get('limit') ?? 50)) })
    }
    throw new Error(`Unexpected API request: ${path}`)
  })
}

for (const [path, label] of routes) {
  test(`direct URL and reload: ${path}`, async ({ page }, testInfo) => {
    const exceptions: string[] = []
    page.on('pageerror', error => exceptions.push(error.message))
    await syntheticApi(page)
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label)
    await expect(page.getByText('synthetic-manager · Gerencia')).toBeVisible()
    await expect(page.getByText('Cargando pantalla…')).toHaveCount(0)
    if (path !== '/cash-register') await expect(page.locator('main table').first()).toBeVisible()
    await expect(page).toHaveTitle(`${label} | H&D Boutique`)
    expect(await page.locator('html').getAttribute('lang')).toBe('es-NI')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label)
    expect(exceptions).toEqual([])
    if (path !== '/cash-register') {
      await expect(page.getByText('Cargando pantalla…')).toHaveCount(0)
      if (path === '/products') await expect(page.getByRole('button', { name: 'Guardar producto' })).toBeVisible()
      else if (path === '/customers') await expect(page.getByRole('button', { name: 'Guardar cliente' })).toBeVisible()
      else if (path === '/reports') await expect(page.getByRole('heading', { name: 'Reportes', exact: true, level: 2 })).toBeVisible()
      else if (path === '/dashboard') await expect(page.getByRole('heading', { name: 'Resumen general' })).toBeVisible()
      await expect(page.locator('main table').first()).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath('screen.png'), fullPage: true })
    }
  })
}

test('URL navigation, back/forward and active link work on desktop and mobile', async ({ page, isMobile }) => {
  await syntheticApi(page)
  await page.goto('/dashboard')
  if (isMobile) await page.getByRole('button', { name: 'Menú', exact: true }).click()
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Productos' }).click()
  await expect(page).toHaveURL(/\/products$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  await page.goBack()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goForward()
  await expect(page).toHaveURL(/\/products$/)
  if (isMobile) await page.getByRole('button', { name: 'Menú', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Productos' })).toHaveAttribute('aria-current', 'page')
})

test('logout includes CSRF and removes the session user', async ({ page }) => {
  await syntheticApi(page)
  await page.goto('/dashboard')
  const request = page.waitForRequest(request => request.url().endsWith('/api/v1/auth/logout'))
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  expect((await request).headers()['x-csrf-token']).toBe('synthetic-csrf-token')
  await expect(page.getByText('Sin sesión', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0)
})

test('backend page errors remain visible for an authenticated user', async ({ page }) => {
  await syntheticApi(page, { productError: true })
  await page.goto('/products')
  await expect(page.getByRole('alert')).toHaveText('Productos no disponibles temporalmente')
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
})

test('anonymous legacy access and unknown routes remain recoverable', async ({ page }) => {
  await syntheticApi(page, { anonymous: true })
  await page.goto('/unknown')
  await expect(page.getByText('Sin sesión', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Ir al inicio' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('supplier pagination and search keep all loaded records accessible', async ({ page }) => {
  await syntheticApi(page, { suppliers: 21 })
  await page.goto('/suppliers')
  await expect(page.getByText('Empresa sintética 1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('Empresa sintética 21', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  await page.getByRole('searchbox', { name: 'Buscar proveedor' }).fill('Empresa sintética 1')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByText('Empresa sintética 1', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
})

test('keyboard skip link and linked form validation are usable', async ({ page }) => {
  await syntheticApi(page)
  await page.goto('/products')
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  const field = page.getByRole('combobox', { name: 'Categoría', exact: true })
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(field).toHaveAccessibleDescription('Selecciona una categoría.')
  await page.keyboard.press('Control+Home')
  await page.getByRole('link', { name: 'Saltar al contenido' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
})

test('route styles do not alter a table outside their screen scope', async ({ page }) => {
  await syntheticApi(page)
  await page.goto('/products')
  await expect(page.getByRole('button', { name: 'Guardar producto' })).toBeVisible()
  const outsideWidth = await page.evaluate(() => {
    const table = document.createElement('table')
    table.innerHTML = '<tbody><tr><td>External synthetic table</td></tr></tbody>'
    document.body.append(table)
    const color = getComputedStyle(table).borderCollapse
    table.remove()
    return color
  })
  expect(outsideWidth).toBe('separate')
})
