import { expect, it, vi } from 'vitest'
import { apiClient } from '../../src/shared/api/client'
import { parseAccount, parseAccountRecord, parseCatalog, preparationStatus, preparationSteps } from '../../src/features/settings/api'

it('preserves nullable catalog labels and exact decimal costs', () => {
  expect(parseCatalog('categories', { category_id: 1, name: null })).toEqual({ id: 1, text: null })
  expect(parseCatalog('addresses', { address_id: 2, department_id: 1, address_line: null })).toEqual({ id: 2, text: null, department_id: 1 })
  expect(parseCatalog('supplier-products', { supplier_product_id: 3, product_id: 2, purchase_price: '120.50' })).toEqual({ id: 3, text: '120.50', product_id: 2 })
  expect(() => parseCatalog('supplier-products', { supplier_product_id: 3, product_id: 2, purchase_price: 120.5 })).toThrow()
  expect(() => parseCatalog('supplier-offerings', { offering_id: 1, supplier_id: 2, supplier_product_id: null })).toThrow()
})
it('validates account responses and only retains public fields', () => {
  const account = { user_id: 1, username: 'synthetic', role: 'Administrator', is_active: true, employee_id: null }
  expect(parseAccount({ ...account, password_hash: 'discarded' })).toEqual(account)
  expect(() => parseAccount({ ...account, role: 'owner' })).toThrow()
  expect(() => parseAccount({ ...account, employee_id: 0 })).toThrow()
})
it('does not mark failed preparation reads as missing data', async () => {
  const request = vi.spyOn(apiClient, 'request').mockImplementation(async path => {
    if (path.includes('/addresses?')) throw new Error('unavailable')
    return []
  })
  try { await expect(preparationStatus(new AbortController().signal)).rejects.toThrow('unavailable') }
  finally { request.mockRestore() }
})
it('checks presence independently with bounded reads', async () => {
  const request = vi.spyOn(apiClient, 'request').mockImplementation(async path => path.includes('/sizes?') ? [{ size_id: 1 }] : [])
  try {
    const statuses = await preparationStatus(new AbortController().signal)
    expect(statuses).toHaveLength(preparationSteps.length)
    expect(statuses.filter(Boolean)).toHaveLength(1)
    expect(request.mock.calls.every(([path]) => path.endsWith('offset=0&limit=1'))).toBe(true)
  } finally { request.mockRestore() }
})

it('preserves retired account history without accepting it as a session', () => {
  const retired = { user_id: 3, username: 'retired', role: 'Manager', is_active: false, employee_id: null }
  expect(parseAccountRecord(retired)).toEqual(retired)
  expect(() => parseAccount(retired)).toThrow()
})
