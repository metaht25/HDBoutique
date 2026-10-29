export const context = { start_date: null, end_date: null, business_date: '2026-10-28', timezone: 'America/Managua',
  generated_at: '2026-10-29T00:30:00Z', currency: 'NIO' }
export const stockSummary = { out_of_stock: 1, low_stock: 2, available: 3, unknown: 1, invalid: 1 }
const sales = Array.from({ length: 22 }, (_, index) => ({ sale_id: index + 1, customer_id: 108,
  customer_name: `Cliente ${index + 1}`, sale_date: index === 21 ? '2026-10-29' : '2026-10-28', total: '199.50', source: 'confirmed' }))
export function dashboardResponse(staff = true) {
  return { context: { ...context, start_date: '2026-10-28', end_date: '2026-10-28' },
    product_count: 8, customer_count: 1, low_stock_threshold: 10, stock: stockSummary,
    sales: { total_count: 21, total_amount: '4189.50', legacy_count: 0 }, recent_sales: sales.slice(0, 21).toReversed().slice(0, 5),
    ...(staff ? { staff: { supplier_count: 2, purchases_today: 2 } } : {}) }
}
export function reportingResponse(url: URL, staff = true): unknown {
  if (url.pathname === '/api/v1/dashboard') return dashboardResponse(staff)
  const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 20)
  const start = url.searchParams.get('start_date'), end = url.searchParams.get('end_date')
  const base = { context: { ...context, start_date: start, end_date: end }, offset, limit }
  if (url.pathname === '/api/v1/reports/sales') {
    const filtered = sales.filter(row => (!start || row.sale_date >= start) && (!end || row.sale_date <= end)).toReversed()
    return { ...base, summary: { total_count: filtered.length, total_amount: `${(filtered.length * 19950 / 100).toFixed(2)}`, legacy_count: 0 },
      items: filtered.slice(offset, offset + limit) }
  }
  if (url.pathname === '/api/v1/reports/purchases') return { ...base,
    summary: { total_count: 1, known_merchandise_total: '0.00', unknown_merchandise_count: 1,
      known_shipping_total: '0.00', unknown_shipping_count: 1, known_total: '0.00', unknown_total_count: 1, legacy_count: 1 },
    items: offset ? [] : [{ purchase_id: 1, purchase_date: '2026-10-28', supplier_id: 1, supplier_name: 'Proveedor sintético',
      status: 'legacy', merchandise_total: null, shipping_cost: null, total: null }] }
  if (url.pathname === '/api/v1/reports/inventory') {
    const all = [ { product_id: 1, name: 'Sin contar', available_stock: null, historical_stock: 12, status: 'unknown' },
      { product_id: 2, name: 'Última unidad', available_stock: 1, historical_stock: null, status: 'low_stock' } ]
    const rows = all.filter(row => !url.searchParams.get('status') || row.status === url.searchParams.get('status'))
    return { ...base, summary: stockSummary, total_count: rows.length, low_stock_threshold: 10, items: rows.slice(offset, offset + limit) }
  }
  if (url.pathname === '/api/v1/reports/customers') return { ...base, total_count: 1, group_count: 2,
    items: [{ customer_type_id: 1, name: 'Registrado', customer_count: 1 }, { customer_type_id: 2, name: 'Registrado', customer_count: 0 }].slice(offset, offset + limit) }
  return undefined
}
