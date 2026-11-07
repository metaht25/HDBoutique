import { expect, test } from '@playwright/test'
import { mockBoutique } from '../fixtures/boutique'

function luminance(color: string) {
  const channels = color.match(/\d+/g)!.slice(0, 3).map(value => {
    const channel = Number(value) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return channels.reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index]!, 0)
}

for (const role of ['Administrator', 'Cashier']) {
  test(`${role}: search placeholders remain readable against the field background`, async ({ page }) => {
    await mockBoutique(page, role); await page.goto('/new-sale')
    const input = page.getByRole('textbox', { name: 'Buscar producto', exact: true })
    await expect(input).toHaveAttribute('placeholder', /.+/)
    const colors = await input.evaluate(node => ({ foreground: getComputedStyle(node, '::placeholder').color, background: getComputedStyle(node).backgroundColor }))
    const foreground = luminance(colors.foreground), background = luminance(colors.background)
    expect((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)).toBeGreaterThanOrEqual(4.5)
  })
}
