import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import contracts from '../../../backend/tests/characterization/fixtures/legacy_contracts.json' with { type: 'json' }

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
    if (path === '/api/v1/auth/csrf') return route.fulfill({ json: { csrf_token: 'synthetic-csrf-token' } })
    if (path === '/api/v1/auth/logout') return route.fulfill({ status: 204 })
    if (options.productError && path === '/api/productos/productos/') return route.fulfill({
      status: 503, json: { error: { code: 'database_unavailable', message: 'Productos no disponibles temporalmente' } },
    })
    if (options.suppliers && path === '/api/proveedores/proveedores/') return route.fulfill({
      json: Array.from({ length: options.suppliers }, (_, index) => ({
        id_proveedor: index + 1, nombreempresa: `Empresa sintética ${index + 1}`,
        nombrecontacto: 'Contacto', apellidocontacto: 'Sintético',
        numerotelefono: '00000000', correoprofesional: null, id_direccion: 101,
      })),
    })
    const resource = contracts.resources.find(item => item.path === path)
    return route.fulfill({ json: resource ? [resource.example] : [] })
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
    if (path === '/products' || path === '/dashboard') {
      await expect(page.getByText('Cargando pantalla…')).toHaveCount(0)
      if (path === '/products') await expect(page.getByRole('button', { name: 'Guardar producto' })).toBeVisible()
      else await expect(page.getByRole('heading', { name: 'Resumen general' })).toBeVisible()
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

test('unavailable session and backend page errors remain visible without a fake user', async ({ page }) => {
  await syntheticApi(page, { sessionUnavailable: true, productError: true })
  await page.goto('/products')
  await expect(page.getByText('Servicio de sesión no disponible', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveText('Productos no disponibles temporalmente')
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0)
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
  await expect(page.getByText('Página 1 de 2')).toBeVisible()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('Empresa sintética 21', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  await page.getByRole('searchbox', { name: 'Buscar proveedor' }).fill('Empresa sintética 1')
  await expect(page.getByText('Empresa sintética 1', { exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Paginación' })).toHaveCount(0)
})

test('keyboard skip link and linked form validation are usable', async ({ page }) => {
  await syntheticApi(page)
  await page.goto('/products')
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  const field = page.getByRole('textbox', { name: 'Nombre', exact: true })
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(field).toHaveAccessibleDescription('El nombre del producto es obligatorio.')
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
