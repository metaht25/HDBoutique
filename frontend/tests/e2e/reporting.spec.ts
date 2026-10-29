import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { reportingResponse } from '../fixtures/reporting'

async function backend(page: Page, role = 'Manager', anonymous = false) {
  const requests: string[] = []
  let status = anonymous ? 401 : 200
  let fail = false
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    requests.push(path)
    if (path === '/api/v1/auth/me') return route.fulfill({ status, json: status === 200
      ? { user_id: 1, username: 'synthetic-user', role, is_active: true, employee_id: null }
      : { error: { code: 'authentication_required', message: 'Inicia sesión' } } })
    if (path === '/api/v1/auth/csrf') return route.fulfill({ json: { csrf_token: 'test-csrf' } })
    if (status === 401) return route.fulfill({ status: 401, json: { error: { code: 'authentication_required', message: 'Inicia sesión' } } })
    if (fail) return route.fulfill({ status: 503, json: { error: { code: 'database_unavailable', message: 'Reportes no disponibles' } } })
    const data = reportingResponse(url, role !== 'Cashier')
    return route.fulfill({ status: data ? 200 : 404, json: data ?? {} })
  })
  return { requests, setFailure: (value: boolean) => { fail = value }, expire: () => { status = 401 } }
}

for (const role of ['Manager', 'Cashier']) {
  test(`${role} sees business date and permitted dashboard indicators`, async ({ page }) => {
    const api = await backend(page, role)
    await page.goto('/dashboard')
    await expect(page.getByText('2026-10-28', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('C$4189.50', { exact: true })).toBeVisible()
    await expect(page.getByText('Sin conteo', { exact: true })).toBeVisible()
    await expect(page.getByText('Proveedores registrados', { exact: true })).toHaveCount(role === 'Cashier' ? 0 : 1)
    await expect(page.getByText('Compras del día', { exact: true })).toHaveCount(role === 'Cashier' ? 0 : 1)
    expect(api.requests.filter(path => !path.startsWith('/api/v1/auth/'))).toEqual(['/api/v1/dashboard'])
    await page.getByRole('link', { name: 'Consultar reporte de ventas' }).click()
    await expect(page.getByText('22 registros en el resultado completo. Hasta 20 por página.')).toBeVisible()
    await expect(page.getByRole('option', { name: 'Compras', exact: true })).toHaveCount(role === 'Cashier' ? 0 : 1)
  })
}

test('global summaries remain unchanged across pages and date ranges survive reload', async ({ page }) => {
  await backend(page)
  await page.goto('/reports?type=sales')
  await expect(page.getByText('C$4389.00', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByText('C$4389.00', { exact: true })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await page.getByLabel('Desde', { exact: true }).fill('2026-10-28')
  await page.getByLabel('Hasta', { exact: true }).fill('2026-10-28')
  await page.getByRole('button', { name: 'Aplicar filtros' }).click()
  await expect(page).toHaveURL(/page=1/)
  await page.reload()
  await expect(page.getByText('C$4189.50', { exact: true })).toBeVisible()
  await page.getByLabel('Desde', { exact: true }).fill('2026-10-29')
  await page.getByRole('button', { name: 'Aplicar filtros' }).click()
  await expect(page.getByRole('alert')).toHaveText('La fecha inicial no puede ser posterior a la final.')
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await expect(page.getByText('C$4389.00', { exact: true })).toBeVisible()
})

test('inventory keeps unknown counts and customer types with identical names stay separate', async ({ page }) => {
  await backend(page, 'Cashier')
  await page.goto('/reports?type=inventory')
  await expect(page.getByRole('cell', { name: 'Sin contar', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Sin conteo', exact: true })).toHaveCount(2)
  await page.getByRole('combobox', { name: 'Estado de inventario' }).selectOption('unknown')
  await page.getByRole('button', { name: 'Aplicar filtros' }).click()
  await page.reload()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.getByLabel('Desde', { exact: true })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Tipo de reporte' }).selectOption('customers')
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await expect(page.getByRole('cell', { name: 'Registrado', exact: true })).toHaveCount(2)
})

test('purchases expose incomplete historical totals without inventing zero costs', async ({ page }) => {
  await backend(page)
  await page.goto('/reports?type=purchases')
  await expect(page.getByRole('cell', { name: 'Sin determinar', exact: true })).toHaveCount(3)
  await expect(page.getByText(/1 compras sin mercancía determinada/)).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Histórica', exact: true })).toBeVisible()
})

test('Cashier deep links to purchases are denied without requesting protected data', async ({ page }) => {
  const api = await backend(page, 'Cashier')
  await page.goto('/reports?type=purchases')
  await expect(page.getByRole('alert')).toHaveText('No tienes permiso para consultar compras.')
  expect(api.requests.some(path => path.includes('/reports/'))).toBe(false)
  await page.getByRole('link', { name: 'Consultar ventas' }).click()
  await expect(page.getByText('C$4389.00', { exact: true })).toBeVisible()
})

test('report errors recover explicitly and expired sessions remove loaded data', async ({ page }) => {
  const api = await backend(page)
  api.setFailure(true)
  await page.goto('/reports')
  await expect(page.getByRole('alert')).toHaveText('Reportes no disponibles')
  api.setFailure(false)
  await page.getByRole('button', { name: 'Recargar reporte' }).click()
  await expect(page.getByText('C$4389.00', { exact: true })).toBeVisible()
  api.expire()
  await page.getByRole('button', { name: 'Recargar reporte' }).click()
  await expect(page.getByRole('heading', { name: 'Inicia sesión para continuar' })).toBeVisible()
  await expect(page.locator('main table')).toHaveCount(0)
})

test('anonymous access never fetches dashboard or report data', async ({ page }) => {
  const api = await backend(page, 'Manager', true)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Inicia sesión para continuar' })).toBeVisible()
  await page.goto('/reports')
  await expect(page.getByRole('heading', { name: 'Inicia sesión para continuar' })).toBeVisible()
  expect(api.requests.every(path => path.startsWith('/api/v1/auth/'))).toBe(true)
})
