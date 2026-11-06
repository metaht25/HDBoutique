import { expect, test } from '@playwright/test'
import { context, json, mockBoutique } from '../fixtures/boutique'

const employee = { employee_id: 1, first_names: 'Persona', last_names: 'Sintética', phone_number: '81234567', job_title: 'Cargo histórico', start_date: '2026-11-01', end_date: null, is_active: true, username: 'synthetic-account', user_id: 1, address_id: 1, department_id: 1, department_name: 'Departamento de prueba', municipality_id: 1, municipality_name: 'Municipio de prueba', address_line: 'Dirección sintética' }

test('employee directory retains filters and keyboard editing across desktop, tablet and mobile', async ({ page }, info) => {
  await mockBoutique(page)
  const rows = Array.from({ length: 21 }, (_, index) => ({ ...employee, employee_id: index + 1, last_names: `Sintética ${index + 1}`, is_active: index !== 1, username: index === 2 ? null : employee.username, user_id: index === 2 ? null : index + 1 }))
  await page.route('**/api/v1/reports/employee-directory?**', route => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') || 0)
    return json(route, { context, summary: { total_count: 21, active_count: 20, inactive_count: 1, collaborators: 20 }, items: rows.slice(offset, offset + 20) })
  })
  const writes: string[] = []
  page.on('request', request => { if (request.method() === 'PATCH') writes.push(request.url()) })
  await page.goto('/employees')
  const table = page.getByRole('table', { name: 'Directorio' })
  await expect(table.getByText('Activo', { exact: true }).first()).toBeVisible()
  await expect(table.getByText('Inactivo', { exact: true })).toBeVisible()
  await expect(table.getByText('Sin cuenta vinculada', { exact: true })).toBeVisible()
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const deactivate = table.getByRole('button', { name: 'Desactivar', exact: true }).first()
    expect(await deactivate.evaluate(button => { const range = document.createRange(); range.selectNodeContents(button); return range.getClientRects().length })).toBe(1)
    if (width === 1440 || width === 390) await page.screenshot({ path: info.outputPath(`employees-${width}.png`), fullPage: true })
  }
  const trigger = table.getByRole('button', { name: 'Editar', exact: true }).first()
  await trigger.focus(); await trigger.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Editar empleado' })
  await expect(dialog.getByLabel('Cargo', { exact: true })).toHaveValue('Cargo histórico')
  await expect(dialog.getByLabel('Cargo', { exact: true })).toHaveAttribute('readonly', '')
  await expect(dialog.getByLabel('Nueva contraseña (opcional)')).toHaveValue('')
  await expect(dialog.getByLabel('Nueva contraseña (opcional)')).toHaveAttribute('type', 'password')
  await expect(dialog.getByText('Los permisos actuales se conservan', { exact: true })).toBeVisible()
  await dialog.getByLabel('Nueva contraseña (opcional)').fill('abc123')
  await expect(dialog.getByRole('status')).toContainText('se invalidarán las sesiones')
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused()
  expect(writes).toEqual([])
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await expect(table.getByText('Persona Sintética 21', { exact: true })).toBeVisible()
  await page.getByLabel('Buscar', { exact: true }).fill('Persona')
  await page.getByLabel('Estado', { exact: true }).selectOption('inactive')
  const filtered = page.waitForRequest(request => request.url().includes('employee-directory?') && new URL(request.url()).searchParams.get('q') === 'Persona')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  expect(Object.fromEntries(new URL((await filtered).url()).searchParams)).toMatchObject({ q: 'Persona', status: 'inactive', offset: '0', limit: '20' })
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click()
  await expect(page.getByLabel('Buscar', { exact: true })).toHaveValue('')
})

