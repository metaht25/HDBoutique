import { expect, test } from '@playwright/test'
import { mockBoutique } from '../fixtures/boutique'
test('profile is contextual and product catalogs remain available', async ({ page }) => {
  await mockBoutique(page); await page.goto('/products')
  await page.getByRole('button', { name: 'Dueña Mi perfil' }).click()
  await expect(page.getByRole('dialog', { name: 'Datos de la boutique' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Categorías' }).click()
  await expect(page.getByRole('dialog', { name: 'Catálogos de productos' })).toBeVisible()
  await page.keyboard.press('Escape')
})
