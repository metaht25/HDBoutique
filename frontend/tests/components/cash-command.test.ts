import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '../../src/shared/api/client'
import { ApiError } from '../../src/shared/api/errors'
import { useCashCommand } from '../../src/features/cash-register/useCashCommand'

beforeEach(() => sessionStorage.clear())
it('recovers an uncertain cash operation across reload without changing its body or key', async () => {
  const request = vi.spyOn(apiClient, 'request').mockRejectedValueOnce(new TypeError('Synthetic lost response')).mockResolvedValue({})
  const saved = vi.fn(), path = '/api/v1/cash/shifts', body = { employee_id: 1, opening_amount: '1000.00' }
  const first = renderHook(() => useCashCommand(3, 'register', saved))
  await act(async () => first.result.current.send(path, body))
  expect(first.result.current.pending?.body).toEqual(body)
  const original = request.mock.calls[0]
  first.unmount()
  const other = renderHook(() => useCashCommand(4, 'register', saved))
  expect(other.result.current.pending).toBeNull()
  other.unmount()
  const recovered = renderHook(() => useCashCommand(3, 'register', saved))
  await act(async () => recovered.result.current.send('/api/v1/cash/shifts/99/close', { counted_amount: '0.00' }))
  expect(request.mock.calls[1]).toEqual(original)
  expect(saved).toHaveBeenCalledTimes(1)
  expect(sessionStorage.length).toBe(0)
})
it('permits correcting a rejected cash count while preserving uncertain server failures', async () => {
  vi.spyOn(apiClient, 'request').mockRejectedValueOnce(new ApiError(422, 'reason_required', 'Reason required')).mockRejectedValueOnce(new ApiError(503, 'database_unavailable', 'Unavailable'))
  const hook = renderHook(() => useCashCommand(3, 'register', vi.fn()))
  await act(async () => hook.result.current.send('/api/v1/cash/shifts/1/close', { counted_amount: '1.00' }))
  expect(hook.result.current.pending).toBeNull()
  await act(async () => hook.result.current.send('/api/v1/cash/shifts/1/close', { counted_amount: '1.00', reason: 'Synthetic' }))
  expect(hook.result.current.pending).not.toBeNull()
})
