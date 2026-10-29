import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function customersBackend(page: Page, options: {
  role?: string; many?: boolean; empty?: boolean; rejectWrite?: number; lookupError?: boolean; anonymous?: boolean
} = {}) {
  const requested: string[] = [], writes: { method: string; body: Record<string, unknown> }[] = []
  let customers = Array.from({ length: options.empty ? 0 : options.many ? 21 : 1 }, (_, index) => ({
    customer_id: index + 1, first_names: `Cliente ${index + 1}`, last_names: 'Sintético',
    phone_number: '0012345678', customer_type_id: 7, address_id: 3,
  }))
  let lookupError = options.lookupError
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    requested.push(path)
    if (path === '/api/v1/auth/me') return route.fulfill({ status: options.anonymous ? 401 : 200, json: options.anonymous
      ? { error: { code: 'authentication_required', message: 'Inicia sesión' } }
      : { user_id: 1, username: 'synthetic-user', role: options.role ?? 'Manager', is_active: true, employee_id: null } })
    if (path === '/api/v1/auth/csrf') return route.fulfill({ json: { csrf_token: 'test-csrf' } })
    if (path === '/api/v1/customer-types') return route.fulfill({ json: [{ customer_type_id: 7, name: 'Registrado' }] })
    if (path === '/api/v1/addresses') return route.fulfill(lookupError
      ? { status: 503, json: { error: { code: 'database_unavailable', message: 'Ubicaciones no disponibles' } } }
      : { json: [{ address_id: 3, department_id: 2, address_line: 'Dirección de prueba' }] })
    if (path === '/api/v1/departments') return route.fulfill({ json: [{ department_id: 2, name: 'Managua' }] })
    if (path.startsWith('/api/v1/customers')) {
      if (request.method() === 'GET') {
        const query = (url.searchParams.get('q') ?? '').toLowerCase()
        const filtered = customers.filter(row => `${row.first_names} ${row.last_names}`.toLowerCase().includes(query) || row.phone_number.includes(query))
        const offset = Number(url.searchParams.get('offset') ?? 0)
        return route.fulfill({ json: filtered.slice(offset, offset + Number(url.searchParams.get('limit') ?? 50)) })
      }
      const body = request.postDataJSON() as Record<string, unknown>
      writes.push({ method: request.method(), body })
      expect(request.headers()['x-csrf-token']).toBe('test-csrf')
      if (options.rejectWrite) return route.fulfill({ status: options.rejectWrite, json: { error: {
        code: options.rejectWrite === 422 ? 'invalid_reference' : 'integrity_conflict', message: 'No se pudo guardar la referencia',
        fields: [{ location: ['body', 'address_id'], type: 'invalid_reference' }],
      } } })
      if (request.method() === 'POST') {
        const row = { customer_id: 50, first_names: '', last_names: '', phone_number: '', customer_type_id: 7, address_id: 3, ...body }
        customers.push(row)
        return route.fulfill({ status: 201, json: row })
      }
      const id = Number(path.split('/').at(-1))
      customers = customers.map(row => row.customer_id === id ? { ...row, ...body } : row)
      return route.fulfill({ json: customers.find(row => row.customer_id === id) })
    }
    return route.fulfill({ status: 404, json: { error: { code: 'not_found', message: 'Ruta no prevista' } } })
  })
  return { writes, requested, recoverLookups: () => { lookupError = false } }
}

async function fillCustomer(page: Page, cashier = false) {
  await page.getByRole('textbox', { name: 'Nombres', exact: true }).fill('Ana María')
  await page.getByRole('textbox', { name: 'Apellidos', exact: true }).fill('Prueba')
  await page.getByRole('textbox', { name: 'Teléfono', exact: true }).fill('0012345678')
  await page.getByRole('combobox', { name: 'Tipo de cliente', exact: true }).selectOption('7')
  if (cashier) await page.getByRole('textbox', { name: 'ID de dirección existente' }).fill('3')
  else await page.getByRole('combobox', { name: 'Dirección existente' }).selectOption('3')
}

