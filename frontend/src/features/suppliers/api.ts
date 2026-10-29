import { apiClient } from '../../shared/api/client'
import { allOptions, nullableText, parseList, positiveId, record, requiredText } from '../../shared/api/validation'

export interface SupplierInput { address_id: number; company_name: string; contact_first_names: string; contact_last_names: string; phone_number: string; work_email: string | null }
export interface Supplier extends SupplierInput { supplier_id: number }
export interface AddressOption { address_id: number; address_line: string | null }
export function parseSupplier(value: unknown): Supplier {
  const row = record(value)
  return { supplier_id: positiveId(row.supplier_id), address_id: positiveId(row.address_id), company_name: requiredText(row.company_name),
    contact_first_names: requiredText(row.contact_first_names), contact_last_names: requiredText(row.contact_last_names),
    phone_number: requiredText(row.phone_number), work_email: nullableText(row.work_email) }
}
export async function listSuppliers(page: number, signal: AbortSignal, query = '') {
  return parseList(await apiClient.request(`/api/v1/suppliers?offset=${(page - 1) * 20}&limit=21&q=${encodeURIComponent(query)}`, { signal }), parseSupplier)
}
export async function supplierAddresses(signal: AbortSignal) {
  return allOptions(offset => apiClient.request(`/api/v1/addresses?offset=${offset}&limit=100`, { signal })
    .then(body => parseList(body, value => { const row = record(value); return { address_id: positiveId(row.address_id), address_line: nullableText(row.address_line) } })), row => row.address_id)
}
export async function saveSupplier(input: SupplierInput, id?: number): Promise<Supplier> {
  return parseSupplier(await apiClient.request(id ? `/api/v1/suppliers/${id}` : '/api/v1/suppliers', { method: id ? 'PATCH' : 'POST', body: input }))
}
