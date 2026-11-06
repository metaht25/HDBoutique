import { useState } from 'react'
import { useSession } from '../session/sessionContext'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { Icon } from '../../shared/ui/Icon'
import { methodLabels, money, query, useQuery } from './api'
import type { Ledger } from './contracts'
import { DataState, Pager, Panel, Stats } from './ui'
import { ReceiptModal } from './ReceiptModal'
import { CommerceEmpty, CommerceIntro, CommerceTable } from './CommerceUI'
import { SaleDetail } from './SaleDetail'
import { SalesTable } from './SalesTable'
import styles from './Boutique.module.css'
import ui from './Commerce.module.css'
import sales from './Sales.module.css'

export default function SalesLedger({ mode }: { mode: 'sales' | 'history' | 'receipts' }) {
  const account = useSession().state.account!
  const [values, setValues] = useState<Record<string, string>>({}), [filters, setFilters] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0), [detail, setDetail] = useState<number | null>(null), [receipt, setReceipt] = useState<number | null>(null)
  const result = useQuery<Ledger>(`reports/sales-ledger?${filters}&receipts=${mode === 'receipts'}&offset=${(page - 1) * 20}&limit=20`, revision), data = result?.data, summary = data?.summary ?? {}, rows = data?.items ?? []
  const update = (field: string, value: string) => setValues(current => ({ ...current, [field]: value }))
  const stats = mode === 'receipts' ? [{ label: 'Recibos de hoy', value: summary.today_count }, { label: 'Recibos del mes', value: summary.month_count }, { label: 'Monto facturado', value: money(summary.total_amount), hint: 'Excluye anulaciones' }] : [{ label: mode === 'history' ? 'Cantidad de ventas' : 'Transacciones', value: summary.total_count }, { label: 'Total vendido', value: money(summary.total_amount), hint: 'Excluye anulaciones' }, { label: 'Productos vendidos', value: summary.units }, ...(mode === 'history' ? [{ label: 'Promedio por venta', value: money(summary.average), hint: 'Excluye anulaciones' }] : [])]
  const maxMethod = Math.max(1, ...(data?.methods.map(row => Number(row.total)) ?? []))
  const presentation = ({
    sales: { icon: 'sales', title: 'Cada venta, con claridad', description: 'Consulta tus operaciones, revisa sus importes y conserva su trazabilidad.', filter: 'Encuentra una venta', list: 'Listado de ventas', loading: 'Cargando ventas…', empty: 'No hay ventas para mostrar' },
    history: { icon: 'history', title: 'Tu historial comercial', description: 'Explora tus operaciones y consulta los resultados del período seleccionado.', filter: 'Busca en el historial', list: 'Historial de ventas', loading: 'Cargando historial…', empty: 'Sin operaciones para estos filtros' },
    receipts: { icon: 'receipt', title: account.role === 'Cashier' ? 'Tus recibos' : 'Recibos de tu boutique', description: account.role === 'Cashier' ? 'Consulta los recibos de tus ventas, imprime o descarga un ticket de 80 mm.' : 'Consulta los recibos de tus ventas y conserva su información original.', filter: 'Encuentra un recibo', list: 'Listado de recibos', loading: 'Cargando recibos…', empty: 'No hay recibos para mostrar' },
  } as const)[mode]
  return <div className={`${styles.page} ${mode === 'history' ? sales.history : ''}`}>
    <CommerceIntro icon={presentation.icon} title={presentation.title} description={presentation.description} action={mode === 'history' ? <button type="button" className="secondary" onClick={() => window.print()}>Imprimir resultado</button> : undefined} />
    <DataState result={result}><Stats items={stats.map(item => ({ ...item, icon: <Icon name={presentation.icon} size={17} /> }))} /></DataState>
    <Panel><div className={ui.heading}><div><h2>{presentation.filter}</h2><p>{mode === 'sales' ? 'Combina fechas, cliente, forma de pago y estado.' : 'Filtra por período, número, cliente, método de pago o estado.'}</p></div></div><form className={`${ui.filters} ${sales.filters}`} onSubmit={event => { event.preventDefault(); setFilters(query(values)); setPage(1) }}>
      <TextField label="Desde" type="date" value={values.start_date ?? ''} onChange={e => update('start_date', e.target.value)} /><TextField label="Hasta" type="date" min={values.start_date} value={values.end_date ?? ''} onChange={e => update('end_date', e.target.value)} />
      {mode !== 'sales' && <TextField label="Número de venta o recibo" maxLength={100} placeholder="V-00001 / 1" value={values.q ?? ''} onChange={e => update('q', e.target.value)} />}
      <TextField label="Buscar cliente" maxLength={100} value={values.customer ?? ''} onChange={e => update('customer', e.target.value)} />
      <SelectField label="Método de pago" value={values.method ?? ''} onChange={e => update('method', e.target.value)}><option value="">Todos</option>{Object.entries(methodLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</SelectField>
      <SelectField label="Estado" value={values.status ?? ''} onChange={e => update('status', e.target.value)}><option value="">Todos</option><option value="confirmed">Confirmadas</option><option value="voided">Anuladas</option>{mode !== 'receipts' && <option value="legacy">Históricas</option>}</SelectField>
      <div className={ui.actions}><button>Buscar</button><button type="button" className="secondary" onClick={() => { setValues({}); setFilters(''); setPage(1) }}>Limpiar</button></div>
    </form></Panel>
    <Panel><div className={ui.heading}><div><h2>{presentation.list}</h2><p>{mode === 'receipts' ? 'Cada recibo conserva los datos de su venta. Las anulaciones se identifican por su estado.' : 'Las anuladas conservan su detalle original y se identifican por su estado.'}</p></div>{data && <span className={ui.count}>{summary.total_count} {mode === 'receipts' ? 'recibos' : 'ventas'}</span>}</div>
      {!result ? <CommerceEmpty title={presentation.loading} loading /> : result.error !== undefined ? <DataState result={result}>{null}</DataState> : !rows.length ? <CommerceEmpty title={presentation.empty}>Ajusta las fechas o limpia los filtros para consultar otras operaciones.</CommerceEmpty> : <SalesTable mode={mode} rows={rows} onDetail={setDetail} onReceipt={setReceipt} />}
      <Pager page={page} total={Number(summary.total_count ?? 0)} onChange={setPage} />
    </Panel>
    {mode === 'sales' && <div className={styles.equalColumns}><Panel title="Ventas por método de pago"><DataState result={result}>{Object.entries(methodLabels).map(([method, label]) => { const group = data?.methods.find(row => row.method === method); return <div key={method} className={sales.method}><div className={sales.methodHeading}><div><strong>{label}</strong><small>{group?.count ?? 0} ventas</small></div><b>{money(group?.total ?? '0.00')}</b></div><div className={sales.methodBar}><span style={{ width: `${Number(group?.total ?? 0) / maxMethod * 100}%` }} /></div></div> })}</DataState></Panel><Panel title="Productos más vendidos"><DataState result={result}>{data?.best_products.length ? <CommerceTable label="Productos más vendidos"><thead><tr><th>Producto</th><th>Unidades</th><th>Total</th></tr></thead><tbody>{data.best_products.map(row => <tr key={row.product_id}><td><strong>{row.name}</strong></td><td data-label="Unidades">{row.quantity}</td><td data-label="Total" data-money>{money(row.total)}</td></tr>)}</tbody></CommerceTable> : <CommerceEmpty title="Sin productos en este período">Los productos vendidos aparecerán aquí cuando haya resultados.</CommerceEmpty>}</DataState></Panel></div>}
    {detail && <SaleDetail id={detail} onClose={() => setDetail(null)} onChanged={() => setRevision(value => value + 1)} onReceipt={() => setReceipt(detail)} />}
    {receipt && <ReceiptModal saleId={receipt} onClose={() => setReceipt(null)} />}
  </div>
}
