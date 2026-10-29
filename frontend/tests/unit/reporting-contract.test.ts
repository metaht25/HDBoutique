import { expect, it } from 'vitest'
import { parseDashboard, parseReport, reportMoney } from '../../src/features/reports/api'
import { dashboardResponse, reportingResponse } from '../fixtures/reporting'

it('preserves aggregate money beyond a single sale limit without Number conversion', () => {
  const data = dashboardResponse()
  data.sales.total_amount = '9999999999999999.99'
  expect(parseDashboard(data).sales.total_amount).toBe('9999999999999999.99')
  expect(reportMoney(data.sales.total_amount)).toBe('C$9999999999999999.99')
  expect(reportMoney(null)).toBe('Sin determinar')
})
it.each([199.50, '199.5', 'NaN', '1e3'])('rejects malformed report money %s', amount => {
  const data = { ...dashboardResponse(), sales: { total_amount: amount, total_count: 1, legacy_count: 0 } }
  expect(() => parseDashboard(data)).toThrow()
})
it('preserves missing purchase amounts and separate unknown stock', () => {
  const purchase = parseReport('purchases', reportingResponse(new URL('http://test/api/v1/reports/purchases')))
  expect(purchase.kind === 'purchases' && purchase.items[0]?.total).toBeNull()
  const inventory = parseReport('inventory', reportingResponse(new URL('http://test/api/v1/reports/inventory')))
  expect(inventory.kind === 'inventory' && inventory.items[0]?.available_stock).toBeNull()
})
it('does not require staff fields for a Cashier dashboard', () => {
  expect(parseDashboard(dashboardResponse(false))).not.toHaveProperty('staff')
})
it('rejects invalid context and stock counts', () => {
  expect(() => parseDashboard({ ...dashboardResponse(), context: { timezone: 'UTC' } })).toThrow()
  expect(() => parseDashboard({ ...dashboardResponse(), product_count: -1 })).toThrow()
})
