import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { App } from '../../src/app/App'
import { SessionProvider } from '../../src/features/session/SessionProvider'
import { apiClient } from '../../src/shared/api/client'

const account = { user_id: 101, username: 'synthetic-cashier', display_name: 'Persona de prueba', role: 'Cashier', is_active: true, employee_id: 102 }
const context = { business_date: '2026-11-01', timezone: 'America/Managua' }
function mockBackend(options: { authenticated?: boolean; administrator?: boolean; productError?: boolean; suppliers?: number; temporary?: boolean } = {}) {
  const mock = vi.fn<(input: RequestInfo | URL, options?: RequestInit) => Promise<Response>>(async input => {
    const path = String(input).split('?')[0], url = new URL(String(input), 'http://test')
    if (path === '/api/v1/auth/me') return Response.json(options.authenticated ? { ...account, role: options.administrator ? 'Administrator' : 'Cashier', must_change_password: options.temporary ?? false } : { error: { code: 'authentication_required', message: 'Authentication required' } }, { status: options.authenticated ? 200 : 401 })
    if (path === '/api/v1/auth/csrf') return Response.json({ csrf_token: 'synthetic-csrf' })
    if (options.productError && path === '/api/v1/reports/product-catalog') return Response.json({ error: { code: 'database_unavailable', message: 'Servicio de productos no disponible' } }, { status: 503 })
    if (path === '/api/v1/dashboard/overview') return Response.json({ context, summary: { today_amount: '0.00', today_count: 0, month_amount: '0.00', low_stock: 0 }, recent_sales: [], low_stock: [], period: 'week' })
    const suppliers = Array.from({ length: options.suppliers ?? 0 }, (_, i) => ({ supplier_id: i + 1, company_name: 'Empresa ' + (i + 1), work_email: null, address_id: 1, address_line: 'Dirección sintética', department_id: 1, department_name: 'Departamento', municipality_id: 1, municipality_name: 'Municipio', contact_first_names: 'Contacto', contact_last_names: 'Prueba', phone_number: '0000000000', is_active: true }))
    const filtered = suppliers.filter(row => row.company_name.includes(url.searchParams.get('q') ?? '')), offset = Number(url.searchParams.get('offset') ?? 0)
    if (path?.startsWith('/api/v1/reports/')) return Response.json({ context, summary: { total_count: path.endsWith('supplier-directory') ? filtered.length : 0 }, items: path.endsWith('supplier-directory') ? filtered.slice(offset, offset + Number(url.searchParams.get('limit') ?? 20)) : [], offset, limit: 20, methods: [], best_products: [] })
    return Response.json([])
  })
  vi.stubGlobal('fetch', mock)
  return mock
}
function renderApp(path = '/dashboard') { return render(<MemoryRouter initialEntries={[path]}><SessionProvider><App /></SessionProvider></MemoryRouter>) }
beforeEach(() => { apiClient.clearCsrf(); sessionStorage.clear() })

it.each([
  ['/dashboard', 'Dashboard'], ['/new-sale', 'Nueva venta'], ['/sales', 'Ventas'],
  ['/sales-history', 'Historial de ventas'], ['/receipts', 'Recibos'], ['/products', 'Productos / Inventario'],
  ['/purchases', 'Compras'], ['/suppliers', 'Proveedores'], ['/customers', 'Clientes'], ['/employees', 'Empleados'],
])('loads owner route %s with its exact navigation and title', async (path, title) => {
  mockBackend({ authenticated: true, administrator: true }); renderApp(path)
  await screen.findByRole('heading', { level: 1, name: title })
  await waitFor(() => expect(screen.queryByText('Cargando pantalla…')).toBeNull(), { timeout: 5000 })
  const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
  expect(within(nav).getByRole('link', { name: title }).getAttribute('aria-current')).toBe('page')
  expect(within(nav).getAllByRole('link')).toHaveLength(10)
  await waitFor(() => expect(document.title).toBe(title + ' | H&D Boutique'))
  expect(within(nav).queryByText('Caja')).toBeNull()
  expect(within(nav).queryByText('Configuración')).toBeNull()
})

