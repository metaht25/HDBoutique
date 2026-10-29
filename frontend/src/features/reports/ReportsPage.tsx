import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ModuleAccess } from '../session/ModuleAccess'
import { useSession } from '../session/sessionContext'
import { getErrorMessage } from '../../shared/api/errors'
import { inputId } from '../../shared/forms/fields'
import { useResource } from '../../shared/hooks/useResource'
import { Card } from '../../shared/ui/Card'
import { LoadingState, Message } from '../../shared/ui/Feedback'
import { PageNavigation } from '../../shared/ui/PageNavigation'
import { SelectField } from '../../shared/ui/SelectField'
import { TableContainer } from '../../shared/ui/TableContainer'
import { TextField } from '../../shared/ui/TextField'
import { loadReport, reportMoney, stockLabels } from './api'
import type { Report, ReportKind } from './api'
import styles from './Reporting.module.css'

const reportLabels: Record<ReportKind, string> = { sales: 'Ventas', purchases: 'Compras', inventory: 'Inventario', customers: 'Clientes por tipo' }

function Summary({ data }: { data: Report }) {
  if (data.kind === 'sales') return <>
    <div className={styles.cards}><Card label="Ventas del período">{data.summary.total_count}</Card>
      <Card label="Importe vendido">{reportMoney(data.summary.total_amount)}</Card>
      <Card label="Ventas históricas">{data.summary.legacy_count}</Card></div>
    <p className={styles.note}>El importe vendido excluye las ventas anuladas. El detalle conserva su importe original. No representa utilidad ni saldo de caja.</p>
  </>
  if (data.kind === 'purchases') return <>
    <div className={styles.cards}><Card label="Compras del período">{data.summary.total_count}</Card>
      <Card label="Mercancía conocida">{reportMoney(data.summary.known_merchandise_total)}</Card>
      <Card label="Envíos conocidos">{reportMoney(data.summary.known_shipping_total)}</Card>
      <Card label="Total conocido">{reportMoney(data.summary.known_total)}</Card></div>
    <p className={styles.note}>Importes parciales conocidos: {data.summary.unknown_merchandise_count} compras sin mercancía determinada,
      {' '}{data.summary.unknown_shipping_count} sin envío determinado y {data.summary.unknown_total_count} sin total determinado.
      {' '}{data.summary.legacy_count} compras históricas sin flujo nuevo. Se usan costes guardados por línea; no precios actuales ni pagos.</p>
  </>
  if (data.kind === 'inventory') return <>
    <div className={styles.cards}>{Object.entries(data.summary).map(([status, count]) => <Card key={status} label={stockLabels[status as keyof typeof stockLabels]}>{count}</Card>)}</div>
    <p className={styles.note}>Conteos globales del inventario actual. Bajo stock: 1–{data.low_stock_threshold}; agotado: 0. Nulos y negativos requieren conteo. El estado filtra solo el detalle, sin reconstruir inventario histórico.</p>
  </>
  return <div className={styles.cards}><Card label="Clientes registrados">{data.total_count}</Card>
    <Card label="Tipos registrados">{data.group_count}</Card></div>
}

