import { useState } from 'react'
import type { FormEvent } from 'react'
import { TextField } from '../../shared/ui/TextField'
import { Message } from '../../shared/ui/Feedback'
import { useCashCommand } from '../cash-register/useCashCommand'
import type { Transaction } from './api'

export function VoidSaleForm({ userId, sale, onSaved }: { userId: number; sale: Transaction; onSaved: () => void }) {
  const command = useCashCommand(userId, `void.${sale.id}`, onSaved)
  const [reason, setReason] = useState(''), [reference, setReference] = useState(''), [confirmed, setConfirmed] = useState(false)
  const [returned, setReturned] = useState<Record<number, string>>({})
  if (sale.status === 'voided' && !command.pending && !command.blocked) return null
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (command.pending) { await command.send('', {}); return }
    if (!reason.trim() || !confirmed || ((sale.payment?.method === 'transfer' || sale.payment?.method === 'mixed') && !reference.trim()) || sale.items.some(item => !/^\d+$/.test(returned[item.line_id] ?? '') || Number(returned[item.line_id]) > item.quantity)) {
      command.setError('Indica motivo, cantidades realmente devueltas (incluido cero), y confirma el reintegro completo.'); return
    }
    await command.send(`/api/v1/sales/${sale.id}/void`, { reason, refund_confirmed: true,
      ...((sale.payment?.method === 'transfer' || sale.payment?.method === 'mixed') ? { reference } : {}), items: sale.items.map(item => ({ sale_item_id: item.line_id, returned_quantity: Number(returned[item.line_id]) })) })
  }
  return <form noValidate onSubmit={event => void submit(event)}><h4>Anular venta completa</h4><p>Conserva el original. Reintegra todo el importe por el mismo medio de pago. Repone solo la mercancía físicamente devuelta; después registra la venta correcta.</p>
    <TextField label="Motivo de anulación" maxLength={300} value={reason} disabled={command.locked} onChange={event => setReason(event.target.value)} />
    {sale.items.map(item => <TextField key={item.line_id} label={`Cantidad devuelta de producto #${item.product_id} (vendidas ${item.quantity})`} inputMode="numeric" value={returned[item.line_id] ?? ''} disabled={command.locked} onChange={event => setReturned({ ...returned, [item.line_id]: event.target.value })} />)}
    {(sale.payment?.method === 'transfer' || sale.payment?.method === 'mixed') && <TextField label="Referencia del reintegro por transferencia" maxLength={100} value={reference} disabled={command.locked} onChange={event => setReference(event.target.value)} />}
    <label><input type="checkbox" disabled={command.locked} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Confirmo el reintegro completo al cliente y las cantidades devueltas</label>
    {command.error && <Message>{command.error}</Message>}{command.pending && <Message variant="info">Anulación pendiente de confirmar. Reintenta la misma operación.</Message>}
    <div><button type="submit" disabled={command.busy || command.blocked}>{command.busy ? 'Confirmando…' : command.pending ? 'Reintentar misma anulación' : 'Confirmar anulación total'}</button></div>
  </form>
}
