import { expect, test } from '@playwright/test'
import { mockBoutique } from '../fixtures/boutique'
test('inclusive filters are sent to the server and the receipt has a dedicated print surface', async ({ page }) => {
  await mockBoutique(page); await page.goto('/sales-history')
  await page.getByLabel('Desde', { exact: true }).fill('2026-11-01'); await page.getByLabel('Hasta', { exact: true }).fill('2026-11-01')
  const request = page.waitForRequest(req => req.url().includes('sales-ledger') && req.url().includes('start_date='))
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  const url = new URL((await request).url()); expect(url.searchParams.get('start_date')).toBe('2026-11-01'); expect(url.searchParams.get('end_date')).toBe('2026-11-01')
  await page.getByRole('button', { name: 'Recibo', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Vista previa del recibo' })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Ticket de 80 mm' })).toBeVisible()
  await page.emulateMedia({ media: 'print' }); await expect(page.locator('#receipt-print')).toBeVisible()
  expect(await page.locator('#receipt-print').evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(302)
})
