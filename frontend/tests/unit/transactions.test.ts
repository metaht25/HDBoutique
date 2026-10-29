import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '../../src/shared/api/client'
import { ApiError } from '../../src/shared/api/errors'
import { parseTransaction, registerTransaction } from '../../src/features/transactions/api'
import { clearIntent, isDefinitiveRejection, readIntent, storeIntent } from '../../src/features/transactions/pending'
import { purchase, sale } from '../fixtures/transactions'

beforeEach(() => { sessionStorage.clear() })
const intent = { key: 'synthetic-intent-123', body: { customer_id: 108, employee_id: 102, sale_date: '2026-10-28', items: [{ product_id: 109, quantity: 1 }] } }

it('keeps one immutable intent across remounts scoped to account and operation', () => {
  storeIntent(1, 'sales', intent)
  expect(readIntent(1, 'sales')).toEqual(intent)
  expect(readIntent(2, 'sales')).toBeNull()
  expect(readIntent(1, 'purchases')).toBeNull()
  clearIntent(1, 'sales')
  expect(readIntent(1, 'sales')).toBeNull()
})
it('does not silently discard an unreadable pending operation', () => {
  sessionStorage.setItem('hdb.pending.v1.1.sales', 'broken')
  expect(() => readIntent(1, 'sales')).toThrow()
  expect(sessionStorage.getItem('hdb.pending.v1.1.sales')).toBe('broken')
})
it('keeps uncertain outcomes and session races pending, while allowing correction of business rejections', () => {
  expect(isDefinitiveRejection(new TypeError('Network'))).toBe(false)
  expect(isDefinitiveRejection(new ApiError(503, 'database_unavailable', 'Unavailable'))).toBe(false)
  expect(isDefinitiveRejection(new ApiError(409, 'session_changed', 'Changed'))).toBe(false)
  expect(isDefinitiveRejection(new ApiError(409, 'insufficient_stock', 'Stock'))).toBe(true)
})
it('sends the entire sale once with its request key and no client prices or total', async () => {
  const request = vi.spyOn(apiClient, 'request').mockResolvedValue(sale)
  await registerTransaction('sales', intent.body, intent.key)
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/v1/sales', { method: 'POST', body: intent.body, idempotencyKey: intent.key })
})
it('preserves historical money and distinguishes missing purchase costs', () => {
  expect(parseTransaction('sales', sale).items[0]?.unit_price).toBe('199.50')
  expect(parseTransaction('purchases', { ...purchase, total: null, merchandise_total: null,
    items: [{ ...purchase.items[0], unit_cost: null, subtotal: null, product_id: null }] }).total).toBeNull()
  expect(() => parseTransaction('sales', { ...sale, total: 199.5 })).toThrow()
})
