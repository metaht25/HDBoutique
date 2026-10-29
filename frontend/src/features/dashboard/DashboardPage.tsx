import { useState } from 'react'
import { Link } from 'react-router'
import { ModuleAccess } from '../session/ModuleAccess'
import { useSession } from '../session/sessionContext'
import { getErrorMessage } from '../../shared/api/errors'
import { useResource } from '../../shared/hooks/useResource'
import { Card } from '../../shared/ui/Card'
import { LoadingState, Message } from '../../shared/ui/Feedback'
import { TableContainer } from '../../shared/ui/TableContainer'
import { loadDashboard, reportMoney, stockLabels } from '../reports/api'
import styles from '../reports/Reporting.module.css'

function DashboardWorkspace() {
  const { state } = useSession()
  const [revision, setRevision] = useState(0)
  const result = useResource(`dashboard:${revision}`, loadDashboard)
  const data = result?.data
  return <div className={styles.page}>
    <div className={styles.header}><div><h2>Resumen general</h2><p>Ventas documentadas del día e inventario actual.</p></div>
      <button type="button" onClick={() => setRevision(value => value + 1)}>Recargar dashboard</button></div>
    {!result ? <LoadingState>Cargando dashboard…</LoadingState> : result.error !== undefined
      ? <Message>{getErrorMessage(result.error, 'No se pudo cargar el dashboard.')}</Message> : data && <>
        <p className={styles.note}>Fecha comercial: <strong>{data.context.business_date}</strong> · {data.context.timezone}. El importe vendido excluye anulaciones; consulta caja para distinguir efectivo y transferencias.</p>
        <div className={styles.cards}>
          <Card label="Ventas del día">{data.sales.total_count}</Card>
          <Card label="Importe vendido del día">{reportMoney(data.sales.total_amount)}</Card>
          <Card label="Productos del catálogo">{data.product_count}</Card>
          <Card label="Clientes registrados">{data.customer_count}</Card>
          {Object.entries(data.stock).map(([status, count]) => <Card key={status} label={stockLabels[status as keyof typeof stockLabels]} attention={status !== 'available'}>{count}</Card>)}
          {state.status === 'authenticated' && state.account.role !== 'Cashier' && data.staff && <>
            <Card label="Proveedores registrados">{data.staff.supplier_count}</Card>
            <Card label="Compras del día">{data.staff.purchases_today}</Card>
          </>}
        </div>
        <p className={styles.note}>Bajo stock: 1–{data.low_stock_threshold}. Agotado: 0. Nulos y negativos requieren conteo. Catálogo y clientes muestran cifras actuales, sin filtro de fecha.</p>
        {data.sales.legacy_count > 0 && <Message variant="info">{data.sales.legacy_count} ventas del día provienen de históricos sin auditoría del flujo nuevo.</Message>}
        <section className={styles.panel}><h3>Últimas ventas del día</h3><p>Hasta cinco registros, ordenados por fecha e ID.</p>
          {data.recent_sales.length === 0 ? <p>No hay ventas registradas para esta fecha.</p> : <TableContainer label="Últimas ventas"><table>
            <thead><tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>Total NIO</th><th>Origen</th></tr></thead>
            <tbody>{data.recent_sales.map(sale => <tr key={sale.sale_id}><td>{sale.sale_id}</td><td>{sale.sale_date}</td>
              <td>{sale.customer_name}</td><td>{reportMoney(sale.total)}</td><td>{sale.source === 'voided' ? 'Anulada' : sale.source === 'legacy' ? 'Histórico' : 'Confirmada'}</td></tr>)}</tbody>
          </table></TableContainer>}
          <Link to="/reports?type=sales">Consultar reporte de ventas</Link>
        </section>
      </>}
  </div>
}
export default function DashboardPage() { return <ModuleAccess><DashboardWorkspace /></ModuleAccess> }
