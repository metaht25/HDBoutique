import { useState } from 'react'
import { useSession } from '../session/sessionContext'
import { VoidSaleForm } from '../transactions/VoidSaleForm'
import { parseTransaction } from '../transactions/api'
import { Icon } from '../../shared/ui/Icon'
import { dateText, methodLabels, money, timeText, useQuery } from './api'
import type { Sale } from './contracts'
import { Badge, DataState, Modal } from './ui'
import { CommerceEmpty, CommerceSection, CommerceTable } from './CommerceUI'
import styles from './Boutique.module.css'
import ui from './Commerce.module.css'
import sales from './Sales.module.css'

export function SaleDetail({ id, onClose, onChanged, onReceipt }: { id: number; onClose: () => void; onChanged: () => void; onReceipt: () => void }) {
  const account = useSession().state.account!, [revision, setRevision] = useState(0), [voiding, setVoiding] = useState(false)
  const result = useQuery<Sale>(`sales/${id}`, revision), sale = result?.data
  return <Modal title={`Venta V-${String(id).padStart(5, '0')}`} wide onClose={onClose}>
    {!result ? <CommerceEmpty title="Cargando detalle de venta…" loading /> : <DataState result={result}>{sale && <div className={styles.form}>
      <div className={ui.detailTop}><div className={ui.introCopy}><span className={ui.icon}><Icon name="sales" /></span><p><strong>Detalle de la operación</strong>{dateText(sale.sale_date)} · {timeText(sale.created_at)}</p></div><Badge status={sale.status ?? 'legacy'} /></div>
      <div className={sales.details}><CommerceSection title="Cliente y entrega"><dl className={ui.contact}><dt>Cliente</dt><dd>{sale.customer_name ?? `Cliente histórico #${sale.customer_id}`}</dd>{sale.customer_phone && <><dt>Teléfono</dt><dd>{sale.customer_phone}</dd></>}{sale.customer_address && <><dt>Entrega</dt><dd>{sale.customer_address}</dd></>}</dl></CommerceSection><CommerceSection title="Responsable"><dl className={ui.contact}><dt>Vendedor</dt><dd>{sale.seller_name ?? `Empleado histórico #${sale.employee_id}`}</dd><dt>Método de pago</dt><dd>{sale.payment ? methodLabels[sale.payment.method] : 'Sin cobro registrado'}</dd></dl></CommerceSection></div>
      <CommerceSection title="Productos de la venta"><CommerceTable label="Detalle de venta"><thead><tr><th>Producto</th><th>Talla</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>{sale.items.map(item => <tr key={item.sale_item_id}><td><strong>{item.product_name ?? `Producto #${item.product_id}`}</strong></td><td data-label="Talla">{item.size_name ?? '—'}</td><td data-label="Cantidad">{item.quantity}</td><td data-label="Precio" data-money>{money(item.unit_price)}</td><td data-label="Subtotal" data-money data-total>{money(item.subtotal)}</td></tr>)}</tbody></CommerceTable></CommerceSection>
      <div className={ui.summary}><div><p>Total de la venta</p><strong>{money(sale.total)}</strong></div><span>{sale.payment ? methodLabels[sale.payment.method] : 'Sin cobro registrado'}</span></div>
      {(sale.payment || sale.customer_kind === 'delivery') && <CommerceSection title="Desglose de importes"><dl className={sales.breakdown}>
        {sale.customer_kind === 'delivery' && <div><dt>Delivery</dt><dd>{money(sale.delivery_cost)}</dd></div>}
        {sale.payment && <>{sale.payment.method === 'mixed' && <><div><dt>Efectivo aplicado</dt><dd>{money(sale.payment.cash_amount)}</dd></div><div><dt>Transferencia</dt><dd>{money(sale.payment.transfer_amount)}</dd></div></>}{sale.payment.method !== 'transfer' && <><div><dt>Efectivo recibido</dt><dd>{money(sale.payment.received_amount)}</dd></div><div><dt>Cambio</dt><dd>{money(sale.payment.change_amount)}</dd></div></>}{sale.payment.reference && <div><dt>Referencia</dt><dd>{sale.payment.reference}</dd></div>}</>}
      </dl></CommerceSection>}
      {sale.notes && <CommerceSection title="Notas"><p className={ui.muted}>{sale.notes}</p></CommerceSection>}
      {sale.annulment && <div className={ui.note}><Icon name="history" size={20} /><p><strong>Motivo de anulación: {sale.annulment.reason}</strong>Reintegro {money(sale.annulment.amount)}. La venta original se conserva.</p></div>}
      <div className={ui.footer}>{sale.payment && <button type="button" onClick={onReceipt}>Ver recibo</button>}{account.role === 'Administrator' && sale.payment && sale.status !== 'voided' && <button type="button" className="secondary" onClick={() => setVoiding(!voiding)}>{voiding ? 'Cancelar anulación' : 'Anular venta'}</button>}</div>
      {voiding && account.role === 'Administrator' && <section className={sales.correction} aria-label="Anulación de venta"><VoidSaleForm userId={account.user_id} sale={parseTransaction('sales', sale)} onSaved={() => { setVoiding(false); setRevision(value => value + 1); onChanged() }} /></section>}
    </div>}</DataState>}
  </Modal>
}
