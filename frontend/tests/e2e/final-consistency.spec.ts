import { expect, test } from '@playwright/test'
import { mockBoutique } from '../fixtures/boutique'

test('supplier card actions remain on one line at mobile and tablet widths', async ({ page }) => {
  await mockBoutique(page); await page.goto('/suppliers')
  const table = page.getByRole('table', { name: 'Directorio', exact: true })
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    for (const name of ['Ver detalle', 'Desactivar']) {
      const button = table.getByRole('button', { name, exact: true })
      await expect(button).toBeVisible()
      expect(await button.evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); return range.getClientRects().length })).toBe(1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
})

for (const role of ['Administrator', 'Cashier']) {
  test(`${role}: keyboard selection uses the active role palette`, async ({ page }) => {
    await mockBoutique(page, role); await page.goto('/new-sale')
    await page.getByLabel('Tipo de cliente', { exact: true }).selectOption('regular')
    const search = page.getByRole('combobox', { name: 'Seleccionar cliente', exact: true })
    await search.fill('Cliente'); await search.press('ArrowDown')
    const option = page.getByRole('option', { name: 'Cliente Prueba', exact: true })
    await expect(option).toHaveAttribute('aria-selected', 'true')
    const palette = await page.locator('body').evaluate(body => getComputedStyle(body).getPropertyValue('--soft').trim())
    const rgb = `rgb(${[1, 3, 5].map(offset => parseInt(palette.slice(offset, offset + 2), 16)).join(', ')})`
    await expect(option).toHaveCSS('background-color', rgb)
    await search.press('Enter'); await expect(search).toHaveValue('Cliente Prueba')
    await expect(page.getByRole('listbox')).toHaveCount(0)
  })
}

test('printed history omits the action header together with its interactive cells', async ({ page }) => {
  await mockBoutique(page); await page.goto('/sales-history')
  const table = page.getByRole('table', { name: 'Ventas', exact: true })
  await expect(table.getByRole('columnheader', { name: 'Acciones', exact: true })).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await expect(table.getByRole('columnheader', { name: 'Acciones', exact: true })).toBeHidden()
  await expect(table.getByRole('columnheader', { name: 'Total', exact: true })).toBeVisible()
  await expect(table.getByRole('button', { name: 'Ver', exact: true })).toBeHidden()
  await page.emulateMedia({ media: 'screen' })
  await table.getByRole('button', { name: 'Ver', exact: true }).click()
  const detail = page.getByRole('table', { name: 'Detalle de venta', exact: true })
  await expect(detail).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await expect(detail.getByRole('columnheader', { name: 'Subtotal', exact: true })).toBeVisible()
})
