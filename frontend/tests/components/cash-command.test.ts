import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '../../src/shared/api/client'
import { ApiError } from '../../src/shared/api/errors'
import { useCashCommand } from '../../src/features/cash-register/useCashCommand'

beforeEach(() => sessionStorage.clear())
it.each(['/api/v1/purchases', '/api/v1/purchases/suppliers'])('recovers uncertain %s across reload without changing its body or key', async path => {
  const request = vi.spyOn(apiClient, 'request').mockRejectedValueOnce(new TypeError('Synthetic lost response')).mockResolvedValue({})
  const saved = vi.fn(), body = { employee_id: 1, supplier_id: 2, items: [{ product_id: 3, unit_cost: '1.00', quantity: 1 }] }
  const first = renderHook(() => useCashCommand(3, 'register', saved))
  await act(async () => first.result.current.send(path, body))
  expect(first.result.current.pending?.body).toEqual(body)
  const original = request.mock.calls[0]
  first.unmount()
  const other = renderHook(() => useCashCommand(4, 'register', saved))
  expect(other.result.current.pending).toBeNull()
  other.unmount()
  const recovered = renderHook(() => useCashCommand(3, 'register', saved))
  await act(async () => recovered.result.current.send('/api/v1/purchases/99/receive', { employee_id: 2 }))
  expect(request.mock.calls[1]).toEqual(original)
  expect(saved).toHaveBeenCalledTimes(1)
  expect(sessionStorage.length).toBe(0)
})
it('permits correcting a rejected refund while preserving uncertain server failures', async () => {
  vi.spyOn(apiClient, 'request').mockRejectedValueOnce(new ApiError(422, 'invalid_return', 'Invalid return')).mockRejectedValueOnce(new ApiError(503, 'database_unavailable', 'Unavailable'))
  const hook = renderHook(() => useCashCommand(3, 'register', vi.fn()))
  await act(async () => hook.result.current.send('/api/v1/sales/1/void', { items: [] }))
  expect(hook.result.current.pending).toBeNull()
  await act(async () => hook.result.current.send('/api/v1/sales/1/void', { items: [], reason: 'Synthetic' }))
  expect(hook.result.current.pending).not.toBeNull()
})

it('blocks a retired shift intent without deleting its evidence or calling the API', async () => {
  const value = JSON.stringify({ path: '/api/v1/cash/shifts', body: { employee_id: 1, opening_amount: '0.00' }, key: 'historical-intent' })
  sessionStorage.setItem('hdb.cash.v1.3.checkout', value)
  const request = vi.spyOn(apiClient, 'request')
  const hook = renderHook(() => useCashCommand(3, 'checkout', vi.fn()))
  expect(hook.result.current.blocked).toBe(true)
  await act(async () => hook.result.current.send('/api/v1/sales', {}))
  expect(request).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('hdb.cash.v1.3.checkout')).toBe(value)
})
