import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function backend(page: Page, options: { role?: string; empty?: boolean; many?: boolean; failure?: boolean } = {}) {
  const requested: string[] = [], writes: { path: string; body: Record<string, unknown> }[] = []
  const rows: Record<string, Record<string, unknown>[]> = {
    departments: [{ department_id: 1, name: 'Managua' }], addresses: [{ address_id: 1, department_id: 1, address_line: 'Direccion de prueba' }],
    categories: Array.from({ length: options.many ? 21 : 1 }, (_, index) => ({ category_id: index + 1, name: `Categoria ${index + 1}` })),
    sizes: [{ size_id: 1, name: 'M' }], 'customer-types': [{ customer_type_id: 1, name: 'Registrado' }],
    products: [{ product_id: 1, name: 'Camisa' }], suppliers: [{ supplier_id: 1, company_name: 'Proveedor de prueba' }], customers: [{ customer_id: 1 }],
    'supplier-products': [{ supplier_product_id: 1, product_id: 1, purchase_price: '120.50' }],
    'supplier-offerings': [{ offering_id: 1, supplier_id: 1, supplier_product_id: 1 }],
    'employee-options': [{ employee_id: 1, first_names: 'Ana', last_names: 'Prueba' }, { employee_id: 2, first_names: 'Maria', last_names: 'Prueba' }],
    users: [{ user_id: 1, username: 'synthetic-admin', role: 'Administrator', employee_id: null, is_active: true },
      { user_id: 2, username: 'synthetic-cashier', role: 'Cashier', employee_id: 1, is_active: true }],
  }
  const ids: Record<string, string> = { departments: 'department_id', addresses: 'address_id', categories: 'category_id', sizes: 'size_id', 'customer-types': 'customer_type_id', 'supplier-products': 'supplier_product_id', 'supplier-offerings': 'offering_id', users: 'user_id' }
  let failure = options.failure, session = true, rejectAdmin = true
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, resource = path.split('/')[3] ?? ''
    requested.push(path)
    if (path.endsWith('/auth/me')) return route.fulfill({ status: session ? 200 : 401, json: session ? { ...rows.users?.[0], role: options.role ?? 'Administrator' } : { error: { code: 'authentication_required', message: 'Inicia sesión' } } })
    if (path.endsWith('/auth/csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (failure && resource === 'addresses') return route.fulfill({ status: 503, json: { error: { code: 'database_unavailable', message: 'Ubicaciones no disponibles' } } })
    if (req.method() !== 'GET') {
      const body = req.postDataJSON() as Record<string, unknown>
      writes.push({ path, body }); expect(req.headers()['x-csrf-token']).toBe('synthetic-csrf')
      if (resource === 'users' && path.endsWith('/1')) {
        if (rejectAdmin) return route.fulfill({ status: 409, json: { error: { code: 'last_administrator', message: 'An active Administrator is required' } } })
        session = false
      }
      const idField = ids[resource]!, id = req.method() === 'POST' ? 50 : Number(path.split('/').at(-1))
      const row: Record<string, unknown> = { ...(rows[resource]?.find(row => row[idField] === id) ?? {}), ...(resource === 'users' ? { is_active: true } : {}), ...body, [idField]: id }
      if (resource === 'users') delete row.password
      rows[resource] = req.method() === 'POST' ? [...(rows[resource] ?? []), row] : (rows[resource] ?? []).map(previous => previous[idField] === id ? row : previous)
      return route.fulfill({ status: req.method() === 'POST' ? 201 : 200, json: row })
    }
    const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 50)
    return route.fulfill({ json: options.empty ? [] : (rows[resource] ?? []).slice(offset, offset + limit) })
  })
  return { requested, writes, recover: () => { failure = false }, allowSelfEdit: () => { rejectAdmin = false } }
}

test('preparation shows missing references and recovers failed checks without writes', async ({ page }, testInfo) => {
  const api = await backend(page, { empty: true, role: 'Manager', failure: true })
  await page.goto('/settings')
  await expect(page.getByRole('alert')).toContainText('Ubicaciones no disponibles')
  await expect(page.getByText('Pendiente de registrar', { exact: true })).toHaveCount(0)
  api.recover()
  await page.getByRole('button', { name: 'Revisar preparación' }).click()
  await expect(page.getByText('Pendiente de registrar', { exact: true })).toHaveCount(11)
  expect(api.writes).toHaveLength(0)
  expect(api.requested).not.toContain('/api/v1/users')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('preparation.png'), fullPage: true })
})

