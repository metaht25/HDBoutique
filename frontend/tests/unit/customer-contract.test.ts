import { expect, it, vi } from 'vitest'
import { customerOptions, parseCustomer } from '../../src/features/customers/api'
import { apiClient } from '../../src/shared/api/client'

const customer = { customer_id: 1, address_id: 3, customer_type_id: 2,
  first_names: 'Cliente', last_names: 'Sintético', phone_number: '0012345678' }

it('preserves textual phone numbers with leading zeroes and existing references', () => {
  expect(parseCustomer(customer)).toEqual(customer)
})
it.each([{ ...customer, phone_number: 12345678 }, { ...customer, first_names: null },
  { ...customer, customer_type_id: '2' }, { ...customer, address_id: 0 }])('rejects malformed customer responses', value => {
  expect(() => parseCustomer(value)).toThrow()
})
it('Cashier loads customer types without requesting any locations', async () => {
  const request = vi.spyOn(apiClient, 'request').mockResolvedValue([{ customer_type_id: 2, name: null }])
  expect(await customerOptions(false, new AbortController().signal)).toEqual({
    types: [{ customer_type_id: 2, name: null }], addresses: [], departments: [],
  })
  expect(request).toHaveBeenCalledTimes(1)
  expect(request.mock.calls[0]?.[0]).toBe('/api/v1/customer-types?offset=0&limit=100')
})
