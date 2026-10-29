import { apiClient } from '../../shared/api/client'
import { invalidResponse, nullableText, parseList, positiveId, record, requiredText } from '../../shared/api/validation'

export type ReportKind = 'sales' | 'purchases' | 'inventory' | 'customers'
export const stockLabels = { out_of_stock: 'Agotado', low_stock: 'Bajo stock', available: 'Suficiente', unknown: 'Sin conteo', invalid: 'Conteo inválido' } as const
export type StockStatus = keyof typeof stockLabels
export interface Context { business_date: string; timezone: string; generated_at: string; start_date: string | null; end_date: string | null }
export interface SalesSummary { total_count: number; total_amount: string; legacy_count: number }
export interface SaleRow { sale_id: number; sale_date: string; customer_id: number; customer_name: string; total: string; source: 'confirmed' | 'legacy' | 'voided' }
export type StockSummary = Record<StockStatus, number>
export interface InventoryRow { product_id: number; name: string | null; available_stock: number | null; historical_stock: number | null; status: StockStatus }
export interface PurchaseSummary { total_count: number; known_merchandise_total: string; unknown_merchandise_count: number; known_shipping_total: string; unknown_shipping_count: number; known_total: string; unknown_total_count: number; legacy_count: number }
export interface PurchaseRow { purchase_id: number; purchase_date: string; supplier_id: number; supplier_name: string; status: 'registered' | 'received' | 'legacy'; merchandise_total: string | null; shipping_cost: string | null; total: string | null }
export interface CustomerGroup { customer_type_id: number; name: string | null; customer_count: number }
interface Page { context: Context; offset: number; limit: number }
export type Report = (Page & { kind: 'sales'; summary: SalesSummary; items: SaleRow[] })
  | (Page & { kind: 'purchases'; summary: PurchaseSummary; items: PurchaseRow[] })
  | (Page & { kind: 'inventory'; summary: StockSummary; total_count: number; low_stock_threshold: number; items: InventoryRow[] })
  | (Page & { kind: 'customers'; total_count: number; group_count: number; items: CustomerGroup[] })
export interface Dashboard { context: Context; product_count: number; customer_count: number; stock: StockSummary; low_stock_threshold: number; sales: SalesSummary; recent_sales: SaleRow[]; staff?: { supplier_count: number; purchases_today: number } }

