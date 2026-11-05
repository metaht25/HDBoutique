import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { PurchaseProductSelect, PurchaseSupplierSelect } from '../../src/features/boutique/PurchaseSelectors'
import type { Product, Supplier } from '../../src/features/boutique/contracts'

function ProductExample() {
  const [current, setCurrent] = useState<Product | null>(null)
  return <><PurchaseProductSelect supplierId="5" current={current} onChange={setCurrent} /><output aria-label="Selección">{current?.product_id ?? 'Ninguna'}</output></>
}
function SupplierExample() {
  const [current, setCurrent] = useState<Supplier | null>(null)
  return <><PurchaseSupplierSelect value={current ? String(current.supplier_id) : ''} current={current} onChange={setCurrent} /><output aria-label="Selección">{current?.supplier_id ?? 'Ninguna'}</output></>
}
function backend(resource: 'products' | 'suppliers') {
  const requests: URL[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://test'); requests.push(url)
    expect(url.searchParams.get('limit')).toBe('20')
    if (resource === 'products') expect(url.searchParams.get('supplier_id')).toBe('5')
    const name = resource === 'products' ? 'Producto' : 'Proveedor'
    const all = Array.from({ length: 125 }, (_, index) => ({
      ...(resource === 'products' ? { product_id: index + 1, name: `${name} ${index + 1}`, cost: '100.00', size_name: 'M' } : { supplier_id: index + 1, company_name: `${name} ${index + 1}`, is_active: index !== 124 }),
    })).filter(row => String('name' in row ? row.name : row.company_name).includes(url.searchParams.get('q') ?? ''))
    const offset = Number(url.searchParams.get('offset') ?? 0)
    return Response.json({ context: {}, summary: { total_count: all.length }, items: all.slice(offset, offset + 20), offset, limit: 20 })
  }))
  return requests
}

it('F04 pages beyond 100 products, searches on the server and keeps selection available', async () => {
  const requests = backend('products'), user = userEvent.setup()
  render(<ProductExample />)
  const input = screen.getByRole('combobox', { name: 'Producto' })
  await user.click(input)
  await screen.findByRole('option', { name: 'Producto 1' })
  const pages = screen.getByRole('group', { name: 'Páginas de Producto' })
  for (let page = 2; page <= 7; page++) {
    await user.click(within(pages).getByRole('button', { name: 'Siguiente' }))
    await screen.findByRole('option', { name: `Producto ${(page - 1) * 20 + 1}` })
  }
  await user.click(input); await user.keyboard('{Enter}')
  expect(screen.getByLabelText('Selección').textContent).toBe('121')
  expect((input as HTMLInputElement).value).toBe('Producto 121')
  await user.clear(input); await user.type(input, 'Producto 125')
  await screen.findByRole('option', { name: 'Producto 125' })
  await user.keyboard('{Enter}')
  expect(screen.getByLabelText('Selección').textContent).toBe('125')
  expect(requests.some(url => url.searchParams.get('offset') === '120')).toBe(true)
  expect(requests.some(url => url.searchParams.get('q') === 'Producto 125' && url.searchParams.get('offset') === '0')).toBe(true)
})

it('F04 history supplier search includes a supplier beyond 100 and preserves inactive historical choices', async () => {
  const requests = backend('suppliers'), user = userEvent.setup()
  render(<SupplierExample />)
  const input = screen.getByRole('combobox', { name: 'Proveedor' })
  await user.type(input, 'Proveedor 125')
  await user.click(await screen.findByRole('option', { name: 'Proveedor 125' }))
  expect(screen.getByLabelText('Selección').textContent).toBe('125')
  await user.tab()
  expect((input as HTMLInputElement).value).toBe('Proveedor 125')
  expect(requests.every(url => !url.searchParams.has('status'))).toBe(true)
})

it('F04 failed reads keep search usable and show the failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { code: 'database_unavailable', message: 'Synthetic unavailable' } }, { status: 503 })))
  render(<ProductExample />)
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudieron buscar productos'))
  expect(screen.getByRole('combobox', { name: 'Producto' })).toBeDefined()
})
