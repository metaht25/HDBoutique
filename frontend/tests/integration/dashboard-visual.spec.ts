import { expect, test } from '@playwright/test'
import { capture, signIn } from './helpers'

test('weekly and monthly charts keep readable labels on desktop and mobile', async ({ page }, info) => {
  await signIn(page)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    for (const period of ['Semanal', 'Mensual']) {
      await page.getByRole('button', { name: period, exact: true }).click()
      await expect(page.getByRole('img', { name: 'Evolución de ventas' })).toBeVisible()
      await expect(page.getByRole('img', { name: 'Cantidad de ventas' })).toBeVisible()
      await capture(page, info, `charts-${width}-${period}`)
    }
  }
})
