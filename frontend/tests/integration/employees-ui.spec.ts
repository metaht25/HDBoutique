import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

test('employee UI preserves F02 and keeps the last usable administrator active', async ({ page }) => {
  await signIn(page)
  const identity = await (await page.request.get('/api/v1/auth/me')).json()
  const directory = await (await page.request.get('/api/v1/reports/employee-directory?limit=100')).json()
  const employee = directory.items.find((row: { employee_id: number }) => row.employee_id === identity.employee_id)
  expect(employee.is_active).toBe(true)
  await page.goto('/employees')
  const row = page.getByRole('row').filter({ hasText: `${employee.first_names} ${employee.last_names}` })
  await row.getByRole('button', { name: 'Desactivar', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Desactivar empleado' })
  const rejected = page.waitForResponse(response => response.url().endsWith('/api/v1/employees/' + employee.employee_id) && response.request().method() === 'PATCH')
  await dialog.getByRole('button', { name: 'Confirmar desactivación' }).click()
  const response = await rejected
  expect(response.status()).toBe(409); expect((await response.json()).error.code).toBe('last_administrator')
  await expect(dialog.getByRole('alert')).toContainText('Debe quedar una dueña activa.')
  expect((await page.request.get('/api/v1/auth/me')).status()).toBe(200)
  expect((await (await page.request.get('/api/v1/employees/' + employee.employee_id)).json()).is_active).toBe(true)
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(row.getByText('Activo', { exact: true })).toBeVisible()
})