for (const section of ['departments', 'addresses', 'categories', 'sizes', 'customer-types', 'supplier-products', 'supplier-offerings']) {
  test(`creates and edits ${section} with existing references`, async ({ page }, testInfo) => {
    const api = await backend(page)
    await page.goto(`/settings?section=${section}`)
    if (section === 'addresses') await page.getByRole('combobox', { name: 'Departamento', exact: true }).selectOption('1')
    if (section === 'supplier-products') await page.getByRole('combobox', { name: 'Producto', exact: true }).selectOption('1')
    if (section === 'supplier-offerings') {
      await page.getByRole('combobox', { name: 'Proveedor', exact: true }).selectOption('1')
      await page.getByRole('combobox', { name: 'Producto y costo de compra', exact: true }).selectOption('1')
    } else await page.getByRole('textbox').fill(section === 'supplier-products' ? '33.10' : 'Nuevo dato')
    await page.getByRole('button', { name: 'Guardar registro' }).dblclick()
    await expect(page.getByText('Registro #50 guardado correctamente.')).toBeVisible()
    expect(api.writes).toHaveLength(1)
    await page.getByRole('button', { name: 'Editar registro 50', exact: true }).click()
    if (section === 'supplier-products') {
      await expect(page.getByRole('combobox', { name: 'Producto', exact: true })).toBeDisabled()
      await page.getByRole('textbox').fill('40.25')
    } else if (['categories', 'addresses', 'customer-types'].includes(section)) await page.getByRole('textbox').fill('')
    else if (section !== 'supplier-offerings') await page.getByRole('textbox').fill('Dato editado')
    await page.getByRole('button', { name: 'Actualizar registro' }).click()
    await expect(page.getByRole('button', { name: 'Guardar registro' })).toBeVisible()
    expect(api.writes).toHaveLength(2)
    if (section === 'supplier-products') expect(api.writes[1]?.body.purchase_price).toBe('40.25')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Editar registro 50', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    if (section === 'addresses') await page.screenshot({ path: testInfo.outputPath('addresses.png'), fullPage: true })
  })
}

test('catalog pagination survives reload and validates required fields', async ({ page }) => {
  const api = await backend(page, { many: true })
  await page.goto('/settings?section=categories')
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByRole('cell', { name: 'Categoria 21', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('cell', { name: 'Categoria 21', exact: true })).toBeVisible()
  await page.getByLabel('Sección de configuración').selectOption('sizes')
  await page.getByRole('button', { name: 'Guardar registro' }).click()
  await expect(page.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveAttribute('aria-invalid', 'true')
  expect(api.writes).toHaveLength(0)
})

test('Administrator creates, links, edits and disables accounts without resending passwords', async ({ page }, testInfo) => {
  const api = await backend(page)
  await page.goto('/settings?section=accounts')
  await page.getByLabel('Usuario', { exact: true }).fill('new-person')
  await page.getByLabel('Rol', { exact: true }).selectOption('Manager')
  await expect(page.getByLabel('Empleado vinculado').getByRole('option', { name: 'Ana Prueba (#1)' })).toHaveCount(0)
  await page.getByLabel('Empleado vinculado').selectOption('2')
  await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-password-27!')
  await page.getByLabel('Repetir contraseña', { exact: true }).fill('Synthetic-password-27!')
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).dblclick()
  await expect(page.getByText('Cuenta new-person guardada correctamente.')).toBeVisible()
  expect(api.writes).toHaveLength(1)
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Editar cuenta new-person', exact: true }).click()
  await page.getByLabel('Empleado vinculado').selectOption('')
  await page.getByLabel('Estado de la cuenta').selectOption('inactive')
  await page.getByRole('button', { name: 'Actualizar cuenta', exact: true }).click()
  await expect(page.getByText('Cuenta new-person guardada correctamente.')).toBeVisible()
  expect(api.writes[1]?.body).toEqual({ employee_id: null, is_active: false })
  await page.getByRole('searchbox').fill('new-person')
  await expect(page.getByRole('cell', { name: 'Inactiva', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('accounts.png'), fullPage: true })
})

test('last Administrator rejection preserves access and self changes remove revoked sessions', async ({ page }) => {
  const api = await backend(page)
  await page.goto('/settings?section=accounts')
  await page.getByRole('button', { name: 'Editar cuenta synthetic-admin', exact: true }).click()
  await page.getByLabel('Estado de la cuenta').selectOption('inactive')
  await page.getByRole('button', { name: 'Actualizar cuenta', exact: true }).click()
  await expect(page.getByText('Debe conservarse al menos una cuenta Administrator activa.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Editar cuenta synthetic-admin', exact: true })).toBeVisible()
  api.allowSelfEdit()
  await page.getByLabel('Estado de la cuenta').selectOption('active')
  await page.getByLabel('Empleado vinculado').selectOption('2')
  await page.getByRole('button', { name: 'Actualizar cuenta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inicia sesión para continuar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toHaveCount(0)
})

for (const role of ['Cashier', 'Manager']) test(`${role} cannot load account administration`, async ({ page }) => {
  const api = await backend(page, { role })
  await page.goto('/settings?section=accounts')
  await expect(page.getByRole('alert')).toContainText(role === 'Manager' ? 'Solo Administrator' : 'No tienes permiso')
  expect(api.requested).not.toContain('/api/v1/users')
  expect(api.requested).not.toContain('/api/v1/employee-options')
})
