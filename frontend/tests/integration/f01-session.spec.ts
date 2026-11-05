import { expect, test } from '@playwright/test'
import { origin, signIn } from './helpers'

interface StoredIntent { path: string; body: object; key: string }
interface SaleResult { sale_id: number; total: string; payment: { payment_id: number }; items: { sale_item_id: number }[] }

test('F01: a lost sale response survives session expiry and recovers only for its original account', async ({ page }) => {
  test.setTimeout(120000)
  await signIn(page)
  const actor = await (await page.request.get('/api/v1/auth/me')).json()
  const storageKey = `hdb.cash.v1.${actor.user_id}.checkout`
  const catalog = await (await page.request.get('/api/v1/reports/product-catalog?status=sellable&limit=100')).json()
  const product = catalog.items.find((row: { legacy_stock: number }) => row.legacy_stock >= 1)
  expect(product).toBeTruthy()
  const beforeSales = await (await page.request.get('/api/v1/sales?limit=100')).json()
  await page.goto('/new-sale')
  await page.getByLabel('Buscar producto', { exact: true }).fill(product.name)
  await page.getByRole('button', { name: 'Buscar productos', exact: true }).click()
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: product.name, exact: true }) }).first()
  await card.getByRole('button', { name: '+ Agregar', exact: true }).click()
  await page.getByLabel('Efectivo recibido (NIO)', { exact: true }).fill(product.unit_price)
  await page.getByLabel('Notas (opcional)', { exact: true }).fill('F01 synthetic regression')

  let committed: SaleResult | undefined
  let originalBody: object | undefined
  let originalKey: string | undefined
  await page.route('**/api/v1/sales', async route => {
    originalBody = route.request().postDataJSON()
    originalKey = route.request().headers()['idempotency-key']
    expect(route.request().headers()['x-idempotency-actor']).toBe(String(actor.user_id))
    const response = await route.fetch()
    expect(response.status()).toBe(201)
    committed = await response.json()
    // PostgreSQL has committed the sale/payment/stock; only its response is lost.
    await route.abort('failed')
  }, { times: 1 })
  await page.getByRole('button', { name: 'Finalizar venta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reintentar misma venta', exact: true })).toBeVisible()
  expect(committed).toBeTruthy()
  const stored = await page.evaluate(key => sessionStorage.getItem(key), storageKey)
  const intent: StoredIntent = JSON.parse(stored!)
  expect(intent.body).toEqual(originalBody)
  expect(intent.key).toBe(originalKey)

  // Simulate expiry of the browser's session cookie. Backend expiry is also
  // covered with an actual expired WebSession in the PostgreSQL HTTP tests.
  await page.context().clearCookies()
  const expired = page.waitForResponse(response => response.url().endsWith('/api/v1/sales') && response.status() === 401)
  await page.getByRole('button', { name: 'Reintentar misma venta', exact: true }).click()
  await expired
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible()
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBe(stored)

  await signIn(page, 'purchasing-cashier')
  const other = await (await page.request.get('/api/v1/auth/me')).json()
  await page.goto('/new-sale')
  await expect(page.getByRole('button', { name: 'Finalizar venta', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reintentar misma venta', exact: true })).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), `hdb.cash.v1.${other.user_id}.checkout`)).toBeNull()
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBe(stored)
  // A stale tab may still hold the original intention while its cookie has
  // changed accounts. The server must reject that replay, not attribute it to B.
  const csrf = await (await page.request.get('/api/v1/auth/csrf')).json()
  const wrongAccount = await page.request.post(intent.path, { data: intent.body, headers: {
    Origin: origin, 'X-CSRF-Token': csrf.csrf_token, 'Idempotency-Key': intent.key, 'X-Idempotency-Actor': String(actor.user_id),
  } })
  expect(wrongAccount.status()).toBe(409)
  expect((await wrongAccount.json()).error.code).toBe('session_changed')

  await page.context().clearCookies()
  await signIn(page)
  await page.goto('/new-sale')
  await expect(page.getByRole('button', { name: 'Reintentar misma venta', exact: true })).toBeVisible()
  const retry = page.waitForResponse(response => response.url().endsWith('/api/v1/sales') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Reintentar misma venta', exact: true }).click()
  const response = await retry
  expect(response.request().headers()['idempotency-key']).toBe(intent.key)
  expect(response.request().postDataJSON()).toEqual(intent.body)
  expect(response.status()).toBe(201)
  const recovered: SaleResult = await response.json()
  expect(recovered).toEqual(committed)
  await expect(page.getByRole('dialog', { name: '¡Venta completada!' })).toBeVisible()
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull()

  const afterSales = await (await page.request.get('/api/v1/sales?limit=100')).json()
  expect(afterSales).toHaveLength(beforeSales.length + 1)
  expect(afterSales.filter((row: SaleResult) => row.sale_id === recovered.sale_id)).toHaveLength(1)
  expect(afterSales.find((row: SaleResult) => row.sale_id === recovered.sale_id).payment.payment_id).toBe(committed!.payment.payment_id)
  const afterProduct = await (await page.request.get('/api/v1/products/' + product.product_id)).json()
  expect(afterProduct.legacy_stock).toBe(product.legacy_stock - 1)
  const movements = await (await page.request.get('/api/v1/inventory/movements?sale_id=' + recovered.sale_id)).json()
  expect(movements.filter((row: { movement_type: string }) => row.movement_type === 'sale_issue')).toHaveLength(1)
  console.log(JSON.stringify({ regression: 'F01', originalSale: committed!.sale_id, recoveredSale: recovered.sale_id,
    newSales: afterSales.length - beforeSales.length, stockDiscount: product.legacy_stock - afterProduct.legacy_stock,
    originalPayment: committed!.payment.payment_id, recoveredPayment: recovered.payment.payment_id }))
})