function ReportTable({ data }: { data: Report }) {
  if (!data.items.length) return <p>No hay registros en esta página.</p>
  if (data.kind === 'sales') return <TableContainer label="Reporte de ventas"><table>
    <thead><tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>Total NIO</th><th>Origen</th></tr></thead>
    <tbody>{data.items.map(row => <tr key={row.sale_id}><td>{row.sale_id}</td><td>{row.sale_date}</td>
      <td>{row.customer_name} (#{row.customer_id})</td><td>{reportMoney(row.total)}</td><td>{row.source === 'voided' ? 'Anulada' : row.source === 'legacy' ? 'Histórico' : 'Confirmada'}</td></tr>)}</tbody>
  </table></TableContainer>
  if (data.kind === 'purchases') return <TableContainer label="Reporte de compras"><table>
    <thead><tr><th>ID</th><th>Fecha</th><th>Proveedor</th><th>Estado</th><th>Mercancía NIO</th><th>Envío NIO</th><th>Total NIO</th></tr></thead>
    <tbody>{data.items.map(row => <tr key={row.purchase_id}><td>{row.purchase_id}</td><td>{row.purchase_date}</td>
      <td>{row.supplier_name} (#{row.supplier_id})</td><td>{{ registered: 'Registrada', received: 'Recibida', legacy: 'Histórica' }[row.status]}</td>
      <td>{reportMoney(row.merchandise_total)}</td><td>{reportMoney(row.shipping_cost)}</td><td>{reportMoney(row.total)}</td></tr>)}</tbody>
  </table></TableContainer>
  if (data.kind === 'inventory') return <TableContainer label="Reporte de inventario"><table>
    <thead><tr><th>ID</th><th>Producto</th><th>Disponible</th><th>Cifra histórica</th><th>Estado</th></tr></thead>
    <tbody>{data.items.map(row => <tr key={row.product_id}><td>{row.product_id}</td><td>{row.name ?? 'Sin nombre'}</td>
      <td>{row.available_stock ?? 'Sin conteo'}</td><td>{row.historical_stock ?? 'Sin registro'}</td><td>{stockLabels[row.status]}</td></tr>)}</tbody>
  </table></TableContainer>
  return <TableContainer label="Reporte de clientes"><table><thead><tr><th>ID del tipo</th><th>Tipo</th><th>Clientes</th></tr></thead>
    <tbody>{data.items.map(row => <tr key={row.customer_type_id}><td>{row.customer_type_id}</td>
      <td>{row.name ?? `Tipo #${row.customer_type_id}`}</td><td>{row.customer_count}</td></tr>)}</tbody></table></TableContainer>
}

function ReportView({ kind, canReadPurchases }: { kind: ReportKind; canReadPurchases: boolean }) {
  const [params, setParams] = useSearchParams()
  const page = inputId(params.get('page') ?? '1') ?? 1
  const start = params.get('start') ?? '', end = params.get('end') ?? '', stockStatus = params.get('status') ?? ''
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const load = useCallback((signal: AbortSignal) => loadReport(kind, page, { start, end, stockStatus }, signal), [kind, page, start, end, stockStatus])
  const result = useResource(`${kind}:${page}:${start}:${end}:${stockStatus}:${revision}`, load)
  const data = result?.data
  const total = !data ? 0 : data.kind === 'customers' ? data.group_count : data.kind === 'inventory' ? data.total_count : data.summary.total_count
  function changePage(next: number) { const nextParams = new URLSearchParams(params); nextParams.set('page', String(next)); setParams(nextParams) }
  return <div className={styles.page}>
    <div className={styles.header}><div><h2>Reportes</h2><p>Resúmenes globales calculados por el servidor.</p></div>
      <button type="button" onClick={() => setRevision(value => value + 1)}>Recargar reporte</button></div>
    <section className={styles.panel}><form className={styles.filters} key={`${kind}:${start}:${end}:${stockStatus}`} noValidate onSubmit={event => {
      event.preventDefault()
      const form = new FormData(event.currentTarget), nextStart = String(form.get('start') ?? ''), nextEnd = String(form.get('end') ?? '')
      if (nextStart && nextEnd && nextStart > nextEnd) { setError('La fecha inicial no puede ser posterior a la final.'); return }
      setError('')
      setParams({ type: kind, page: '1', ...(nextStart ? { start: nextStart } : {}), ...(nextEnd ? { end: nextEnd } : {}),
        ...(form.get('status') ? { status: String(form.get('status')) } : {}) })
    }}>
      <SelectField label="Tipo de reporte" value={kind} onChange={event => { setError(''); setParams({ type: event.target.value, page: '1' }) }}>
        {Object.entries(reportLabels).filter(([value]) => value !== 'purchases' || canReadPurchases).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </SelectField>
      {(kind === 'sales' || kind === 'purchases') && <>
        <TextField label="Desde" name="start" type="date" defaultValue={start} />
        <TextField label="Hasta" name="end" type="date" defaultValue={end} />
      </>}
      {kind === 'inventory' && <SelectField label="Estado de inventario" name="status" defaultValue={stockStatus}>
        <option value="">Todos</option>{Object.entries(stockLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </SelectField>}
      {kind !== 'customers' && <button type="submit">Aplicar filtros</button>}
      <button type="button" onClick={() => { setError(''); setParams({ type: kind, page: '1' }) }}>Limpiar filtros</button>
    </form>{error && <Message>{error}</Message>}
      <p className={styles.note}>{kind === 'sales' || kind === 'purchases'
        ? 'Fechas documentales inclusivas en America/Managua. Sin fechas se consulta todo el historial.'
        : 'Datos actuales; este reporte no aplica filtros de fechas.'}</p>
    </section>
    {!result ? <LoadingState>Cargando reporte…</LoadingState> : result.error !== undefined
      ? <Message>{getErrorMessage(result.error, 'No se pudo cargar el reporte.')}</Message> : data && <>
        <p className={styles.note}>Fecha comercial del servidor: {data.context.business_date} · {data.context.timezone}.</p>
        <Summary data={data} /><section className={styles.panel}><h3>{reportLabels[data.kind]}</h3>
          <p>{total} registros en el resultado completo. Hasta 20 por página.</p><ReportTable data={data} /></section>
      </>}
    <PageNavigation page={page} hasNext={page * 20 < total} onPageChange={changePage} />
  </div>
}

function ReportsWorkspace() {
  const { state } = useSession()
  const [params] = useSearchParams()
  const selected = params.get('type') ?? 'sales'
  const kind: ReportKind = Object.hasOwn(reportLabels, selected) ? selected as ReportKind : 'sales'
  const canReadPurchases = state.status === 'authenticated' && state.account.role !== 'Cashier'
  if (kind === 'purchases' && !canReadPurchases) return <><Message>No tienes permiso para consultar compras.</Message><Link to="/reports?type=sales">Consultar ventas</Link></>
  return <ReportView key={kind} kind={kind} canReadPurchases={canReadPurchases} />
}
export default function ReportsPage() { return <ModuleAccess><ReportsWorkspace /></ModuleAccess> }
