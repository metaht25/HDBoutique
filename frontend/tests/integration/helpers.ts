import { expect } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'

export const password = 'Synthetic-password-27!'
export const origin = 'http://127.0.0.1:4173'
export async function signIn(page: Page, username = 'purchasing-administrator', secret = password) {
  await page.goto('/dashboard')
  await page.getByLabel('Usuario', { exact: true }).fill(username)
  await page.getByLabel('Contraseña', { exact: true }).fill(secret)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Bienvenida a H&D Boutique')
}
export async function command(page: Page, path: string, data: unknown, method = 'POST', key?: string) {
  // Session restoration rotates CSRF; wait for it before issuing a direct command.
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true, includeHidden: true })).toBeAttached()
  const csrf = await page.request.get('/api/v1/auth/csrf')
  const response = await page.request.fetch('/api/v1/' + path, { method, data, headers: { Origin: origin, 'X-CSRF-Token': (await csrf.json()).csrf_token, ...(key ? { 'Idempotency-Key': key } : {}) } })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true, includeHidden: true })).toBeAttached()
  return response
}
export async function capture(page: Page, info: TestInfo, name: string) {
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true, includeHidden: true })).toBeAttached()
  // Absence of a spinner can precede lazy mounting; require real page content first.
  await expect(page.locator('main section').first()).toBeAttached()
  await expect(page.getByText('Cargando pantalla…')).toHaveCount(0)
  await expect(page.getByText('Cargando información…')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath(name + '.png'), fullPage: await page.getByRole('dialog').count() === 0 })
}
export async function selectAddress(page: Page, department = '1') {
  const modal = page.getByRole('dialog').last()
  const response = await page.request.get('/api/v1/departments?limit=100')
  const name = (await response.json()).find((row: { department_id: number }) => String(row.department_id) === department).name
  await modal.getByLabel('Departamento', { exact: true }).click()
  await modal.getByRole('listbox', { name: 'Departamento' }).getByRole('option', { name, exact: true }).click()
  await modal.getByLabel('Municipio', { exact: true }).click()
  await modal.getByRole('listbox', { name: 'Municipio' }).getByRole('option').first().click()
  await modal.getByLabel('Dirección exacta').fill('Domicilio sintético para prueba aislada')
}
export async function customerFromSale(page: Page, delivery = false, info?: TestInfo) {
  await page.getByLabel('Tipo de cliente', { exact: true }).selectOption(delivery ? 'delivery' : 'regular')
  await page.getByRole('button', { name: '+ Registrar cliente' }).click()
  const modal = page.getByRole('dialog', { name: 'Nuevo cliente' })
  await modal.getByLabel('Nombres', { exact: true }).fill('Prueba')
  await modal.getByLabel('Apellidos', { exact: true }).fill(delivery ? 'Delivery' : 'Regular')
  if (delivery) { await modal.getByLabel('Teléfono', { exact: true }).fill('80000000'); await selectAddress(page) }
  if (info) {
    await capture(page, info, delivery ? 'customer-delivery-modal' : 'customer-regular-modal')
    await page.setViewportSize({ width: 390, height: 844 })
    await capture(page, info, delivery ? 'mobile-customer-delivery-modal' : 'mobile-customer-regular-modal')
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  await modal.getByRole('button', { name: 'Usar cliente en esta operación' }).click()
  await expect(modal).toHaveCount(0)
}