export function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalidResponse()
  return value
}
export function money(value: unknown): string {
  if (typeof value !== 'string' || !/^-?\d+\.\d{2}$/.test(value)) return invalidResponse()
  return value
}
export function reportMoney(value: string | null): string { return value === null ? 'Sin determinar' : `C$${money(value)}` }
function isoDate(value: unknown): string {
  const date = requiredText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return invalidResponse()
  return date
}
function context(value: unknown): Context {
  const row = record(value)
  if (row.timezone !== 'America/Managua' || row.currency !== 'NIO') return invalidResponse()
  return { business_date: isoDate(row.business_date), timezone: row.timezone,
    generated_at: requiredText(row.generated_at), start_date: row.start_date == null ? null : isoDate(row.start_date),
    end_date: row.end_date == null ? null : isoDate(row.end_date) }
}
function salesSummary(value: unknown): SalesSummary {
  const row = record(value)
  return { total_count: count(row.total_count), total_amount: money(row.total_amount), legacy_count: count(row.legacy_count) }
}
function sale(value: unknown): SaleRow {
  const row = record(value)
  if (row.source !== 'confirmed' && row.source !== 'legacy' && row.source !== 'voided') return invalidResponse()
  return { sale_id: positiveId(row.sale_id), sale_date: isoDate(row.sale_date), customer_id: positiveId(row.customer_id),
    customer_name: requiredText(row.customer_name), total: money(row.total), source: row.source }
}
function stockSummary(value: unknown): StockSummary {
  const row = record(value)
  return { out_of_stock: count(row.out_of_stock), low_stock: count(row.low_stock), available: count(row.available), unknown: count(row.unknown), invalid: count(row.invalid) }
}
function stock(value: unknown): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < -2147483648 || value > 2147483647) return invalidResponse()
  return value
}
function inventory(value: unknown): InventoryRow {
  const row = record(value)
  if (typeof row.status !== 'string' || !Object.hasOwn(stockLabels, row.status)) return invalidResponse()
  return { product_id: positiveId(row.product_id), name: nullableText(row.name), available_stock: stock(row.available_stock),
    historical_stock: stock(row.historical_stock), status: row.status as StockStatus }
}
function purchasesSummary(value: unknown): PurchaseSummary {
  const row = record(value)
  return { total_count: count(row.total_count), known_merchandise_total: money(row.known_merchandise_total),
    unknown_merchandise_count: count(row.unknown_merchandise_count), known_shipping_total: money(row.known_shipping_total),
    unknown_shipping_count: count(row.unknown_shipping_count), known_total: money(row.known_total),
    unknown_total_count: count(row.unknown_total_count), legacy_count: count(row.legacy_count) }
}
function purchase(value: unknown): PurchaseRow {
  const row = record(value)
  if (row.status !== 'registered' && row.status !== 'received' && row.status !== 'legacy') return invalidResponse()
  return { purchase_id: positiveId(row.purchase_id), purchase_date: isoDate(row.purchase_date), supplier_id: positiveId(row.supplier_id),
    supplier_name: requiredText(row.supplier_name), status: row.status,
    merchandise_total: row.merchandise_total === null ? null : money(row.merchandise_total),
    shipping_cost: row.shipping_cost === null ? null : money(row.shipping_cost), total: row.total === null ? null : money(row.total) }
}
export function parseReport(kind: ReportKind, value: unknown): Report {
  const row = record(value)
  const page = { context: context(row.context), offset: count(row.offset), limit: positiveId(row.limit) }
  if (kind === 'sales') return { ...page, kind, summary: salesSummary(row.summary), items: parseList(row.items, sale) }
  if (kind === 'purchases') return { ...page, kind, summary: purchasesSummary(row.summary), items: parseList(row.items, purchase) }
  if (kind === 'inventory') return { ...page, kind, summary: stockSummary(row.summary), total_count: count(row.total_count),
    low_stock_threshold: positiveId(row.low_stock_threshold), items: parseList(row.items, inventory) }
  return { ...page, kind, total_count: count(row.total_count), group_count: count(row.group_count), items: parseList(row.items, value => {
    const item = record(value)
    return { customer_type_id: positiveId(item.customer_type_id), name: nullableText(item.name), customer_count: count(item.customer_count) }
  }) }
}
export function parseDashboard(value: unknown): Dashboard {
  const row = record(value)
  const dashboard: Dashboard = { context: context(row.context), product_count: count(row.product_count), customer_count: count(row.customer_count),
    stock: stockSummary(row.stock), low_stock_threshold: positiveId(row.low_stock_threshold), sales: salesSummary(row.sales), recent_sales: parseList(row.recent_sales, sale) }
  if (row.staff !== undefined) {
    const staff = record(row.staff)
    dashboard.staff = { supplier_count: count(staff.supplier_count), purchases_today: count(staff.purchases_today) }
  }
  return dashboard
}
export async function loadDashboard(signal: AbortSignal): Promise<Dashboard> {
  return parseDashboard(await apiClient.request('/api/v1/dashboard', { signal }))
}
export async function loadReport(kind: ReportKind, page: number, filters: { start: string; end: string; stockStatus: string }, signal: AbortSignal): Promise<Report> {
  const params = new URLSearchParams({ offset: String((page - 1) * 20), limit: '20' })
  if (kind === 'sales' || kind === 'purchases') {
    if (filters.start) params.set('start_date', filters.start)
    if (filters.end) params.set('end_date', filters.end)
  }
  if (kind === 'inventory' && filters.stockStatus) params.set('status', filters.stockStatus)
  return parseReport(kind, await apiClient.request(`/api/v1/reports/${kind}?${params}`, { signal }))
}
