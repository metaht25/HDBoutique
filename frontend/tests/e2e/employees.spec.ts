import { expect, test } from '@playwright/test'
import { mockBoutique } from '../fixtures/boutique'
test('employee creation includes credentials and direct municipality selection', async ({ page }) => {
  await mockBoutique(page); await page.goto('/employees'); await page.getByRole('button', { name: '+ Nuevo empleado' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo empleado' })
  await expect(dialog.getByLabel('Usuario de acceso')).toBeVisible(); await expect(dialog.getByLabel('Contraseña temporal', { exact: true })).toHaveAttribute('type', 'password')
  await expect(dialog.getByLabel('Municipio', { exact: true })).toBeDisabled()
  await dialog.getByLabel('Departamento', { exact: true }).selectOption('1')
  await expect(dialog.getByLabel('Municipio', { exact: true })).toBeEnabled()
})
test('a temporary password blocks business queries until replacement', async ({ page }) => {
  await mockBoutique(page, 'Cashier', true)
  const requests: string[] = []; page.on('request', request => { if (request.url().includes('/api/v1/')) requests.push(request.url()) })
  await page.goto('/new-sale'); await expect(page.getByRole('heading', { name: 'Cambia tu contraseña temporal' })).toBeVisible()
  expect(requests.every(url => url.includes('/auth/'))).toBe(true)
})
