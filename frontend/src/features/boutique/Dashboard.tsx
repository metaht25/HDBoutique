import { useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '../session/sessionContext'
import { dateText, money, useQuery } from './api'
import type { Overview } from './contracts'
import { Badge, DataState, Panel, Stats, Table } from './ui'
import { ReceiptModal } from './ReceiptModal'
import { SalesChart } from './SalesChart'
import { Icon } from '../../shared/ui/Icon'
import styles from './Boutique.module.css'
import dashboard from './Dashboard.module.css'

export default function Dashboard() {
  const { state } = useSession(), owner = state.account?.role === 'Administrator', [period, setPeriod] = useState('week'), [receipt, setReceipt] = useState<number | null>(null)
  const result = useQuery<Overview>('dashboard/overview?period=' + period), data = result?.data, s = data?.summary ?? {}
  return <div className={`${styles.page} ${dashboard.dashboard}`}>
    <section className={dashboard.welcome} aria-label="Resumen del día"><div><p className={dashboard.eyebrow}>{owner ? 'UNA VISTA DE TU NEGOCIO' : 'TU ACTIVIDAD DE HOY'}</p><h2>{owner ? 'Resumen de tu boutique' : `Bienvenido, ${state.account?.display_name ?? state.account?.username ?? ''}`}</h2><p>{owner ? 'Consulta tus ventas y los productos que necesitan atención.' : 'Tus ventas, tus recibos y el inventario, a mano.'}</p>{data && <span className={dashboard.date}><Icon name="calendar" size={15} />{dateText(data.context.business_date)}<span>· Managua</span></span>}</div><Link className="button" to="/new-sale"><Icon name="plus" size={18} />Nueva venta</Link></section>
    <DataState result={result}><Stats items={owner ? [
      { label: 'Ventas del día', value: money(s.today_amount), hint: `${s.today_count ?? 0} ventas`, icon: <Icon name="wallet" size={18} /> },
      { label: 'Ventas del mes', value: money(s.month_amount), hint: `${s.month_count ?? 0} ventas`, icon: <Icon name="chart" size={18} /> },
      { label: 'Stock bajo', value: s.low_stock, hint: 'Productos con 1 a 5 unidades', icon: <Icon name="alert" size={18} /> },
      { label: 'Productos vendidos', value: s.month_units, hint: 'Este mes', icon: <Icon name="products" size={18} /> },
    ] : [
      { label: 'Mis ventas de hoy', value: s.today_count, hint: 'Registradas con tu cuenta', icon: <Icon name="sales" size={18} /> }, { label: 'Total vendido hoy', value: money(s.today_amount), hint: 'Ventas confirmadas', icon: <Icon name="wallet" size={18} /> },
      { label: 'Productos vendidos', value: s.today_units, hint: 'Hoy', icon: <Icon name="products" size={18} /> }, { label: 'Alertas de stock', value: s.low_stock, hint: 'Productos con 1 a 5 unidades', icon: <Icon name="alert" size={18} /> },
    ]} /></DataState>
    <div className={dashboard.overviewGrid}>
      <Panel title="Resumen de ventas"><div className={styles.tabs}>{[['week', 'Semanal'], ['month', 'Mensual']].map(([value, label]) => <button key={value} className={period === value ? '' : 'secondary'} aria-pressed={period === value} onClick={() => setPeriod(value!)}>{label}</button>)}</div>
        <div className={dashboard.periodSummary}><span>Total vendido</span><strong>{money(s.period_amount)}</strong><p><span>Cantidad de ventas</span><b>{s.period_count ?? '—'}</b></p></div>
        <p className={styles.hint}>{Number(s.period_count) === 0 ? 'No hay ventas registradas para este período.' : 'Ventas confirmadas del período. Las anuladas se conservan en el historial.'}</p>
      </Panel>
      <Panel title={owner ? 'Últimas ventas' : 'Mis últimos recibos'} action={<Link to={owner ? '/sales' : '/receipts'}>Ver {owner ? 'ventas' : 'recibos'} <span aria-hidden="true">↗</span></Link>}><DataState result={result} empty={data?.recent_sales.length === 0}>
        <Table label="Últimas ventas"><thead><tr><th>Fecha</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{data?.recent_sales.map(row => <tr key={row.sale_id}><td>{dateText(row.sale_date)}</td><td>{row.customer_name}</td><td>{row.products ?? 'Sin detalle'}</td><td>{money(row.total)}</td><td><Badge status={row.status} /></td><td>{row.receipt_id ? <button className="secondary" onClick={() => setReceipt(row.sale_id)}>Recibo</button> : 'Histórica'}</td></tr>)}</tbody></Table>
      </DataState></Panel>
    </div>
    {owner && <div className={`${styles.equalColumns} ${dashboard.charts}`}>{(['amount', 'count'] as const).map(metric => <Panel key={metric} title={metric === 'amount' ? 'Evolución de ventas' : 'Cantidad de ventas'}><DataState result={result}><SalesChart points={data?.series ?? []} metric={metric} /></DataState></Panel>)}</div>}
    <Panel title="Productos con bajo stock" action={<Link to="/products?status=low_stock">Ver inventario <span aria-hidden="true">↗</span></Link>}><DataState result={result} empty={data?.low_stock.length === 0}><Table label="Productos con bajo stock"><thead><tr><th>Producto</th><th>Categoría</th><th>Talla</th><th>Stock</th></tr></thead><tbody>{data?.low_stock.map(row => <tr key={row.product_id}><td>{row.name}</td><td>{row.category_name}</td><td>{row.size_name}</td><td><span className={dashboard.stockCount}>{row.legacy_stock} <small>unidades</small></span></td></tr>)}</tbody></Table></DataState></Panel>
    {receipt && <ReceiptModal saleId={receipt} onClose={() => setReceipt(null)} />}
  </div>
}
