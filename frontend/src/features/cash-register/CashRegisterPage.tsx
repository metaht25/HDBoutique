import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { ModuleAccess } from '../session/ModuleAccess'
import { useSession } from '../session/sessionContext'
import { useResource } from '../../shared/hooks/useResource'
import { exactMoney, inputId } from '../../shared/forms/fields'
import { getErrorMessage } from '../../shared/api/errors'
import { LoadingState, Message } from '../../shared/ui/Feedback'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { PageNavigation } from '../../shared/ui/PageNavigation'
import { TableContainer } from '../../shared/ui/TableContainer'
import { reportMoney } from '../reports/api'
import { listShifts } from './api'
import type { Shift } from './api'
import { useCashCommand } from './useCashCommand'
import styles from '../../shared/ui/Management.module.css'

function CashForm({ userId, linkedEmployee, supervisor, shift, onSaved }: { userId: number; linkedEmployee: number | null; supervisor: boolean; shift: Shift | null; onSaved: () => void }) {
  const command = useCashCommand(userId, 'register', onSaved)
  const [action, setAction] = useState(shift ? 'close' : 'open'), [amount, setAmount] = useState(''), [reason, setReason] = useState(''), [employee, setEmployee] = useState(String(linkedEmployee ?? ''))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (command.pending) { await command.send('', {}); return }
    const value = exactMoney(amount), employeeId = inputId(employee)
    if (value === null || value.startsWith('-') || (action === 'open' && !employeeId) || (['deposit', 'withdrawal'].includes(action) && (value === '0.00' || !reason.trim()))) {
      command.setError('Indica un importe válido, empleado existente para abrir y motivo para ingresos/retiros.'); return
    }
    const path = action === 'open' ? '/api/v1/cash/shifts' : `/api/v1/cash/shifts/${shift?.shift_id}/${action === 'close' ? 'close' : 'movements'}`
    const body = action === 'open' ? { employee_id: employeeId, opening_amount: value }
      : action === 'close' ? { counted_amount: value, ...(reason.trim() ? { reason } : {}) } : { kind: action, amount: value, reason }
    await command.send(path, body)
  }
  return <section className={styles.panel}><h3>{shift ? `Operar turno #${shift.shift_id}` : 'Abrir caja principal'}</h3>
    <form className={styles.form} noValidate onSubmit={event => void submit(event)}>
      <SelectField label="Operación de caja" value={action} disabled={command.locked} onChange={event => { setAction(event.target.value); setAmount(''); setReason('') }}>
        {shift ? <><option value="close">Cerrar turno</option>{supervisor && <><option value="deposit">Ingreso de efectivo</option><option value="withdrawal">Retiro de efectivo</option></>}</> : <option value="open">Abrir turno</option>}
      </SelectField>
      {!shift && <TextField label="ID de empleado responsable" inputMode="numeric" value={employee} disabled={command.locked || linkedEmployee !== null} onChange={event => setEmployee(event.target.value)} />}
      <TextField label={action === 'open' ? 'Efectivo inicial contado (NIO)' : action === 'close' ? 'Efectivo final contado (NIO)' : 'Importe de efectivo (NIO)'} inputMode="decimal" value={amount} disabled={command.locked} onChange={event => setAmount(event.target.value)} />
      {shift && <TextField label="Motivo / observaciones" maxLength={300} value={reason} disabled={command.locked} onChange={event => setReason(event.target.value)} />}
      {action === 'close' && <p>El servidor concilia el conteo con el efectivo esperado. Si existe diferencia, un administrador o encargado debe cerrar con motivo. El cierre es definitivo.</p>}
      {command.pending && <Message variant="info">Operación pendiente de confirmar. Se conserva al recargar. Reintenta para comprobar su resultado.</Message>}
      {command.error && <Message>{command.error}</Message>}
      <div><button disabled={command.busy || command.blocked} type="submit">{command.busy ? 'Confirmando…' : command.pending ? 'Reintentar misma operación' : 'Confirmar operación de caja'}</button></div>
    </form>
  </section>
}

