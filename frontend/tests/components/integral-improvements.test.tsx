import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { App } from '../../src/app/App'
import { SessionProvider } from '../../src/features/session/SessionProvider'
import { apiClient } from '../../src/shared/api/client'
import { PartyForm } from '../../src/features/boutique/PartyForm'

const context = { business_date: '2026-11-03', timezone: 'America/Managua' }
const product = { product_id: 1, name: 'Synthetic blouse', category_id: 1, size_id: 1, size_name: 'M', unit_price: '379.50', cost: '330.00', legacy_stock: 5, is_active: true }
function setup(path: string) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://test')
    if (url.pathname.endsWith('auth/me')) return Response.json({ user_id: 5, username: 'synthetic-owner', role: 'Administrator', employee_id: 1, is_active: true })
    if (url.pathname.endsWith('auth/csrf')) return Response.json({ csrf_token: 'synthetic-csrf' })
    if (url.pathname.endsWith('dashboard/overview')) return Response.json({ context, period: url.searchParams.get('period'), summary: { today_count: 1 }, recent_sales: [], low_stock: [], series: [{ date: '2026-11-03', amount: '379.50', count: 1 }] })
    if (url.pathname.endsWith('product-catalog')) return Response.json({ context, summary: { total_count: 1 }, items: [product] })
    if (url.pathname.includes('reports/')) return Response.json({ context, summary: { total_count: 0 }, items: [] })
    return Response.json([])
  })
  vi.stubGlobal('fetch', fetch)
  render(<MemoryRouter initialEntries={[path]}><SessionProvider><App /></SessionProvider></MemoryRouter>)
  return fetch
}
beforeEach(() => { apiClient.clearCsrf(); sessionStorage.clear() })

it('keeps only names for a regular customer and uses a fixed job title for new employees', async () => {
  const view = render(<PartyForm kind="customers" onDraft={vi.fn()} onSaved={vi.fn()} onClose={vi.fn()} />)
  expect(screen.getByLabelText('Nombres')).toBeTruthy()
  for (const label of ['Teléfono', 'Departamento', 'Municipio', 'Dirección exacta']) expect(screen.queryByLabelText(label)).toBeNull()
  view.unmount()
  vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
  render(<PartyForm kind="employees" onSaved={vi.fn()} onClose={vi.fn()} />)
  const title = screen.getByLabelText('Cargo') as HTMLInputElement
  expect(title.value).toBe('Vendedor'); expect(title.readOnly).toBe(true)
})

it('derives both mixed payment components, preserves input and recalculates when totals change', async () => {
  setup('/new-sale'); const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: '+ Agregar' }, { timeout: 5000 }))
  expect(screen.queryByLabelText('Responsable de venta')).toBeNull()
  await user.selectOptions(screen.getByLabelText('Método de pago'), 'mixed')
  const transfer = screen.getByLabelText('Monto transferido (NIO)') as HTMLInputElement
  const cash = screen.getByLabelText('Efectivo a aplicar (NIO)') as HTMLInputElement
  await user.type(transfer, '300.'); expect(transfer.value).toBe('300.'); expect(cash.value).toBe('79.50')
  await user.type(screen.getByLabelText('Efectivo recibido (NIO)'), '80.00')
  expect(screen.getByText('Cambio:').textContent).toContain('0.50')
  await user.clear(cash); await user.type(cash, '100.00')
  expect(transfer.value).toBe('279.50')
  await user.click(screen.getByRole('button', { name: 'Aumentar Synthetic blouse' }))
  expect(cash.value).toBe('100.00'); expect(transfer.value).toBe('659.00')
  expect(screen.getByLabelText('Referencia de transferencia (opcional)').hasAttribute('required')).toBe(false)
})

it('removes redundant access and profile controls while keeping locations only in employees', async () => {
  setup('/employees')
  await screen.findByRole('button', { name: '+ Nuevo empleado' }, { timeout: 5000 })
  expect(screen.getByRole('button', { name: 'Departamentos y municipios' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Cuentas y accesos' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Dueña/ })).toBeNull()
})

it('shows two API charts and requests monthly data from the period filter', async () => {
  const fetch = setup('/dashboard'), user = userEvent.setup()
  await screen.findByRole('img', { name: 'Evolución de ventas' }, { timeout: 5000 })
  expect(screen.getByRole('img', { name: 'Cantidad de ventas' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Anual' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Mensual' }))
  await waitFor(() => expect(fetch.mock.calls.some(([input]) => String(input).endsWith('period=month'))).toBe(true))
  expect(within(screen.getByRole('main')).getByRole('img', { name: 'Evolución de ventas' })).toBeTruthy()
})
