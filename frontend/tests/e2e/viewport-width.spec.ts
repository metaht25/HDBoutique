import { expect, test } from '@playwright/test'
import { json, mockBoutique } from '../fixtures/boutique'

for (const role of ['Administrator', 'Cashier']) {
  test(`${role}: screens fit the usable width of a narrow window with a scrollbar`, async ({ page }) => {
    await mockBoutique(page, role)
    // A 320px window with a classic 15px scrollbar leaves 305px for content.
    await page.setViewportSize({ width: 305, height: 900 })
    const paths = role === 'Administrator' ? ['dashboard', 'new-sale', 'sales', 'sales-history', 'receipts', 'products', 'purchases', 'suppliers', 'customers', 'employees'] : ['dashboard', 'new-sale', 'products', 'customers', 'receipts']
    for (const path of paths) {
      await page.goto('/' + path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByText('Cargando pantalla…', { exact: true })).toHaveCount(0)
      await expect(page.locator('main section').first()).toBeVisible()
      await expect(page.getByText('Cargando información…', { exact: true })).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), path).toBe(true)
    }
  })
}

test('sign-in fits the usable width of a narrow window with a scrollbar', async ({ page }) => {
  await page.route('**/api/v1/**', route => json(route, { error: { code: 'authentication_required', message: 'Inicia sesión' } }, 401))
  await page.setViewportSize({ width: 305, height: 900 }); await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
})
