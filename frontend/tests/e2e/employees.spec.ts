import { expect, test } from '@playwright/test'

test('supervisor creates and edits employees with nullable fields', async ({ page }, testInfo) => {
  let rows = [{ employee_id: 1, first_names: 'Ana', last_names: 'Prueba', phone_number: '0012345678', address_id: 3, work_email: null, job_title: null, start_date: null, end_date: null }]
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/**', route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { user_id: 1, username: 'synthetic', role: 'Manager', is_active: true, employee_id: null } })
    if (path.endsWith('/auth/csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.endsWith('/addresses')) return route.fulfill({ json: [{ address_id: 3, department_id: 2, address_line: 'Direccion de prueba' }] })
    if (path.endsWith('/departments')) return route.fulfill({ json: [{ department_id: 2, name: 'Managua' }] })
    if (path.startsWith('/api/v1/employees')) {
      if (req.method() === 'GET') {
        const query = url.searchParams.get('q') ?? ''
        return route.fulfill({ json: rows.filter(row => `${row.first_names} ${row.last_names}`.includes(query)) })
      }
      const body = req.postDataJSON() as typeof rows[number]
      expect(req.headers()['x-csrf-token']).toBe('synthetic-csrf')
      writes.push(body)
      if (req.method() === 'POST') { rows = [...rows, { ...body, employee_id: 2 }]; return route.fulfill({ status: 201, json: rows[1] }) }
      rows = rows.map(row => row.employee_id === 2 ? { ...row, ...body } : row)
      return route.fulfill({ json: rows[1] })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/employees')
  await page.getByLabel('Nombres', { exact: true }).fill('Maria')
  await page.getByLabel('Apellidos', { exact: true }).fill('Prueba')
  await page.getByLabel('Tel\u00e9fono', { exact: true }).fill('0012345678')
  await page.getByLabel('Direcci\u00f3n existente', { exact: true }).selectOption('3')
  await page.getByLabel('Cargo', { exact: true }).fill('Cajera')
  await page.getByRole('button', { name: 'Guardar empleado' }).dblclick()
  await expect(page.getByText('Empleado #2 guardado correctamente.')).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0]?.phone_number).toBe('0012345678')
  await page.getByRole('button', { name: 'Editar empleado 2', exact: true }).click()
  await page.getByLabel('Cargo', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Actualizar empleado' }).click()
  await expect(page.getByRole('button', { name: 'Guardar empleado' })).toBeVisible()
  expect(writes[1]?.job_title).toBeNull()
  await page.getByRole('searchbox').fill('Maria')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page).toHaveURL(/q=Maria/)
  await page.reload()
  await expect(page.getByRole('cell', { name: 'Maria Prueba', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('employees.png'), fullPage: true })
})

test('Cashier cannot request employee personal data', async ({ page }) => {
  const requested: string[] = []
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    requested.push(path)
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { user_id: 1, username: 'synthetic', role: 'Cashier', employee_id: null, is_active: true } })
    if (path.endsWith('/auth/csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    return route.fulfill({ json: {} })
  })
  await page.goto('/employees')
  await expect(page.getByText('No tienes permiso para gestionar empleados.')).toBeVisible()
  expect(requested).not.toContain('/api/v1/employees')
  expect(requested).not.toContain('/api/v1/addresses')
})
