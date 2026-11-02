import { useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '../session/sessionContext'
import { dateText, money, useQuery } from './api'
import type { Overview } from './contracts'
import { Badge, DataState, Panel, Stats, Table } from './ui'
import { ReceiptModal } from './ReceiptModal'
import styles from './Boutique.module.css'

export default function Dashboard() {
  const { state } = useSession(), owner = state.account?.role === 'Administrator', [period, setPeriod] = useState('week'), [receipt, setReceipt] = useState<number | null>(null)
  const result = useQuery<Overview>('dashboard/overview?period=' + period), data = result?.data, s = data?.summary ?? {}
  return <div className={styles.page}>
    {!owner && <Panel title={`Bienvenido, ${state.account?.display_name ?? state.account?.username ?? ''}`} action={<Link className="button" to="/new-sale">+ Nueva venta</Link>}><p>Acceso activo como Colaborador · Tu actividad de hoy</p></Panel>}
    <DataState result={result}><Stats items={owner ? [
      { label: 'Ventas del día', value: money(s.today_amount), hint: `${s.today_count ?? 0} ventas` },
      { label: 'Ventas del mes', value: money(s.month_amount), hint: `${s.month_count ?? 0} ventas` },
      { label: 'Stock bajo', value: s.low_stock, hint: 'Productos con 1 a 5 unidades' },
      { label: 'Productos vendidos', value: s.month_units, hint: 'Este mes' },
    ] : [
      { label: 'Mis ventas de hoy', value: s.today_count }, { label: 'Total vendido hoy', value: money(s.today_amount) },
      { label: 'Productos vendidos', value: s.today_units, hint: 'Hoy' }, { label: 'Alertas de stock', value: s.low_stock, hint: 'Productos con 1 a 5 unidades' },
    ]} /></DataState>
    <div className={styles.columns}>
      <Panel title="Resumen de ventas"><div className={styles.tabs}>{[['week', 'Semanal'], ['month', 'Mensual'], ['year', 'Anual']].map(([value, label]) => <button key={value} className={period === value ? '' : 'secondary'} aria-pressed={period === value} onClick={() => setPeriod(value!)}>{label}</button>)}</div>
        <div className={styles.summary}><p><span>Total vendido</span><b>{money(s.period_amount)}</b></p><p><span>Cantidad de ventas</span><b>{s.period_count ?? '—'}</b></p></div>
        <p className={styles.hint}>{Number(s.period_count) === 0 ? 'No hay ventas registradas para este período.' : 'Ventas confirmadas del período. Las anuladas se conservan en el historial.'}</p>
      </Panel>
      <Panel title={owner ? 'Últimas ventas' : 'Mis últimos recibos'}><DataState result={result} empty={data?.recent_sales.length === 0}>
        <Table label="Últimas ventas"><thead><tr><th>Fecha</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{data?.recent_sales.map(row => <tr key={row.sale_id}><td>{dateText(row.sale_date)}</td><td>{row.customer_name}</td><td>{row.products ?? 'Sin detalle'}</td><td>{money(row.total)}</td><td><Badge status={row.status} /></td><td>{row.receipt_id ? <button className="secondary" onClick={() => setReceipt(row.sale_id)}>Recibo</button> : 'Histórica'}</td></tr>)}</tbody></Table>
      </DataState></Panel>
    </div>
    <Panel title="Productos con bajo stock" action={<Link to="/products?status=low_stock">Ver inventario</Link>}><DataState result={result} empty={data?.low_stock.length === 0}><Table label="Productos con bajo stock"><thead><tr><th>Producto</th><th>Categoría</th><th>Talla</th><th>Stock</th></tr></thead><tbody>{data?.low_stock.map(row => <tr key={row.product_id}><td>{row.name}</td><td>{row.category_name}</td><td>{row.size_name}</td><td>{row.legacy_stock}</td></tr>)}</tbody></Table></DataState></Panel>
    {receipt && <ReceiptModal saleId={receipt} onClose={() => setReceipt(null)} />}
  </div>
}
