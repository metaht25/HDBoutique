import { dateText, methodLabels, money, timeText } from './api'
import type { SaleRow } from './contracts'
import { Badge } from './ui'
import { CommerceTable } from './CommerceUI'
import sales from './Sales.module.css'

export function SalesTable({ mode, rows, onDetail, onReceipt }: { mode: 'sales' | 'history' | 'receipts'; rows: SaleRow[]; onDetail: (id: number) => void; onReceipt: (id: number) => void }) {
  return <CommerceTable label={mode === 'receipts' ? 'Recibos' : 'Ventas'}><thead><tr><th>Número</th><th>Fecha y hora</th><th>Cliente</th><th>Responsable</th>{mode !== 'sales' && <th>Artículos</th>}<th>Pago</th><th>Total</th><th>Estado</th><th data-action>Acciones</th></tr></thead><tbody>{rows.map(row => <tr key={row.sale_id}>
    <td><strong>{mode === 'receipts' ? String(row.receipt_id) : `V-${String(row.sale_id).padStart(5, '0')}`}</strong>{mode === 'receipts' && <small>Venta V-{String(row.sale_id).padStart(5, '0')}</small>}</td>
    <td data-label="Fecha y hora"><span>{dateText(row.sale_date)}</span><small>{timeText(row.created_at)}</small></td><td data-label="Cliente">{row.customer_name || 'Identidad histórica no registrada'}</td><td data-label="Responsable">{row.seller_name || 'Identidad histórica no registrada'}</td>
    {mode !== 'sales' && <td data-label="Artículos">{row.units}</td>}<td data-label="Pago">{row.method ? methodLabels[row.method] : 'Sin cobro registrado'}</td><td data-label="Total" data-money data-total>{money(row.total)}</td><td data-label="Estado"><Badge status={row.status} /></td>
    <td data-action><div className={sales.rowActions}><button type="button" className="secondary" onClick={() => mode === 'receipts' ? onReceipt(row.sale_id) : onDetail(row.sale_id)}>Ver</button>{row.receipt_id && <button type="button" className="secondary" onClick={() => onReceipt(row.sale_id)}>{mode === 'receipts' ? 'Imprimir / PDF' : 'Recibo'}</button>}</div></td>
  </tr>)}</tbody></CommerceTable>
}
