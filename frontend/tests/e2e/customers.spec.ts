import { expect, test } from '@playwright/test'
import { mockBoutique } from '../fixtures/boutique'
test('regular and delivery customer modals expose the right mandatory fields', async ({ page }) => {
  await mockBoutique(page, 'Cashier'); await page.goto('/customers'); await page.getByRole('button', { name: '+ Nuevo cliente' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo cliente' })
  await expect(dialog.getByLabel('Teléfono', { exact: true })).not.toHaveAttribute('required', '')
  await dialog.getByLabel('Tipo de cliente').selectOption('delivery')
  await expect(dialog.getByLabel('Teléfono', { exact: true })).toHaveAttribute('required', '')
  await dialog.getByLabel('Departamento', { exact: true }).selectOption('1')
  await dialog.getByLabel('Municipio', { exact: true }).selectOption('1')
  await expect(dialog.getByLabel('Dirección exacta')).toHaveAttribute('required', '')
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: '+ Nuevo cliente' })).toBeFocused()
})
