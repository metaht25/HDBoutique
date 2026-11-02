import { apiClient } from '../../shared/api/client'
import { allOptions, invalidResponse, nullableText, parseList, positiveId, record, requiredText } from '../../shared/api/validation'
import { parseCustomer } from '../customers/api'
import { parseProduct } from '../products/api'
import { parseSupplier } from '../suppliers/api'
import { money } from '../reports/api'
import { parsePayment } from '../cash-register/api'
import type { Payment, PaymentInput } from '../cash-register/api'

export type TransactionKind = 'sales' | 'purchases'
export interface TransactionLine { line_id: number; product_id: number | null; supplier_product_id?: number; quantity: number; unit_price: string | null; subtotal: string | null }
export interface Transaction { id: number; party_id: number; employee_id: number; date: string; status: string | null; total: string | null; shipping_cost?: string | null; merchandise_total?: string | null; items: TransactionLine[]; payment?: Payment | null; annulment?: { reason: string; amount: string; method: string; reference: string | null; items: { sale_item_id: number; returned_quantity: number }[] } | null }
export interface TransactionInput { employee_id?: number; sale_date?: string; purchase_date?: string; customer_id?: number; supplier_id?: number; shipping_cost?: string; payment?: PaymentInput; items: { product_id?: number; supplier_product_id?: number; quantity: number }[] }
function integer(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value)) return invalidResponse(); return value }
function date(value: unknown): string { const text = requiredText(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return invalidResponse(); return text }
function nullableMoney(value: unknown) { return value === null ? null : money(value) }
export function parseTransaction(kind: TransactionKind, value: unknown): Transaction {
  const row = record(value), sales = kind === 'sales'
  if (row.currency !== 'NIO' || (row.status !== null && !(sales ? ['confirmed', 'voided'] : ['registered', 'received']).includes(String(row.status)))) return invalidResponse()
  const annulment = row.annulment == null ? null : record(row.annulment)
  return { id: positiveId(row[sales ? 'sale_id' : 'purchase_id']), party_id: positiveId(row[sales ? 'customer_id' : 'supplier_id']),
    employee_id: positiveId(row.employee_id), date: date(row[sales ? 'sale_date' : 'purchase_date']), status: nullableText(row.status), total: sales ? money(row.total) : nullableMoney(row.total),
    ...(!sales ? { shipping_cost: nullableMoney(row.shipping_cost), merchandise_total: nullableMoney(row.merchandise_total) } : {}),
    ...(sales ? { payment: row.payment == null ? null : parsePayment(row.payment), annulment: annulment ? {
      reason: requiredText(annulment.reason), amount: money(annulment.amount), method: requiredText(annulment.method), reference: annulment.reference === null ? null : requiredText(annulment.reference),
      items: parseList(annulment.items, value => { const item = record(value); const quantity = integer(item.returned_quantity); if (quantity < 0) return invalidResponse(); return { sale_item_id: positiveId(item.sale_item_id), returned_quantity: quantity } }),
    } : null } : {}),
    items: parseList(row.items, value => { const line = record(value); return {
      line_id: positiveId(line[sales ? 'sale_item_id' : 'purchase_item_id']), product_id: sales ? positiveId(line.product_id) : line.product_id === null ? null : positiveId(line.product_id),
      ...(!sales ? { supplier_product_id: positiveId(line.supplier_product_id) } : {}), quantity: integer(line.quantity),
      unit_price: sales ? money(line.unit_price) : nullableMoney(line.unit_cost), subtotal: sales ? money(line.subtotal) : nullableMoney(line.subtotal),
    } }) }
}
export async function listTransactions(kind: TransactionKind, page: number, signal: AbortSignal) {
  return parseList(await apiClient.request(`/api/v1/${kind}?offset=${(page - 1) * 20}&limit=21`, { signal }), value => parseTransaction(kind, value))
}
export async function transactionOptions(kind: TransactionKind, signal: AbortSignal) {
  const [products, parties, dashboard] = await Promise.all([
    allOptions(offset => apiClient.request(`/api/v1/products?offset=${offset}&limit=100`, { signal }).then(body => parseList(body, parseProduct)), row => row.product_id),
    kind === 'sales'
      ? allOptions(offset => apiClient.request(`/api/v1/customers?offset=${offset}&limit=100`, { signal }).then(body => parseList(body, parseCustomer)), row => row.customer_id)
        .then(rows => rows.map(row => ({ id: row.customer_id, name: `${row.first_names} ${row.last_names}` })))
      : allOptions(offset => apiClient.request(`/api/v1/suppliers?offset=${offset}&limit=100`, { signal }).then(body => parseList(body, parseSupplier)), row => row.supplier_id)
        .then(rows => rows.map(row => ({ id: row.supplier_id, name: row.company_name }))),
    apiClient.request('/api/v1/dashboard', { signal }),
  ])
  const today = date(record(record(dashboard).context).business_date)
  if (kind === 'sales') return { products, parties, today, costs: [], offerings: [] }
  const [costs, offerings] = await Promise.all([
    allOptions(offset => apiClient.request(`/api/v1/supplier-products?offset=${offset}&limit=100`, { signal }).then(body => parseList(body, value => {
      const row = record(value); return { id: positiveId(row.supplier_product_id), product_id: positiveId(row.product_id), price: money(row.purchase_price) }
    })), row => row.id),
    allOptions(offset => apiClient.request(`/api/v1/supplier-offerings?offset=${offset}&limit=100`, { signal }).then(body => parseList(body, value => {
      const row = record(value); return { id: positiveId(row.offering_id), supplier_id: positiveId(row.supplier_id), supplier_product_id: positiveId(row.supplier_product_id) }
    })), row => row.id),
  ])
  return { products, parties, today, costs, offerings }
}
export async function registerTransaction(kind: TransactionKind, body: TransactionInput, key: string): Promise<Transaction> {
  return parseTransaction(kind, await apiClient.request(`/api/v1/${kind}`, { method: 'POST', body, idempotencyKey: key }))
}
export async function receivePurchase(id: number, employeeId?: number): Promise<Transaction> {
  return parseTransaction('purchases', await apiClient.request(`/api/v1/purchases/${id}/receive`, { method: 'POST', body: employeeId ? { employee_id: employeeId } : {} }))
}