function Workspace() {
  const { state } = useSession(), [params, setParams] = useSearchParams(), [revision, setRevision] = useState(0), [notice, setNotice] = useState('')
  const page = inputId(params.get('page') ?? '1') ?? 1
  const load = useCallback((signal: AbortSignal) => listShifts(signal, page), [page])
  const result = useResource(`cash:${page}:${revision}`, load)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  if (state.status !== 'authenticated') return null
  const rows = result?.data?.slice(0, 20) ?? [], active = rows.find(row => row.status === 'open') ?? null
  const selected = rows.find(row => row.shift_id === selectedId) ?? active
  const account = state.account
  return <div className={styles.page}><div className={styles.header}><div><h2>Caja</h2><p>Caja principal · NIO · ventas con pago completo en efectivo o transferencia.</p></div>
    <button type="button" onClick={() => setRevision(value => value + 1)}>Recargar caja</button></div>
    {notice && <Message variant="success">{notice}</Message>}
    {!result ? <LoadingState>Cargando caja…</LoadingState> : result.error !== undefined ? <Message>{getErrorMessage(result.error, 'No se pudo cargar caja.')}</Message> : <>
      <CashForm key={`${account.user_id}:${revision}:${active?.shift_id ?? 'new'}`} userId={account.user_id} linkedEmployee={account.employee_id} supervisor={account.role !== 'Cashier'} shift={active}
        onSaved={() => { setNotice('Operación de caja confirmada.'); setRevision(value => value + 1); setParams({}) }} />
      {selected && <section className={styles.panel}><h3>Turno #{selected.shift_id} · {selected.status === 'open' ? 'Abierto' : 'Cerrado'}</h3>
        <p>Empleado #{selected.employee_id} · Apertura {selected.opened_at} · Cuenta #{selected.opened_by_user_id}</p>
        <p>Inicial: {reportMoney(selected.opening_amount)} · Cobrado en efectivo: {reportMoney(selected.cash_collected)} · Transferencias: {reportMoney(selected.transfers_collected)}</p>
        <p>Reintegros en efectivo: {reportMoney(selected.cash_refunded)} · Reintegros por transferencia: {reportMoney(selected.transfers_refunded)}</p>
        <p>Ingresos: {reportMoney(selected.deposits)} · Retiros: {reportMoney(selected.withdrawals)} · Efectivo esperado: {reportMoney(selected.expected_amount)}</p>
        {selected.status === 'closed' && <p>Contado: {reportMoney(selected.counted_amount)} · Diferencia: {reportMoney(selected.difference)} · Motivo: {selected.closing_reason ?? 'Sin diferencia'} · Cierre: {selected.closed_at} · Cuenta #{selected.closed_by_user_id}</p>}
        <TableContainer label="Movimientos de efectivo"><table><thead><tr><th>Tipo</th><th>NIO</th><th>Motivo</th><th>Cuenta</th></tr></thead><tbody>{selected.movements.map(row => <tr key={row.movement_id}><td>{row.kind === 'deposit' ? 'Ingreso' : 'Retiro'}</td><td>{reportMoney(row.amount)}</td><td>{row.reason}</td><td>#{row.performed_by_user_id}</td></tr>)}</tbody></table></TableContainer>
      </section>}
      <section className={styles.panel}><h3>Historial de turnos</h3><TableContainer label="Turnos de caja"><table><thead><tr><th>Turno</th><th>Estado</th><th>Empleado</th><th>Apertura</th><th>Detalle</th></tr></thead><tbody>{rows.map(row => <tr key={row.shift_id}><td>#{row.shift_id}</td><td>{row.status === 'open' ? 'Abierto' : 'Cerrado'}</td><td>#{row.employee_id}</td><td>{row.opened_at}</td><td><button type="button" onClick={() => setSelectedId(row.shift_id)}>Ver turno #{row.shift_id}</button></td></tr>)}</tbody></table></TableContainer></section>
      <PageNavigation page={page} hasNext={(result.data?.length ?? 0) > 20} onPageChange={next => setParams({ page: String(next) })} />
    </>}
  </div>
}
export default function CashRegisterPage() { return <ModuleAccess><Workspace /></ModuleAccess> }
