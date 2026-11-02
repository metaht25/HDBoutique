import { apiClient } from '../../shared/api/client'
import { allOptions, nullableText, parseList, positiveId, record, requiredText } from '../../shared/api/validation'

export interface Customer { customer_id: number;
  first_names: string; last_names: string; phone_number: string; address_id: number; customer_type_id: number
}
export interface CustomerType { customer_type_id: number; name: string | null }
export interface Address { address_id: number; department_id: number; address_line: string | null }
export interface Department { department_id: number; name: string }
export interface CustomerOptions { types: CustomerType[]; addresses: Address[]; departments: Department[] }

export function parseCustomer(value: unknown): Customer {
  const row = record(value)
  return { customer_id: positiveId(row.customer_id), address_id: positiveId(row.address_id),
    customer_type_id: positiveId(row.customer_type_id), first_names: requiredText(row.first_names),
    last_names: requiredText(row.last_names), phone_number: requiredText(row.phone_number) }
}
export async function listCustomers(page: number, query: string, signal?: AbortSignal): Promise<Customer[]> {
  const params = new URLSearchParams({ offset: String((page - 1) * 20), limit: '21' })
  if (query) params.set('q', query)
  return parseList(await apiClient.request(`/api/v1/customers?${params}`, { signal }), parseCustomer)
}
export async function customerOptions(includeLocations: boolean, signal: AbortSignal): Promise<CustomerOptions> {
  const types = allOptions(offset => apiClient.request(`/api/v1/customer-types?offset=${offset}&limit=100`, { signal })
    .then(body => parseList(body, value => {
      const row = record(value)
      return { customer_type_id: positiveId(row.customer_type_id), name: nullableText(row.name) }
    })), row => row.customer_type_id)
  if (!includeLocations) return { types: await types, addresses: [], departments: [] }
  const [loadedTypes, addresses, departments] = await Promise.all([types,
    allOptions(offset => apiClient.request(`/api/v1/addresses?offset=${offset}&limit=100`, { signal })
      .then(body => parseList(body, value => {
        const row = record(value)
        return { address_id: positiveId(row.address_id), department_id: positiveId(row.department_id),
          address_line: nullableText(row.address_line) }
      })), row => row.address_id),
    allOptions(offset => apiClient.request(`/api/v1/departments?offset=${offset}&limit=100`, { signal })
      .then(body => parseList(body, value => {
        const row = record(value)
        return { department_id: positiveId(row.department_id), name: requiredText(row.name) }
      })), row => row.department_id),
  ])
  return { types: loadedTypes, addresses, departments }
}
