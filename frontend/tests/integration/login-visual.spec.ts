import { expect, test } from '@playwright/test'

test('login remains accessible and responsive at desktop, tablet and mobile sizes', async ({ page }, info) => {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844]] as const) {
    await page.setViewportSize({ width, height }); await page.goto('/dashboard')
    await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByLabel('Contraseña', { exact: true }).fill('synthetic-visibility')
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: 'Ocultar contraseña' }).click()
    await page.getByLabel('Contraseña', { exact: true }).clear()
    await page.getByLabel('Usuario', { exact: true }).focus(); await page.keyboard.press('Tab')
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeFocused()
    await page.screenshot({ path: info.outputPath('login-' + name + '.png'), fullPage: true })
  }
})
