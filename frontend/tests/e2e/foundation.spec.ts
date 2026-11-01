import { expect, test } from '@playwright/test'
import { mockBoutique, openMenu } from '../fixtures/boutique'

test('owner navigation, all screens and responsive bounds', async ({ page }) => {
  await mockBoutique(page)
  for (const [path, title] of [['dashboard', 'Dashboard'], ['new-sale', 'Nueva venta'], ['sales', 'Ventas'], ['sales-history', 'Historial de ventas'], ['receipts', 'Recibos'], ['products', 'Productos / Inventario'], ['purchases', 'Compras'], ['suppliers', 'Proveedores'], ['customers', 'Clientes'], ['employees', 'Empleados']]) {
    await page.goto('/' + path); await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(page.getByText('Cargando pantalla…')).toHaveCount(0)
    await openMenu(page)
    await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link')).toHaveCount(10)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
})
test('collaborator navigation excludes administration and direct URLs are guarded', async ({ page }) => {
  await mockBoutique(page, 'Cashier'); await page.goto('/dashboard'); await openMenu(page)
  const nav = page.getByRole('navigation', { name: 'Navegación principal' })
  await expect(nav.getByRole('link')).toHaveText(['Inicio', 'Nueva venta', 'Productos', 'Clientes', 'Mis recibos'])
  await page.goto('/employees'); await expect(page.getByRole('alert')).toContainText('únicamente para la dueña')
})
