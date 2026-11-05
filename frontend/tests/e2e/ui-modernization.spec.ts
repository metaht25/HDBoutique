import { expect, test } from '@playwright/test'
import { context, json, mockBoutique, openMenu, product, saleRow } from '../fixtures/boutique'

for (const role of ['Administrator', 'Cashier']) {
  test(`${role}: dashboard actions, receipts, period and responsive navigation`, async ({ page }, testInfo) => {
    await mockBoutique(page, role)
    await page.route('**/dashboard/overview?*', route => json(route, {
      context, summary: { today_amount: '115.00', today_count: 1, today_units: 1, month_amount: '115.00', month_count: 1, month_units: 1, low_stock: 1, period_amount: '115.00', period_count: 1 },
      recent_sales: [saleRow], low_stock: [product], period: new URL(route.request().url()).searchParams.get('period'),
      series: [{ date: '2026-10-30', amount: '0.00', count: 0 }, { date: '2026-10-31', amount: '0.00', count: 0 }, { date: '2026-11-01', amount: '115.00', count: 1 }],
    }))
    await page.goto('/dashboard')
    await expect(page.getByRole('button', { name: 'Recibo', exact: true })).toBeVisible()
    await expect(page.locator('body')).toHaveAttribute('data-role', role)
    await expect(page.getByRole('link', { name: 'Nueva venta', exact: true }).last()).toHaveAttribute('href', '/new-sale')
    await page.screenshot({ path: testInfo.outputPath(`${role}-dashboard.png`), fullPage: true })

    const monthlyRequest = page.waitForRequest(request => request.url().includes('dashboard/overview?period=month'))
    await page.getByRole('button', { name: 'Mensual', exact: true }).click()
    await monthlyRequest
    await expect(page.getByRole('button', { name: 'Mensual', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Recibo', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Cerrar ventana' }).click()

    for (const width of [1024, 768, 320]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      await openMenu(page)
      const nav = page.getByRole('navigation', { name: 'Navegación principal' })
      await expect(nav.getByRole('link')).toHaveCount(role === 'Administrator' ? 10 : 5)
      if (width === 320) {
        await page.screenshot({ path: testInfo.outputPath(`${role}-mobile-menu.png`), fullPage: true })
        await nav.getByRole('link', { name: 'Clientes', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Menú', exact: true })).toHaveAttribute('aria-expanded', 'false')
        await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeFocused()
      }
    }
  })
}

test('sign-in keeps labels, password visibility and keyboard focus on narrow screens', async ({ page }, testInfo) => {
  await page.route('**/api/v1/**', route => json(route, { error: { code: 'authentication_required', message: 'Inicia sesión' } }, 401))
  await page.goto('/dashboard')
  const username = page.getByRole('textbox', { name: 'Usuario', exact: true })
  await expect(username).toBeVisible()
  await expect(page.getByText('Tu día a día,', { exact: false })).toHaveCount(0)
  await expect(page.getByText('Un espacio de trabajo para la dueña y su equipo.', { exact: true })).toHaveCount(1)
  await username.fill('cuenta-sintetica')
  const password = page.getByLabel('Contraseña', { exact: true })
  await password.fill('Clave-sintetica-123')
  await password.press('Tab')
  await expect(page.getByRole('button', { name: 'Mostrar contraseña' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click()
  await expect(password).toHaveAttribute('type', 'password')
  await page.screenshot({ path: testInfo.outputPath('sign-in.png'), fullPage: true })
  await page.setViewportSize({ width: 320, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(username).toHaveCSS('transition-duration', '0s')
})
