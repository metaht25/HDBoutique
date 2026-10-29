import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function productsBackend(page: Page, options: { role?: string; anonymous?: boolean; rejectWrite?: boolean; many?: boolean; nullStock?: boolean } = {}) {
  const writes: { path: string; method: string; body: Record<string, unknown> }[] = []
  const requested: string[] = []
  let signedIn = !options.anonymous
  let products = Array.from({ length: options.many ? 21 : 1 }, (_, index) => ({
    product_id: index + 1, name: `Camisa ${index + 1}`, category_id: 104, size_id: 105,
    unit_price: '199.50', legacy_stock: options.nullStock ? null : 3, legacy_stock_quantity: 12 as number | null,
  }))
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    requested.push(path)
    if (path === '/api/v1/auth/me') return route.fulfill({ status: signedIn ? 200 : 401,
      json: signedIn ? { user_id: 1, username: 'synthetic-user', role: options.role ?? 'Manager', is_active: true, employee_id: null }
        : { error: { code: 'authentication_required', message: 'Inicia sesión' } } })
    if (path === '/api/v1/auth/csrf') return route.fulfill({ json: { csrf_token: 'test-csrf' } })
    if (path === '/api/v1/auth/login') {
      signedIn = true
      return route.fulfill({ json: { user_id: 1, username: 'synthetic-user', role: 'Manager', is_active: true, employee_id: null }, headers: { 'X-CSRF-Token': 'rotated-csrf' } })
    }
    if (path === '/api/v1/categories') return route.fulfill({ json: [{ category_id: 104, name: 'Ropa' }] })
    if (path === '/api/v1/sizes') return route.fulfill({ json: [{ size_id: 105, name: 'M' }] })
    if (path.startsWith('/api/v1/products')) {
      if (request.method() === 'GET') {
        const filtered = products.filter(row => row.name.toLowerCase().includes((url.searchParams.get('q') ?? '').toLowerCase()))
        const offset = Number(url.searchParams.get('offset') ?? 0)
        return route.fulfill({ json: filtered.slice(offset, offset + Number(url.searchParams.get('limit') ?? 50)) })
      }
      const body = request.postDataJSON() as Record<string, unknown>
      writes.push({ path, body, method: request.method() })
      expect(request.headers()['x-csrf-token']).toBeTruthy()
      expect(body).not.toHaveProperty('legacy_stock')
      expect(body).not.toHaveProperty('legacy_stock_quantity')
      if (options.rejectWrite) return route.fulfill({ status: 422, json: {
        error: { code: 'validation_error', message: 'Precio rechazado', fields: [{ location: ['body', 'unit_price'], type: 'decimal_max_places' }] },
      } })
      if (request.method() === 'POST') {
        const row = { ...products[0]!, ...body, product_id: 50, legacy_stock: 0, legacy_stock_quantity: null }
        products.push(row)
        return route.fulfill({ status: 201, json: row })
      }
      const id = Number(path.split('/').at(-1))
      products = products.map(row => row.product_id === id ? { ...row, ...body } : row)
      return route.fulfill({ json: products.find(row => row.product_id === id) })
    }
    return route.fulfill({ status: 404, json: { error: { code: 'not_found', message: 'Ruta no prevista' } } })
  })
  return { writes, requested }
}

test('product creation and editing persist exact money and preserve stock', async ({ page }) => {
  const api = await productsBackend(page)
  await page.goto('/products')
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Blusa nueva')
  await page.getByRole('textbox', { name: 'Precio unitario (NIO)' }).fill('199.50')
  await page.getByRole('combobox', { name: 'Categoría' }).selectOption('104')
  await page.getByRole('combobox', { name: 'Talla' }).selectOption('105')
  await page.getByRole('button', { name: 'Guardar producto' }).dblclick()
  await expect(page.getByText('Producto #50 guardado correctamente.')).toBeVisible()
  expect(api.writes).toHaveLength(1)
  expect(api.writes[0]?.body.unit_price).toBe('199.50')
  await page.reload()
  await expect(page.getByRole('cell', { name: 'Blusa nueva', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Editar producto 1', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Camisa editada')
  await page.getByRole('textbox', { name: 'Precio unitario (NIO)' }).fill('200.10')
  await page.getByRole('button', { name: 'Actualizar producto' }).click()
  await page.reload()
  const row = page.getByRole('row').filter({ hasText: 'Camisa editada' })
  await expect(row).toContainText('C$200.10')
  await expect(row.getByRole('cell', { name: '3', exact: true })).toBeVisible()
  expect(api.requested.some(path => path.startsWith('/api/productos/'))).toBe(false)
  await expect(page.getByRole('button', { name: /Desactivar|Activar/ })).toHaveCount(0)
})

test('Cashier only reads products and null stock stays unknown', async ({ page }) => {
  await productsBackend(page, { role: 'Cashier', nullStock: true })
  await page.goto('/products')
  await expect(page.getByRole('cell', { name: 'Sin conteo' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar producto' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Editar producto/ })).toHaveCount(0)
})

test('search and pagination query the server and survive URL reload', async ({ page }) => {
  const api = await productsBackend(page, { many: true })
  await page.goto('/products')
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByRole('cell', { name: 'Camisa 21', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/page=2/)
  await page.getByRole('searchbox', { name: 'Buscar producto' }).fill('Camisa 1')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page).toHaveURL(/page=1/)
  await page.reload()
  await expect(page.getByRole('cell', { name: 'Camisa 1', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Camisa 21', exact: true })).toHaveCount(0)
  expect(api.writes).toHaveLength(0)
})

test('field and backend rejections preserve the form without retrying writes', async ({ page }) => {
  const api = await productsBackend(page, { rejectWrite: true })
  await page.goto('/products')
  await page.getByRole('textbox', { name: 'Precio unitario (NIO)' }).fill('0.001')
  await page.getByRole('combobox', { name: 'Categoría' }).selectOption('104')
  await page.getByRole('combobox', { name: 'Talla' }).selectOption('105')
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await expect(page.getByRole('textbox', { name: 'Precio unitario (NIO)' })).toHaveAttribute('aria-invalid', 'true')
  expect(api.writes).toHaveLength(0)
  await page.getByRole('textbox', { name: 'Precio unitario (NIO)' }).fill('199.50')
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await expect(page.getByRole('alert')).toHaveText('Precio rechazado')
  await expect(page.getByRole('textbox', { name: 'Precio unitario (NIO)' })).toHaveValue('199.50')
  expect(api.writes).toHaveLength(1)
})

test('anonymous users sign in before any product data is requested', async ({ page }) => {
  const api = await productsBackend(page, { anonymous: true })
  await page.goto('/products')
  await expect(page.getByRole('heading', { name: 'Inicia sesión para continuar' })).toBeVisible()
  expect(api.requested).not.toContain('/api/v1/products')
  await page.getByRole('textbox', { name: 'Usuario', exact: true }).fill('synthetic-user')
  await page.getByLabel('Contraseña', { exact: true }).fill('Synthetic-password-27!')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Camisa 1', exact: true })).toBeVisible()
  expect(api.requested).toContain('/api/v1/products')
})