it('requires sign-in before requesting business data', async () => {
  const fetch = mockBackend(); renderApp('/products')
  await screen.findByRole('button', { name: 'Iniciar sesión' })
  expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).toBeNull()
  expect(fetch.mock.calls.every(([path]) => String(path).includes('/auth/'))).toBe(true)
})
it('scopes the collaborator navigation and preserves keyboard navigation', async () => {
  mockBackend({ authenticated: true }); const user = userEvent.setup(); renderApp()
  await screen.findByText('Persona de prueba')
  const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
  expect(within(nav).getAllByRole('link').map(link => link.textContent)).toEqual(['Inicio', 'Nueva venta', 'Productos', 'Clientes', 'Mis recibos'])
  await user.click(within(nav).getByRole('link', { name: 'Productos' }))
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Productos'))
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
  expect(screen.getByRole('link', { name: 'Saltar al contenido' }).getAttribute('href')).toBe('#main-content')
  expect(screen.queryByRole('button', { name: '+ Nuevo producto' })).toBeNull()
})
it('blocks a collaborator from mounting administrative queries', async () => {
  const fetch = mockBackend({ authenticated: true }); renderApp('/employees')
  await screen.findByText('Esta pantalla está disponible únicamente para la dueña.')
  expect(fetch.mock.calls.every(([path]) => !String(path).includes('employee-directory'))).toBe(true)
})
it('loads assigned-password accounts without a forced password form', async () => {
  const fetch = mockBackend({ authenticated: true, temporary: true }); renderApp('/new-sale')
  await screen.findByRole('heading', { level: 1, name: 'Nueva venta' })
  expect(fetch.mock.calls.some(([path]) => String(path).includes('/reports/product-catalog'))).toBe(true)
})
it('shows a useful product error after the lazy screen loads', async () => {
  mockBackend({ authenticated: true, productError: true }); renderApp('/products')
  await screen.findByRole('heading', { level: 1, name: 'Productos' })
  await waitFor(() => expect(screen.queryByText('Cargando pantalla…')).toBeNull(), { timeout: 5000 })
  expect((await screen.findAllByText('Servicio de productos no disponible')).length).toBeGreaterThan(0)
})
it('gives unknown authenticated URLs a return to the dashboard', async () => {
  mockBackend({ authenticated: true }); renderApp('/does-not-exist')
  await screen.findByRole('heading', { name: 'Página no encontrada', level: 2 })
  expect(screen.getByRole('link', { name: 'Ir al inicio' }).getAttribute('href')).toBe('/dashboard')
})
it('opens a labeled product modal and does not submit incomplete input', async () => {
  const fetch = mockBackend({ authenticated: true, administrator: true }); renderApp('/products')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: '+ Nuevo producto' }))
  const dialog = await screen.findByRole('dialog', { name: 'Nuevo producto' })
  expect(within(dialog).getByLabelText('Precio de venta (+15 %)').hasAttribute('readonly')).toBe(true)
  await user.click(within(dialog).getByRole('button', { name: 'Guardar producto' }))
  expect(fetch.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true)
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('paginates suppliers on the server and resets the page when filtering', async () => {
  mockBackend({ suppliers: 21, authenticated: true, administrator: true }); const user = userEvent.setup(); renderApp('/suppliers')
  await screen.findByText('Empresa 1')
  expect(screen.queryByText('Empresa 21')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Siguiente' }))
  await screen.findByText('Empresa 21')
  expect(screen.queryByText('Empresa 1')).toBeNull()
  await user.type(screen.getByRole('textbox', { name: 'Buscar' }), 'Empresa 1')
  await user.click(screen.getByRole('button', { name: 'Buscar' }))
  await screen.findByText('Empresa 1')
  expect(screen.getByRole('button', { name: 'Siguiente' }).hasAttribute('disabled')).toBe(true)
})
