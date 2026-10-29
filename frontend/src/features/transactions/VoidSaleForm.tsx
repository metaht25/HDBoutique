import { useState } from 'react'
import type { FormEvent } from 'react'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { Message } from '../../shared/ui/Feedback'
import type { Shift } from '../cash-register/api'
import { useCashCommand } from '../cash-register/useCashCommand'
import type { Transaction } from './api'
import { inputId } from '../../shared/forms/fields'

export function VoidSaleForm({ userId, sale, shifts, onSaved }: { userId: number; sale: Transaction; shifts: Shift[]; onSaved: () => void }) {
  const command = useCashCommand(userId, `void.${sale.id}`, onSaved)
  const [reason, setReason] = useState(''), [shiftId, setShiftId] = useState(String(shifts[0]?.shift_id ?? '')), [reference, setReference] = useState(''), [confirmed, setConfirmed] = useState(false)
  const [returned, setReturned] = useState<Record<number, string>>({})
  if (sale.status === 'voided' && !command.pending && !command.blocked) return null
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (command.pending) { await command.send('', {}); return }
    const shift = inputId(shiftId)
    if (!reason.trim() || !confirmed || !shift || (sale.payment?.method === 'transfer' && !reference.trim()) || sale.items.some(item => !/^\d+$/.test(returned[item.line_id] ?? '') || Number(returned[item.line_id]) > item.quantity)) {
      command.setError('Indica motivo, turno, cantidades realmente devueltas (incluido cero), y confirma el reintegro completo.'); return
    }
    await command.send(`/api/v1/sales/${sale.id}/void`, { shift_id: shift, reason, refund_confirmed: true,
      ...(sale.payment?.method === 'transfer' ? { reference } : {}), items: sale.items.map(item => ({ sale_item_id: item.line_id, returned_quantity: Number(returned[item.line_id]) })) })
  }
  return <form noValidate onSubmit={event => void submit(event)}><h4>Anular venta completa</h4><p>Conserva el original. Reintegra todo el importe por el mismo medio de pago. Repone solo la mercancía físicamente devuelta; después registra la venta correcta.</p>
    <SelectField label="Turno para el reintegro" value={shiftId} disabled={command.locked} onChange={event => setShiftId(event.target.value)}><option value="">Selecciona</option>{shifts.map(row => <option key={row.shift_id} value={row.shift_id}>Turno #{row.shift_id}</option>)}</SelectField>
    <TextField label="Motivo de anulación" maxLength={300} value={reason} disabled={command.locked} onChange={event => setReason(event.target.value)} />
    {sale.items.map(item => <TextField key={item.line_id} label={`Cantidad devuelta de producto #${item.product_id} (vendidas ${item.quantity})`} inputMode="numeric" value={returned[item.line_id] ?? ''} disabled={command.locked} onChange={event => setReturned({ ...returned, [item.line_id]: event.target.value })} />)}
    {sale.payment?.method === 'transfer' && <TextField label="Referencia del reintegro por transferencia" maxLength={100} value={reference} disabled={command.locked} onChange={event => setReference(event.target.value)} />}
    <label><input type="checkbox" disabled={command.locked} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Confirmo el reintegro completo al cliente y las cantidades devueltas</label>
    {command.error && <Message>{command.error}</Message>}{command.pending && <Message variant="info">Anulación pendiente de confirmar. Reintenta la misma operación.</Message>}
    <div><button type="submit" disabled={command.busy || command.blocked}>{command.busy ? 'Confirmando…' : command.pending ? 'Reintentar misma anulación' : 'Confirmar anulación total'}</button></div>
  </form>
}
