import { beforeEach, expect, it } from 'vitest'
import { parsePayment, parseShift } from '../../src/features/cash-register/api'
import { readIntent, storeIntent } from '../../src/features/transactions/pending'
import { shift } from '../fixtures/transactions'

beforeEach(() => sessionStorage.clear())
it('preserves exact reconciliation and rejects unsupported or malformed payments', () => {
  expect(parseShift({ ...shift, difference: '-0.01', counted_amount: '999.99' }).difference).toBe('-0.01')
  expect(() => parseShift({ ...shift, expected_amount: 1000 })).toThrow()
  expect(() => parsePayment({ method: 'card' })).toThrow()
})
it('recovers a manually confirmed transfer without converting its reference to a number', () => {
  const intent = { key: 'synthetic-transfer', body: { customer_id: 1, sale_date: '2026-10-29', payment: { shift_id: 2, method: 'transfer' as const, received_amount: '199.50', reference: '0000123', transfer_confirmed: true }, items: [{ product_id: 1, quantity: 1 }] } }
  storeIntent(3, 'sales', intent)
  expect(readIntent(3, 'sales')).toEqual(intent)
})
it('blocks old pending sales without inventing a payment or discarding their evidence', () => {
  const storageName = 'hdb.pending.v1.3.sales', text = JSON.stringify({ key: 'synthetic-old-sale', body: { customer_id: 1, sale_date: '2026-10-29', items: [{ product_id: 1, quantity: 1 }] } })
  sessionStorage.setItem(storageName, text)
  expect(() => readIntent(3, 'sales')).toThrow()
  expect(sessionStorage.getItem(storageName)).toBe(text)
})
