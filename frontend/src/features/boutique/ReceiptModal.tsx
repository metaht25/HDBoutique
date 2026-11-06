import { useState } from 'react'
import { createPortal } from 'react-dom'
import { apiClient } from '../../shared/api/client'
import { getErrorMessage } from '../../shared/api/errors'
import { Message } from '../../shared/ui/Feedback'
import { dateText, methodLabels, money, timeText, useQuery } from './api'
import type { Receipt } from './contracts'
import { Badge, DataState, Modal } from './ui'
import styles from './Boutique.module.css'
import { Icon } from '../../shared/ui/Icon'
import { CommerceEmpty, CommerceSection } from './CommerceUI'
import ui from './Commerce.module.css'
import receipts from './Receipts.module.css'

export function Ticket({ receipt }: { receipt: Receipt }) {
  const { boutique, sale } = receipt, payment = sale.payment
  return <article className={styles.ticket} aria-label="Ticket de 80 mm"><header>
    {boutique.logo_base64 && <img src={'data:image/png;base64,' + boutique.logo_base64} alt="Logo de la boutique" />}
    <h3>{boutique.name ?? 'H&D Boutique'}</h3>
    {boutique.ready ? <>{boutique.phone_number && <p>{boutique.phone_number}</p>}<p>{boutique.address_line}</p></> : <p>Datos de la boutique pendientes de completar</p>}
    <p><b>{receipt.receipt_number} · {receipt.sale_number}</b></p><p>{dateText(sale.sale_date)} · {timeText(sale.created_at)}</p>
  </header><hr /><p>Cliente: {sale.customer_name ?? 'Identidad histórica no registrada'}</p>
    {sale.customer_phone && <p>Teléfono: {sale.customer_phone}</p>}{sale.customer_address && <p>{sale.customer_address}</p>}
    <p>Vendedor: {sale.seller_name ?? 'Identidad histórica no registrada'}</p><hr />
    {sale.items.map(item => <div key={item.sale_item_id}><b>{item.product_name ?? `Producto #${item.product_id}`} · {item.size_name ?? 'Talla no registrada'}</b><p className={styles.ticketLine}><span>{item.quantity} × {money(item.unit_price)}</span><span>{money(item.subtotal)}</span></p></div>)}
    <hr />{sale.customer_kind === 'delivery' && <p className={styles.ticketLine}><span>Delivery</span><span>{money(sale.delivery_cost)}</span></p>}
    <p className={styles.ticketTotal}>TOTAL {money(sale.total)}</p>
    {payment && <><p>Pago: {methodLabels[payment.method]}</p>{payment.method === 'mixed' && <><p>Efectivo aplicado: {money(payment.cash_amount)}</p><p>Transferencia: {money(payment.transfer_amount)}</p></>}
      {payment.method !== 'transfer' && <><p>Efectivo recibido: {money(payment.received_amount)}</p><p>Cambio: {money(payment.change_amount)}</p></>}{payment.reference && <p>Referencia: {payment.reference}</p>}</>}
    <hr /><p><b>{sale.status === 'voided' ? 'ANULADO' : 'PAGADO · EMITIDO'}</b></p>
    {sale.annulment && <><p>Motivo: {sale.annulment.reason}</p><p>Reintegro: {money(sale.annulment.amount)}</p>{sale.payment?.method === 'mixed' && <><p>Efectivo reintegrado: {money(sale.annulment.cash_amount)}</p><p>Transferencia reintegrada: {money(sale.annulment.transfer_amount)}</p></>}{sale.annulment.reference && <p>Referencia del reintegro: {sale.annulment.reference}</p>}</>}
    {sale.notes && <p>Notas: {sale.notes}</p>}<h3>¡Gracias por tu compra!</h3>
  </article>
}
export function ReceiptModal({ saleId, onClose }: { saleId: number; onClose: () => void }) {
  const result = useQuery<Receipt>(`receipts/${saleId}`), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function download() {
    setBusy(true); setError('')
    try {
      const blob = await apiClient.request<Blob>(`/api/v1/receipts/${saleId}/pdf`, { responseType: 'blob' })
      if (blob.type !== 'application/pdf' || !(await blob.slice(0, 5).text()).startsWith('%PDF-')) throw new Error('Invalid PDF')
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = `${result?.data?.receipt_number ?? 'recibo'}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (error) { setError(getErrorMessage(error, 'No se pudo descargar el PDF.')) } finally { setBusy(false) }
  }
  return <Modal title="Vista previa del recibo" wide onClose={onClose}><div className={styles.form}>
    {!result ? <CommerceEmpty title="Cargando recibo…" loading /> : <DataState result={result}>{result?.data && <>
      <div className={receipts.layout}><section className={receipts.preview} aria-label="Vista previa de 80 mm"><div className={receipts.previewHeader}><span>Ticket · 80 mm</span><Badge status={result.data.sale.status ?? 'legacy'} /></div><div className={receipts.paper}><Ticket receipt={result.data} /></div></section>
        <aside className={receipts.context} aria-label="Información del recibo"><div className={ui.formIntro}><span className={ui.icon}><Icon name="receipt" /></span><p><strong>Recibo {result.data.receipt_number}</strong>{result.data.sale_number}</p></div>
          <CommerceSection title="Información comercial"><dl className={ui.contact}><dt>Fecha y hora</dt><dd>{dateText(result.data.sale.sale_date)} · {timeText(result.data.sale.created_at)}</dd><dt>Cliente</dt><dd>{result.data.sale.customer_name ?? 'Identidad histórica no registrada'}</dd><dt>Vendedor</dt><dd>{result.data.sale.seller_name ?? 'Identidad histórica no registrada'}</dd><dt>Método de pago</dt><dd>{result.data.sale.payment ? methodLabels[result.data.sale.payment.method] : 'Sin cobro registrado'}</dd></dl></CommerceSection>
          <div className={ui.summary}><div><p>Total del recibo</p><strong>{money(result.data.sale.total)}</strong></div></div>
          <div className={ui.note}><Icon name="receipt" size={20} /><p><strong>Listo para conservar</strong>Imprime el ticket en papel de 80 mm o descarga el PDF con su numeración original.</p></div>
        </aside>
      </div>
      {createPortal(<div id="receipt-print"><style>{'@media print { @page { size: 80mm 297mm; margin: 0; } }'}</style><Ticket receipt={result.data} /></div>, document.body)}
    </>}</DataState>}
    {error && <Message>{error}</Message>}<div className={ui.footer}><button type="button" className="secondary" onClick={onClose}>Cerrar</button><button type="button" className="secondary" disabled={!result?.data} onClick={() => window.print()}>Imprimir ticket</button><button type="button" disabled={!result?.data || busy} onClick={() => void download()}>{busy ? 'Preparando…' : 'Exportar PDF'}</button></div>
  </div></Modal>
}
