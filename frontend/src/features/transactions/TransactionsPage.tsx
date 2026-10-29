import { EmployeeSelect } from '../employees/EmployeeSelect'
import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { ModuleAccess } from '../session/ModuleAccess'
import { useSession } from '../session/sessionContext'
import { getErrorMessage } from '../../shared/api/errors'
import { exactMoney, inputId } from '../../shared/forms/fields'
import { useResource } from '../../shared/hooks/useResource'
import { LoadingState, Message } from '../../shared/ui/Feedback'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { TableContainer } from '../../shared/ui/TableContainer'
import { PageNavigation } from '../../shared/ui/PageNavigation'
import { reportMoney } from '../reports/api'
import { listTransactions, receivePurchase, registerTransaction, transactionOptions } from './api'
import type { Transaction, TransactionInput, TransactionKind } from './api'
import { clearIntent, isDefinitiveRejection, readIntent, storeIntent } from './pending'
import type { PendingIntent } from './pending'
import { VoidSaleForm } from './VoidSaleForm'
import styles from '../../shared/ui/Management.module.css'

type Options = Awaited<ReturnType<typeof transactionOptions>>
interface DraftLine { id: number; quantity: number }

function TransactionForm({ kind, options, userId, linkedEmployee, onSaved }: {
  kind: TransactionKind; options: Options; userId: number; linkedEmployee: number | null; onSaved: (row: Transaction) => void
}) {
  const sales = kind === 'sales'
  const [restored] = useState(() => { try { return { intent: readIntent(userId, kind), error: '' } } catch (error) { return { intent: null, error: getErrorMessage(error, 'No se pudo recuperar la solicitud.') } } })
  const [pending, setPending] = useState<PendingIntent | null>(restored.intent)
  const [party, setParty] = useState(String(restored.intent?.body[sales ? 'customer_id' : 'supplier_id'] ?? ''))
  const [date, setDate] = useState(restored.intent?.body[sales ? 'sale_date' : 'purchase_date'] ?? options.today)
  const [employee, setEmployee] = useState(String(linkedEmployee ?? restored.intent?.body.employee_id ?? (kind === 'sales' ? options.shifts[0]?.employee_id : '') ?? ''))
  const [shipping, setShipping] = useState(restored.intent?.body.shipping_cost ?? '0.00')
  const [shiftId, setShiftId] = useState(String(restored.intent?.body.payment?.shift_id ?? options.shifts[0]?.shift_id ?? ''))
  const [method, setMethod] = useState(restored.intent?.body.payment?.method ?? 'cash')
  const [received, setReceived] = useState(restored.intent?.body.payment?.received_amount ?? '')
  const [reference, setReference] = useState(restored.intent?.body.payment?.reference ?? '')
  const [transferConfirmed, setTransferConfirmed] = useState(restored.intent?.body.payment?.transfer_confirmed ?? false)
  const [lines, setLines] = useState<DraftLine[]>(restored.intent?.body.items.map(item => ({ id: (sales ? item.product_id : item.supplier_product_id)!, quantity: item.quantity })) ?? [])
  const [selected, setSelected] = useState(''), [quantity, setQuantity] = useState('1')
  const [error, setError] = useState(restored.error), [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const choices = sales ? options.products.map(row => ({ id: row.product_id, product_id: row.product_id, price: row.unit_price, stock: row.legacy_stock }))
    : options.costs.filter(cost => options.offerings.some(offering => offering.supplier_id === Number(party) && offering.supplier_product_id === cost.id))
      .map(cost => ({ ...cost, stock: undefined }))
  const estimatedCents = sales ? lines.reduce<bigint | null>((total, line) => {
    const price = options.products.find(row => row.product_id === line.id)?.unit_price
    if (total === null || !price) return null
    const cents = BigInt(price.replace('.', ''))
    return cents > 0n ? total + cents * BigInt(line.quantity) : null
  }, 0n) : null
  function lineName(id: number) {
    const productId = sales ? id : options.costs.find(row => row.id === id)?.product_id
    return options.products.find(row => row.product_id === productId)?.name ?? `Producto #${productId ?? id}`
  }
  function addLine() {
    const id = inputId(selected), count = inputId(quantity)
    if (!id || !count || !choices.some(row => row.id === id)) { setError('Selecciona un producto y una cantidad entera positiva.'); return }
    if (lines.some(row => row.id === id) || lines.length >= 100) { setError('Usa una sola línea por producto, hasta 100 líneas.'); return }
    setLines([...lines, { id, quantity: count }]); setError(''); setSelected(''); setQuantity('1')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || restored.error) return
    let intent = pending
    if (!intent) {
      const partyId = inputId(party), employeeId = inputId(employee), shippingCost = exactMoney(shipping)
      const shift = inputId(shiftId), cashReceived = exactMoney(received)
      if (sales && (!shift || cashReceived === null || cashReceived.startsWith('-') || (method === 'transfer' && (!reference.trim() || !transferConfirmed)))) {
        setError('Selecciona un turno abierto e indica el efectivo recibido o confirma la transferencia con su referencia.'); return
      }
      if (!partyId || !employeeId || !date || !lines.length || (!sales && (shippingCost === null || shippingCost.startsWith('-')))) {
        setError('Completa fecha, cliente/proveedor, empleado existente y líneas; el envío debe ser un importe no negativo con dos decimales.'); return
      }
      const body: TransactionInput = { [sales ? 'customer_id' : 'supplier_id']: partyId, [sales ? 'sale_date' : 'purchase_date']: date,
        ...(linkedEmployee === null ? { employee_id: employeeId } : {}), ...(!sales ? { shipping_cost: shippingCost! } : {}),
        ...(sales ? { payment: method === 'cash' ? { shift_id: shift!, method, received_amount: cashReceived! } : { shift_id: shift!, method, received_amount: cashReceived!, reference, transfer_confirmed: true } } : {}),
        items: lines.map(row => ({ [sales ? 'product_id' : 'supplier_product_id']: row.id, quantity: row.quantity })) }
      intent = { key: crypto.randomUUID(), body }
      try { storeIntent(userId, kind, intent) } catch (error) { setError(getErrorMessage(error, 'No se pudo proteger la solicitud.')); return }
      setPending(intent)
    }
    submitting.current = true; setBusy(true); setError('')
    try {
      const saved = await registerTransaction(kind, intent.body, intent.key)
      clearIntent(userId, kind); setPending(null); onSaved(saved)
    } catch (error) {
      setError(getErrorMessage(error, 'No se pudo confirmar el resultado. Reintenta la misma solicitud para comprobarlo.'))
      if (isDefinitiveRejection(error)) { clearIntent(userId, kind); setPending(null) }
    } finally { submitting.current = false; setBusy(false) }
  }
  const locked = busy || pending !== null || !!restored.error
  return <section className={styles.panel}><h3>{sales ? 'Nueva venta' : 'Nueva compra'}</h3>
    <form className={styles.form} noValidate onSubmit={event => void submit(event)}>
      <div className={styles.grid}>
        <TextField label="Fecha documental" type="date" value={date} disabled={locked} onChange={event => setDate(event.target.value)} />
        <SelectField label={sales ? 'Cliente' : 'Proveedor'} value={party} disabled={locked} onChange={event => { setParty(event.target.value); setLines([]); setSelected('') }}>
          <option value="">Selecciona</option>{options.parties.map(row => <option key={row.id} value={row.id}>{row.name} (#{row.id})</option>)}
        </SelectField>
        <EmployeeSelect label="Empleado responsable" value={employee} disabled={locked || linkedEmployee !== null} onChange={setEmployee} />
        {!sales && <TextField label="Costo de envío (NIO)" inputMode="decimal" value={shipping} disabled={locked} onChange={event => setShipping(event.target.value)} />}
        {sales && <>
          <SelectField label="Turno de caja" value={shiftId} disabled={locked} onChange={event => { setShiftId(event.target.value); if (linkedEmployee === null) setEmployee(String(options.shifts.find(row => String(row.shift_id) === event.target.value)?.employee_id ?? '')) }}>
            <option value="">Selecciona</option>{options.shifts.map(row => <option key={row.shift_id} value={row.shift_id}>Turno #{row.shift_id} · Empleado #{row.employee_id}</option>)}
          </SelectField>
          <SelectField label="Medio de pago completo" value={method} disabled={locked} onChange={event => { setMethod(event.target.value as 'cash' | 'transfer'); setReceived(''); setTransferConfirmed(false) }}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></SelectField>
          <TextField label={method === 'cash' ? 'Efectivo recibido (NIO)' : 'Importe recibido por transferencia (NIO)'} inputMode="decimal" value={received} disabled={locked} onChange={event => { setReceived(event.target.value); setTransferConfirmed(false) }} />
          {method === 'transfer' && <>
            <TextField label="Referencia de transferencia" maxLength={100} value={reference} disabled={locked} onChange={event => setReference(event.target.value)} />
            <label><input type="checkbox" checked={transferConfirmed} disabled={locked} onChange={event => setTransferConfirmed(event.target.checked)} /> Confirmé la recepción de la transferencia completa</label>
          </>}
        </>}
        <SelectField label={sales ? 'Producto' : 'Producto ofrecido por el proveedor'} value={selected} disabled={locked} onChange={event => setSelected(event.target.value)}>
          <option value="">Selecciona</option>{choices.map(row => <option key={row.id} value={row.id}>
            {lineName(row.id)} · {reportMoney(row.price)}{sales ? ` · Disponible: ${row.stock ?? 'Sin conteo'}` : ''} (#{row.id})</option>)}
        </SelectField>
        <TextField label="Cantidad" inputMode="numeric" value={quantity} disabled={locked} onChange={event => setQuantity(event.target.value)} />
      </div>
      <div><button type="button" disabled={locked} onClick={addLine}>Agregar línea</button></div>
      <TableContainer label="Líneas pendientes"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Acciones</th></tr></thead><tbody>
        {lines.map(row => <tr key={row.id}><td>{lineName(row.id)}</td><td>{row.quantity}</td><td><button type="button" disabled={locked} aria-label={`Quitar línea ${row.id}`} onClick={() => setLines(lines.filter(line => line.id !== row.id))}>Quitar</button></td></tr>)}
      </tbody></table></TableContainer>
      {sales && <p>Total estimado del catálogo: {estimatedCents === null ? 'Sin precio válido' : `C$${estimatedCents / 100n}.${(estimatedCents % 100n).toString().padStart(2, '0')}`}. El servidor confirma el precio al guardar.</p>}
      <p className={styles.note}>El servidor confirma precios e importes. {sales ? 'Venta, cobro completo y salida de inventario se confirman juntos. Abre caja antes de vender. No hay crédito ni abonos.' : 'Registrar no cambia existencias. La recepción completa se confirma por separado, una sola vez.'}</p>
      {pending && <Message variant="info">Hay una solicitud pendiente de confirmar. Se conserva la misma clave al reintentar o recargar esta pestaña.</Message>}
      {error && <Message>{error}</Message>}
      <div><button type="submit" disabled={busy || !!restored.error}>{busy ? 'Confirmando…' : pending ? 'Reintentar misma solicitud' : sales ? 'Confirmar venta' : 'Registrar compra'}</button></div>
    </form>
  </section>
}

function TransactionsWorkspace({ kind }: { kind: TransactionKind }) {
  const { state } = useSession()
  const [params, setParams] = useSearchParams(), [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<Transaction | null>(null), [notice, setNotice] = useState(''), [error, setError] = useState('')
  const [receiving, setReceiving] = useState(false), [employee, setEmployee] = useState('')
  const receiptLock = useRef(false)
  const page = inputId(params.get('page') ?? '1') ?? 1
  const load = useCallback((signal: AbortSignal) => listTransactions(kind, page, signal), [kind, page])
  const loadOptions = useCallback((signal: AbortSignal) => transactionOptions(kind, signal), [kind])
  const result = useResource(`${kind}:${page}:${revision}`, load), options = useResource(`${kind}:options:${revision}`, loadOptions)
  if (state.status !== 'authenticated') return null
  const account = state.account, sales = kind === 'sales', rows = result?.data?.slice(0, 20) ?? []
  async function receive() {
    if (!selected || receiptLock.current) return
    const employeeId = inputId(employee)
    if (account.employee_id === null && !employeeId) { setError('Indica el ID de un empleado existente para recibir.'); return }
    receiptLock.current = true; setReceiving(true); setError('')
    try { const saved = await receivePurchase(selected.id, account.employee_id ?? employeeId ?? undefined); setSelected(saved); setNotice(`Compra #${saved.id} recibida correctamente.`); setRevision(value => value + 1) }
    catch (error) { setError(getErrorMessage(error, 'No se pudo confirmar la recepción. Puedes reintentar la misma compra.')) }
    finally { receiptLock.current = false; setReceiving(false) }
  }
  return <div className={styles.page}><div className={styles.header}><div><h2>{sales ? 'Ventas confirmadas' : 'Compras y recepciones'}</h2><p>Precios e inventario confirmados por el servidor.</p></div>
    <button type="button" onClick={() => setRevision(value => value + 1)}>Recargar {sales ? 'ventas' : 'compras'}</button></div>
    {notice && <Message variant="success">{notice}</Message>}
    {!options ? <LoadingState>Cargando opciones…</LoadingState> : options.error !== undefined ? <Message>{getErrorMessage(options.error, 'No se pudieron cargar opciones.')}</Message>
      : options.data && <TransactionForm key={`${account.user_id}:${kind}:${revision}`} kind={kind} userId={account.user_id} linkedEmployee={account.employee_id} options={options.data}
        onSaved={row => { setNotice(`${sales ? 'Venta' : 'Compra'} #${row.id} registrada correctamente. Total: ${reportMoney(row.total)}`); setSelected(row); setRevision(value => value + 1) }} />}
    {!result ? <LoadingState>Cargando operaciones…</LoadingState> : result.error !== undefined ? <Message>{getErrorMessage(result.error, 'No se pudieron cargar operaciones.')}</Message>
      : rows.length === 0 ? <p>No hay operaciones en esta página.</p> : <section className={styles.panel}><TableContainer label={sales ? 'Ventas' : 'Compras'}><table>
        <thead><tr><th>ID</th><th>Fecha</th><th>{sales ? 'Cliente' : 'Proveedor'}</th><th>Estado</th><th>Total NIO</th><th>Acciones</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>
          <td>{row.id}</td><td>{row.date}</td><td>#{row.party_id}</td><td>{row.status === null ? 'Histórica' : row.status === 'voided' ? 'Anulada' : row.status === 'confirmed' ? 'Confirmada' : row.status === 'received' ? 'Recibida' : 'Registrada'}</td><td>{reportMoney(row.total)}</td>
          <td><button type="button" onClick={() => { setSelected(row); setError('') }} aria-label={`Ver detalle ${row.id}`}>Ver detalle</button></td></tr>)}</tbody>
      </table></TableContainer></section>}
    <PageNavigation page={page} hasNext={(result?.data?.length ?? 0) > 20} onPageChange={next => setParams({ page: String(next) })} />
    {selected && <section className={styles.panel}><h3>Detalle #{selected.id}</h3><p>Fecha: {selected.date} · Empleado #{selected.employee_id} · Total: {reportMoney(selected.total)}</p>
      {!sales && <p>Mercancía: {reportMoney(selected.merchandise_total ?? null)} · Envío: {reportMoney(selected.shipping_cost ?? null)}</p>}
      {sales && selected.payment && <p>Pago completo: {selected.payment.method === 'cash' ? 'Efectivo' : 'Transferencia'} · {reportMoney(selected.payment.amount)} · Recibido: {reportMoney(selected.payment.received_amount)} · Cambio: {reportMoney(selected.payment.change_amount)} · Referencia: {selected.payment.reference ?? 'No aplica'} · Turno #{selected.payment.shift_id}</p>}
      {sales && selected.annulment && <Message variant="info">Venta anulada. Motivo: {selected.annulment.reason}. Reintegro completo: {reportMoney(selected.annulment.amount)} ({selected.annulment.method === 'cash' ? 'efectivo' : 'transferencia'}). Referencia: {selected.annulment.reference ?? 'No aplica'}. Mercancía devuelta: {selected.annulment.items.map(item => `línea #${item.sale_item_id}: ${item.returned_quantity}`).join('; ')}.</Message>}
      <TableContainer label="Detalle de operación"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio histórico NIO</th><th>Subtotal NIO</th></tr></thead>
        <tbody>{selected.items.map(line => <tr key={line.line_id}><td>{line.product_id === null ? `Proveedor-producto #${line.supplier_product_id}` : `Producto #${line.product_id}`}</td><td>{line.quantity}</td><td>{reportMoney(line.unit_price)}</td><td>{reportMoney(line.subtotal)}</td></tr>)}</tbody>
      </table></TableContainer>
      {!sales && selected.status === 'registered' && <><EmployeeSelect label="Empleado para recepción" disabled={receiving || account.employee_id !== null} value={account.employee_id ?? employee} onChange={setEmployee} />
        <button disabled={receiving} type="button" onClick={() => void receive()}>{receiving ? 'Recibiendo…' : 'Confirmar recepción completa'}</button></>}
      {!sales && selected.status === null && <p>Compra histórica: requiere conciliación; no se infiere recepción ni coste faltante.</p>}
      {sales && (selected.status === 'confirmed' || selected.status === 'voided') && selected.payment && account.role !== 'Cashier' && <VoidSaleForm key={`${account.user_id}:${selected.id}`} userId={account.user_id} sale={selected} shifts={options?.data?.shifts ?? []}
        onSaved={() => { setNotice(`Venta #${selected.id} anulada con reintegro completo.`); setSelected(null); setRevision(value => value + 1) }} />}
      {error && <Message>{error}</Message>}
    </section>}
  </div>
}

function Access({ kind }: { kind: TransactionKind }) {
  const { state } = useSession()
  if (kind === 'purchases' && state.status === 'authenticated' && state.account.role === 'Cashier') return <Message>No tienes permiso para consultar compras.</Message>
  return <TransactionsWorkspace kind={kind} />
}
export function TransactionsPage({ kind }: { kind: TransactionKind }) { return <ModuleAccess><Access kind={kind} /></ModuleAccess> }
