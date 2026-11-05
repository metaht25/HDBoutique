import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '../../src/shared/api/client'
import { ApiError } from '../../src/shared/api/errors'
import { useCashCommand } from '../../src/features/cash-register/useCashCommand'

beforeEach(() => sessionStorage.clear())
it.each([
  ['/api/v1/sales', 'checkout'], ['/api/v1/purchases', 'purchase'],
  ['/api/v1/purchases/suppliers', 'supplier'], ['/api/v1/purchases/7/receive', 'receive.7'],
  ['/api/v1/sales/7/void', 'void.7'],
])('recovers %s after an uncertain response, expired session and another account', async (path, operation) => {
  const request = vi.spyOn(apiClient, 'request')
    .mockRejectedValueOnce(new TypeError('Response lost after commit'))
    .mockRejectedValueOnce(new ApiError(401, 'authentication_required', 'Expired'))
    .mockResolvedValue({})
  const saved = vi.fn(), body = { synthetic: 'original immutable request' }
  const first = renderHook(() => useCashCommand(3, operation, saved))
  await act(async () => first.result.current.send(path, body))
  const original = request.mock.calls[0]
  await act(async () => first.result.current.send('', {}))
  expect(first.result.current.pending?.key).toBe(original![1]!.idempotencyKey)
  first.unmount()
  const other = renderHook(() => useCashCommand(4, operation, saved))
  expect(other.result.current.pending).toBeNull()
  expect(sessionStorage.getItem(`hdb.cash.v1.3.${operation}`)).not.toBeNull()
  other.unmount()
  const recovered = renderHook(() => useCashCommand(3, operation, saved))
  await act(async () => recovered.result.current.send('/api/v1/sales', { edited: true }))
  expect(request.mock.calls[2]).toEqual(original)
  expect(original![1]).toEqual(expect.objectContaining({ expectedUserId: 3 }))
  expect(saved).toHaveBeenCalledTimes(1)
  expect(sessionStorage.length).toBe(0)
})

it.each([401, 403, 408, 429, 500, 503])('preserves an unresolved intent on HTTP %s', async status => {
  vi.spyOn(apiClient, 'request').mockRejectedValue(new ApiError(status, 'synthetic_error', 'Unavailable'))
  const hook = renderHook(() => useCashCommand(3, 'checkout', vi.fn()))
  await act(async () => hook.result.current.send('/api/v1/sales', { original: true }))
  expect(hook.result.current.pending).not.toBeNull()
  expect(sessionStorage.getItem('hdb.cash.v1.3.checkout')).not.toBeNull()
})

it('does not discard an uncertain or restored operation after a later validation rejection', async () => {
  vi.spyOn(apiClient, 'request')
    .mockRejectedValueOnce(new TypeError('Response lost'))
    .mockRejectedValue(new ApiError(422, 'validation_error', 'Changed contract'))
  const hook = renderHook(() => useCashCommand(3, 'checkout', vi.fn()))
  await act(async () => hook.result.current.send('/api/v1/sales', { original: true }))
  const key = hook.result.current.pending!.key
  await act(async () => hook.result.current.send('', {}))
  expect(hook.result.current.pending!.key).toBe(key)
  hook.unmount()
  const restored = renderHook(() => useCashCommand(3, 'checkout', vi.fn()))
  await act(async () => restored.result.current.send('', {}))
  expect(restored.result.current.pending!.key).toBe(key)
})

it('blocks a hook reused with another account without moving the original intent', async () => {
  const request = vi.spyOn(apiClient, 'request').mockRejectedValue(new TypeError('Lost'))
  const hook = renderHook(({ userId }) => useCashCommand(userId, 'checkout', vi.fn()), { initialProps: { userId: 3 } })
  await act(async () => hook.result.current.send('/api/v1/sales', { original: true }))
  hook.rerender({ userId: 4 })
  await act(async () => hook.result.current.send('', {}))
  expect(request).toHaveBeenCalledTimes(1)
  expect(hook.result.current.blocked).toBe(true)
  expect(sessionStorage.getItem('hdb.cash.v1.4.checkout')).toBeNull()
  expect(sessionStorage.getItem('hdb.cash.v1.3.checkout')).not.toBeNull()
})

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
