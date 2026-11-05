import { useState } from 'react'
import { Message } from '../../shared/ui/Feedback'
import { money, query, useQuery } from './api'
import type { Page, Product, Supplier } from './contracts'
import { SearchSelect } from './SearchSelect'

export function PurchaseProductSelect({ supplierId, current, onChange }: { supplierId: string; current: Product | null; onChange: (row: Product | null) => void }) {
  const [q, setQ] = useState(''), [page, setPage] = useState(1)
  const result = useQuery<Page<Product>>('reports/product-catalog?' + query({ status: 'active', supplier_id: supplierId, q, offset: (page - 1) * 20, limit: 20 }))
  const rows = result?.data?.items ?? [], options = [...(current && !rows.some(row => row.product_id === current.product_id) ? [current] : []), ...rows]
  return <div><SearchSelect label="Producto" value={current ? String(current.product_id) : ''} loading={!result} options={options.map(row => ({ id: row.product_id, label: row.name ?? 'Nombre histórico no registrado', description: `Talla ${row.size_name} · ${money(row.cost)}` }))} onSearch={value => { setQ(value); setPage(1) }} onChange={value => onChange(options.find(row => row.product_id === Number(value)) ?? null)} pagination={{ page, total: Number(result?.data?.summary.total_count ?? 0), onChange: setPage }} />{result?.error !== undefined && <Message>No se pudieron buscar productos. Reintenta la búsqueda.</Message>}</div>
}

export function PurchaseSupplierSelect({ value, current, onChange, activeOnly = false, revision = 0 }: { value: string; current: Supplier | null; onChange: (row: Supplier | null) => void; activeOnly?: boolean; revision?: number }) {
  const [q, setQ] = useState(''), [page, setPage] = useState(1)
  const result = useQuery<Page<Supplier>>('reports/supplier-directory?' + query({ q, status: activeOnly ? 'active' : undefined, offset: (page - 1) * 20, limit: 20 }), revision)
  const rows = result?.data?.items ?? [], options = [...(current && !rows.some(row => row.supplier_id === current.supplier_id) ? [current] : []), ...rows]
  return <div><SearchSelect label="Proveedor" required={activeOnly} value={value} loading={!result} options={options.map(row => ({ id: row.supplier_id, label: row.company_name, description: `${row.contact_first_names ?? ''} ${row.contact_last_names ?? ''} · ${row.phone_number ?? ''} · #${row.supplier_id}` }))} onSearch={search => { setQ(search); setPage(1) }} onChange={id => onChange(options.find(row => row.supplier_id === Number(id)) ?? null)} pagination={{ page, total: Number(result?.data?.summary.total_count ?? 0), onChange: setPage }} />{result?.error !== undefined && <Message>No se pudieron buscar proveedores. Reintenta la búsqueda.</Message>}</div>
}
