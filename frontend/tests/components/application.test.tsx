import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { App } from '../../src/app/App'
import { SessionProvider } from '../../src/features/session/SessionProvider'
import { apiClient } from '../../src/shared/api/client'

const account = { user_id: 101, username: 'synthetic-cashier', role: 'Cashier', is_active: true, employee_id: 102 }

function mockBackend(options: { authenticated?: boolean; productError?: boolean; suppliers?: number } = {}) {
  const mock = vi.fn<(input: RequestInfo | URL, options?: RequestInit) => Promise<Response>>(async input => {
    const path = String(input)
    if (path === '/api/v1/auth/me') return new Response(JSON.stringify(options.authenticated ? account : {
      error: { code: 'authentication_required', message: 'Authentication required' },
    }), { status: options.authenticated ? 200 : 401 })
    if (path === '/api/v1/auth/csrf') return new Response(JSON.stringify({ csrf_token: 'synthetic-csrf' }))
    if (options.productError && path === '/api/productos/productos/') return new Response(JSON.stringify({
      error: { code: 'database_unavailable', message: 'Servicio de productos no disponible' },
    }), { status: 503 })
    const body = path === '/api/proveedores/proveedores/' ? Array.from({ length: options.suppliers ?? 0 }, (_, i) => ({
      id_proveedor: i + 1, nombreempresa: `Empresa ${i + 1}`, correoprofesional: null,
    })) : []
    return new Response(JSON.stringify(body))
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

function renderApp(path = '/dashboard') {
  return render(<MemoryRouter initialEntries={[path]}><SessionProvider><App /></SessionProvider></MemoryRouter>)
}

beforeEach(() => { apiClient.clearCsrf() })

it.each([
  ['/dashboard', 'Dashboard'], ['/products', 'Productos'], ['/customers', 'Clientes'],
  ['/sales', 'Ventas'], ['/purchases', 'Compras'], ['/suppliers', 'Proveedores'],
  ['/cash-register', 'Caja'], ['/reports', 'Reportes'],
])('loads %s directly with its title and active navigation', async (path, title) => {
  mockBackend()
  renderApp(path)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title)
  await screen.findByText('Sin sesión')
  await waitFor(() => expect(screen.queryByText('Cargando pantalla…')).toBeNull(), { timeout: 5000 })
  expect(document.title).toBe(`${title} | H&D Boutique`)
  const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
  expect(within(nav).getByRole('link', { name: title }).getAttribute('aria-current')).toBe('page')
})

it('navigates with links, moves the heading focus and retains a skip link', async () => {
  mockBackend()
  const user = userEvent.setup()
  renderApp()
  await screen.findByText('Sin sesión')
  await user.click(screen.getByRole('link', { name: 'Productos' }))
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Productos'))
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
  expect(screen.getByRole('link', { name: 'Saltar al contenido' }).getAttribute('href')).toBe('#main-content')
})

it('shows the account from the authenticated server session instead of a fixed administrator', async () => {
  mockBackend({ authenticated: true })
  renderApp()
  await screen.findByText('synthetic-cashier · Caja')
  expect(screen.queryByText('Usuario administrador')).toBeNull()
})

it('renders backend errors in the existing product screen', async () => {
  mockBackend({ productError: true })
  renderApp('/products')
  await screen.findByText('Servicio de productos no disponible')
  expect(screen.getByRole('alert').textContent).toContain('Servicio de productos no disponible')
})

it('gives unknown URLs a recoverable not-found screen', async () => {
  mockBackend()
  renderApp('/does-not-exist')
  await screen.findByRole('heading', { name: 'Página no encontrada', level: 2 })
  expect(screen.getByRole('link', { name: 'Ir al inicio' }).getAttribute('href')).toBe('/dashboard')
})

it('exposes linked field errors without sending an invalid product', async () => {
  const fetchMock = mockBackend()
  renderApp('/products')
  const submit = await screen.findByRole('button', { name: 'Guardar producto' })
  await userEvent.setup().click(submit)
  const field = screen.getByRole('textbox', { name: 'Nombre' })
  expect(field.getAttribute('aria-invalid')).toBe('true')
  expect(document.getElementById(field.getAttribute('aria-describedby') ?? '')?.textContent)
    .toBe('El nombre del producto es obligatorio.')
  expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true)
})

it('paginates the loaded supplier list and resets when filtering', async () => {
  mockBackend({ suppliers: 21 })
  const user = userEvent.setup()
  renderApp('/suppliers')
  await screen.findByText('Página 1 de 2')
  expect(screen.queryByText('Empresa 21')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Siguiente' }))
  await screen.findByText('Empresa 21')
  expect(screen.queryByText('Empresa 1')).toBeNull()
  await user.type(screen.getByRole('searchbox', { name: 'Buscar proveedor' }), 'Empresa 1')
  await screen.findByText('Empresa 1')
  expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull()
})