for (const role of ['Administrator', 'Manager', 'Cashier']) {
  test(`${role} creates and edits a customer with existing address and textual phone`, async ({ page }) => {
    const api = await customersBackend(page, { role })
    await page.goto('/customers')
    await fillCustomer(page, role === 'Cashier')
    await page.getByRole('button', { name: 'Guardar cliente' }).dblclick()
    await expect(page.getByText('Cliente #50 guardado correctamente.')).toBeVisible()
    expect(api.writes).toHaveLength(1)
    expect(api.writes[0]?.body).toEqual({ first_names: 'Ana María', last_names: 'Prueba', phone_number: '0012345678', customer_type_id: 7, address_id: 3 })
    await page.reload()
    await expect(page.getByRole('cell', { name: 'Ana María Prueba' })).toBeVisible()
    await page.getByRole('button', { name: 'Editar cliente 50', exact: true }).click()
    await page.getByRole('textbox', { name: 'Teléfono', exact: true }).fill('0000000001')
    await page.getByRole('button', { name: 'Actualizar cliente' }).click()
    await expect(page.getByText('Cliente #50 guardado correctamente.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: 'Ana María Prueba' })).toContainText('0000000001')
    expect(api.writes).toHaveLength(2)
    expect(api.writes[1]?.method).toBe('PATCH')
    expect(api.requested.some(path => path.startsWith('/api/clientes/'))).toBe(false)
    expect(api.requested.some(path => path.includes('municipal') || path.includes('debt'))).toBe(false)
    if (role === 'Cashier') {
      expect(api.requested).not.toContain('/api/v1/addresses')
      expect(api.requested).not.toContain('/api/v1/departments')
      await expect(page.getByRole('cell', { name: 'Dirección #3', exact: true }).first()).toBeVisible()
    }
    await expect(page.getByRole('button', { name: /Desactivar|Activar/ })).toHaveCount(0)
  })
}

test('customer search and server pagination survive reloading', async ({ page }) => {
  await customersBackend(page, { many: true })
  await page.goto('/customers')
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByRole('cell', { name: 'Cliente 21 Sintético', exact: true })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Buscar cliente por nombre o teléfono' }).fill('Cliente 1')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page).toHaveURL(/page=1/)
  await page.reload()
  await expect(page.getByRole('cell', { name: 'Cliente 1 Sintético', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Cliente 21 Sintético', exact: true })).toHaveCount(0)
})

for (const rejectWrite of [422, 409]) {
  test(`customer ${rejectWrite} keeps draft without writing an address or retrying`, async ({ page }) => {
    const api = await customersBackend(page, { role: 'Cashier', rejectWrite })
    await page.goto('/customers')
    await page.getByRole('button', { name: 'Guardar cliente' }).click()
    await expect(page.getByRole('textbox', { name: 'Nombres', exact: true })).toHaveAccessibleDescription('Escribe los nombres, hasta 40 caracteres.')
    expect(api.writes).toHaveLength(0)
    await fillCustomer(page, true)
    await page.getByRole('button', { name: 'Guardar cliente' }).click()
    await expect(page.getByRole('alert')).toHaveText('No se pudo guardar la referencia')
    await expect(page.getByRole('textbox', { name: 'Nombres', exact: true })).toHaveValue('Ana María')
    await expect(page.getByRole('textbox', { name: 'ID de dirección existente' })).toHaveAttribute('aria-invalid', 'true')
    expect(api.writes).toHaveLength(1)
    expect(api.requested).not.toContain('/api/v1/addresses')
  })
}

test('empty customer lists and failed lookups are recoverable', async ({ page }) => {
  const api = await customersBackend(page, { empty: true, lookupError: true })
  await page.goto('/customers')
  await expect(page.getByText('No hay clientes en esta página.')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveText('Ubicaciones no disponibles')
  await expect(page.getByRole('button', { name: 'Guardar cliente' })).toHaveCount(0)
  api.recoverLookups()
  await page.getByRole('button', { name: 'Recargar clientes' }).click()
  await fillCustomer(page)
  await page.getByRole('button', { name: 'Guardar cliente' }).click()
  await expect(page.getByRole('cell', { name: 'Ana María Prueba' })).toBeVisible()
})

test('anonymous customer access never requests personal data', async ({ page }) => {
  const api = await customersBackend(page, { anonymous: true })
  await page.goto('/customers')
  await expect(page.getByRole('heading', { name: 'Inicia sesión para continuar' })).toBeVisible()
  expect(api.requested.every(path => path.startsWith('/api/v1/auth/'))).toBe(true)
})