test('deactivation explains session revocation and retains the last administrator rejection', async ({ page }) => {
  await mockBoutique(page)
  await page.route('**/api/v1/reports/employee-directory?**', route => json(route, { context, summary: { total_count: 1 }, items: [employee] }))
  let calls = 0
  await page.route('**/api/v1/employees/1', route => {
    calls++; expect(route.request().method()).toBe('PATCH'); expect(route.request().postDataJSON()).toEqual({ is_active: false })
    return json(route, { error: { code: 'last_administrator', message: 'Debe quedar una dueña activa.' } }, 409)
  })
  await page.goto('/employees'); const trigger = page.getByRole('button', { name: 'Desactivar', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Desactivar empleado' })
  await expect(dialog.getByText('Se bloqueará su acceso y se invalidarán sus sesiones. Su historial se conservará.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click(); expect(calls).toBe(0)
  await trigger.click(); await dialog.getByRole('button', { name: 'Confirmar desactivación' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Debe quedar una dueña activa.')
  await expect(dialog).toBeVisible(); expect(calls).toBe(1)
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('table').getByText('Activo', { exact: true })).toBeVisible()
})

test('new employee form groups fields, preserves constraints and clears passwords after server validation', async ({ page }, info) => {
  await mockBoutique(page)
  await page.route('**/api/v1/employees', route => {
    const body = route.request().postDataJSON()
    expect(body).toMatchObject({ first_names: 'Persona', last_names: 'Sintética', phone_number: '81234567', username: 'existing-account', password: 'abc123', address: { department_id: 1, municipality_id: 1, address_line: 'Domicilio sintético' } })
    expect(body).not.toHaveProperty('role'); expect(body).not.toHaveProperty('job_title')
    return json(route, { error: { code: 'validation_error', message: 'Invalid request', fields: [{ location: ['body', 'username'], type: 'string_pattern_mismatch' }] } }, 422)
  })
  await page.goto('/employees'); await page.getByRole('button', { name: '+ Nuevo empleado' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo empleado' })
  await expect(dialog.getByLabel('Contraseña', { exact: true })).toHaveAttribute('minlength', '6')
  await expect(dialog.getByLabel('Contraseña', { exact: true })).toHaveAttribute('maxlength', '128')
  await dialog.getByLabel('Nombres', { exact: true }).fill('Persona'); await dialog.getByLabel('Apellidos', { exact: true }).fill('Sintética')
  await dialog.getByLabel('Teléfono', { exact: true }).fill('81234567')
  await dialog.getByLabel('Departamento', { exact: true }).click(); await dialog.getByRole('listbox', { name: 'Departamento' }).getByRole('option').first().click()
  await dialog.getByLabel('Municipio', { exact: true }).click(); await dialog.getByRole('listbox', { name: 'Municipio' }).getByRole('option').first().click()
  await dialog.getByLabel('Dirección exacta').fill('Domicilio sintético')
  await dialog.getByLabel('Usuario de acceso', { exact: true }).fill('existing-account')
  await dialog.getByLabel('Contraseña', { exact: true }).fill('abc123')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: info.outputPath(`employee-form-${width}.png`) })
  }
  await dialog.getByRole('button', { name: 'Guardar empleado', exact: true }).click()
  await expect(dialog.getByLabel('Usuario de acceso', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(dialog.getByLabel('Contraseña', { exact: true })).toHaveValue('')
  await expect(dialog.getByLabel('Nombres', { exact: true })).toHaveValue('Persona')
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByLabel('Usuario de acceso', { exact: true }).fill('corrected-account')
  await expect(dialog.getByLabel('Usuario de acceso', { exact: true })).toHaveAttribute('aria-invalid', 'false')
})

test('employee directory presents empty and service error states', async ({ page }) => {
  await mockBoutique(page); await page.goto('/employees')
  await expect(page.getByRole('heading', { name: 'No hay empleados para mostrar' })).toBeVisible()
  await page.route('**/api/v1/reports/employee-directory?**', route => json(route, { error: { code: 'unavailable', message: 'No se pudo consultar el equipo' } }, 503))
  await page.reload(); await expect(page.getByRole('alert').filter({ hasText: 'No se pudo consultar el equipo' }).first()).toBeVisible()
})
