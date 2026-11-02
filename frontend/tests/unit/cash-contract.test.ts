import { beforeEach, expect, it } from 'vitest'
import { parsePayment } from '../../src/features/cash-register/api'
import { readIntent, storeIntent } from '../../src/features/transactions/pending'

beforeEach(() => sessionStorage.clear())
it('preserves exact historical payments and rejects unsupported or malformed money', () => {
  const payment = { shift_id: 1, method: 'cash', amount: '1.00', received_amount: '2.00', change_amount: '1.00', reference: null }
  expect(parsePayment(payment).shift_id).toBe(1)
  expect(parsePayment({ ...payment, shift_id: null }).shift_id).toBeNull()
  expect(() => parsePayment({ ...payment, amount: 1 })).toThrow()
  expect(() => parsePayment({ method: 'card' })).toThrow()
})
it('recovers a manually confirmed transfer without converting its reference to a number', () => {
  const intent = { key: 'synthetic-transfer', body: { customer_id: 1, sale_date: '2026-10-29', payment: { method: 'transfer' as const, received_amount: '199.50', reference: '0000123', transfer_confirmed: true }, items: [{ product_id: 1, quantity: 1 }] } }
  storeIntent(3, 'sales', intent)
  expect(readIntent(3, 'sales')).toEqual(intent)
})
it('blocks old pending sales without inventing a payment or discarding their evidence', () => {
  const storageName = 'hdb.pending.v1.3.sales', text = JSON.stringify({ key: 'synthetic-old-sale', body: { customer_id: 1, sale_date: '2026-10-29', items: [{ product_id: 1, quantity: 1 }] } })
  sessionStorage.setItem(storageName, text)
  expect(() => readIntent(3, 'sales')).toThrow()
  expect(sessionStorage.getItem(storageName)).toBe(text)
})
it('preserves a historical shift field when recovering the exact sale command', () => {
  const intent = { key: 'historical-cash-command', body: { customer_id: 1, sale_date: '2026-10-29', payment: { shift_id: 7, method: 'cash' as const, received_amount: '199.50' }, items: [{ product_id: 1, quantity: 1 }] } }
  storeIntent(3, 'sales', intent)
  expect(readIntent(3, 'sales')).toEqual(intent)
})
