import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiClient } from '../../shared/api/client'
import { ApiError, getErrorMessage } from '../../shared/api/errors'
import type { Account, Role } from '../../shared/api/types'
import { inputId, serverFields } from '../../shared/forms/fields'
import type { FieldErrors } from '../../shared/forms/fields'
import { useResource } from '../../shared/hooks/useResource'
import { LoadingState, Message } from '../../shared/ui/Feedback'
import { SelectField } from '../../shared/ui/SelectField'
import { TextField } from '../../shared/ui/TextField'
import { TableContainer } from '../../shared/ui/TableContainer'
import { PageNavigation } from '../../shared/ui/PageNavigation'
import { employeeOptions } from '../employees/api'
import type { EmployeeOption } from '../employees/api'
import { useSession } from '../session/sessionContext'
import { listAccounts, saveAccount } from './api'
import type { AccountRecord } from './api'
import styles from '../../shared/ui/Management.module.css'

const roleLabels: Record<Role, string> = { Administrator: 'Dueña', Cashier: 'Colaborador' }
function accountError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'last_administrator') return 'Debe conservarse al menos una cuenta Dueña activa.'
  if (error instanceof ApiError && error.code === 'account_conflict') return 'El usuario o empleado ya está asignado a otra cuenta.'
  return getErrorMessage(error, 'No se pudo guardar la cuenta.')
}
function AccountForm({ account, employees, accounts, onSaved, onCancel }: {
  account: Account | null; employees: EmployeeOption[]; accounts: AccountRecord[]; onSaved: (account: Account) => void; onCancel: () => void
}) {
  const [username, setUsername] = useState(account?.username ?? ''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('')
  const [role, setRole] = useState<Role>(account?.role ?? 'Cashier'), [active, setActive] = useState(account?.is_active ?? true), [employee, setEmployee] = useState(String(account?.employee_id ?? ''))
  const [busy, setBusy] = useState(false), [fields, setFields] = useState<FieldErrors>({}), [error, setError] = useState('')
  const submitting = useRef(false)
  const available = employees.filter(row => !accounts.some(user => user.user_id !== account?.user_id && user.employee_id === row.employee_id))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    const errors: FieldErrors = {}, body: Record<string, unknown> = {}, employeeId = employee ? inputId(employee) : null
    if (!account && !/^[a-zA-Z0-9_.-]{3,64}$/.test(username.trim())) errors.username = 'Usa de 3 a 64 letras, números, punto, guion o guion bajo.'
    if ((!account || password) && (password.length < 12 || password.length > 128)) errors.password = 'Usa una contraseña de 12 a 128 caracteres.'
    if (password !== confirmation) errors.confirmation = 'Las contraseñas deben coincidir.'
    if (employee && (employeeId === null || !available.some(row => row.employee_id === employeeId))) errors.employee_id = 'Selecciona un empleado disponible.'
    setFields(errors); setError('')
    if (Object.keys(errors).length) return
    if (!account) Object.assign(body, { username: username.trim().toLowerCase(), password, role, employee_id: employeeId })
    else {
      if (role !== account.role) body.role = role
      if (active !== account.is_active) body.is_active = active
      if (employeeId !== account.employee_id) body.employee_id = employeeId
      if (password) body.password = password
    }
    if (!Object.keys(body).length) { setError('No hay cambios para guardar.'); return }
    submitting.current = true; setBusy(true)
    try { const saved = await saveAccount(body, account?.user_id); setPassword(''); setConfirmation(''); onSaved(saved) }
    catch (error) { setError(accountError(error)); setFields(serverFields(error)) }
    finally { setPassword(''); setConfirmation(''); submitting.current = false; setBusy(false) }
  }
  return <section className={styles.panel}><h3>{account ? `Editar cuenta ${account.username}` : 'Nueva cuenta'}</h3>
    <form className={styles.form} noValidate onSubmit={event => void submit(event)}><div className={styles.grid}>
      <TextField label="Usuario" autoComplete="off" value={username} maxLength={64} disabled={busy || !!account} error={fields.username} onChange={event => setUsername(event.target.value)} />
      <SelectField label="Rol" value={role} disabled={busy} error={fields.role} onChange={event => setRole(event.target.value as Role)}>
        {(Object.keys(roleLabels) as Role[]).map(value => <option key={value} value={value}>{roleLabels[value]}</option>)}
      </SelectField>
      <SelectField label="Empleado vinculado" value={employee} disabled={busy} error={fields.employee_id} onChange={event => setEmployee(event.target.value)}>
        <option value="">Sin vínculo</option>{available.map(row => <option key={row.employee_id} value={row.employee_id}>{row.first_names} {row.last_names} (#{row.employee_id})</option>)}
      </SelectField>
      {account && <SelectField label="Estado de la cuenta" value={active ? 'active' : 'inactive'} disabled={busy} error={fields.is_active} onChange={event => setActive(event.target.value === 'active')}><option value="active">Activa</option><option value="inactive">Inactiva</option></SelectField>}
      <TextField label={account ? 'Nueva contraseña (opcional)' : 'Contraseña'} type="password" autoComplete="new-password" value={password} maxLength={128} disabled={busy} error={fields.password} onChange={event => setPassword(event.target.value)} />
      <TextField label="Repetir contraseña" type="password" autoComplete="new-password" value={confirmation} maxLength={128} disabled={busy} error={fields.confirmation} onChange={event => setConfirmation(event.target.value)} />
    </div>
      <p className={styles.note}>El empleado es opcional y exclusivo por cuenta. El cargo del empleado no asigna el rol.</p>
      {account && <Message variant="info">Guardar cambios cierra las sesiones de esta cuenta. Si modificas tu cuenta actual, deberás iniciar sesión de nuevo. El usuario se conserva.</Message>}
      {error && <Message>{error}</Message>}
      <div className={styles.actions}><button type="submit" disabled={busy}>{busy ? 'Guardando…' : account ? 'Actualizar cuenta' : 'Crear cuenta'}</button>
        {account && <button type="button" disabled={busy} onClick={onCancel}>Cancelar edición</button>}</div>
    </form>
  </section>
}

export function AccountsPanel() {
  const { state, refresh } = useSession()
  const [revision, setRevision] = useState(0), [editing, setEditing] = useState<Account | null>(null), [notice, setNotice] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(1)
  const load = useCallback(async (signal: AbortSignal) => { const [accounts, employees] = await Promise.all([listAccounts(signal), employeeOptions(signal)]); return { accounts, employees } }, [])
  const result = useResource(`accounts:${revision}`, load)
  const rows = (result?.data?.accounts ?? []).filter(row => row.username.toLowerCase().includes(query.toLowerCase()))
  function saved(account: Account) {
    setEditing(null); setNotice(`Cuenta ${account.username} guardada correctamente.`); setRevision(value => value + 1)
    if (state.account?.user_id === account.user_id) {
      if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel('hdb-session'); channel.postMessage('changed'); channel.close() }
      apiClient.clearCsrf(); void refresh()
    }
  }
  return <div className={styles.page}><div className={styles.header}><h2>Cuentas y accesos</h2><button type="button" onClick={() => setRevision(value => value + 1)}>Recargar cuentas</button></div>
    {notice && <Message variant="success">{notice}</Message>}
    {!result ? <LoadingState>Cargando cuentas…</LoadingState> : result.error !== undefined ? <Message>{getErrorMessage(result.error, 'No se pudieron cargar las cuentas.')}</Message> : result.data && <>
      <AccountForm key={`${editing?.user_id ?? 'new'}:${revision}`} account={editing} accounts={result.data.accounts} employees={result.data.employees} onSaved={saved} onCancel={() => setEditing(null)} />
      <TextField label="Buscar cuenta por usuario" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} />
      <p>{rows.length} cuentas encontradas.</p>
      <section className={styles.panel}><TableContainer label="Cuentas"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Empleado</th><th>Acciones</th></tr></thead><tbody>{rows.slice((page - 1) * 20, page * 20).map(row => <tr key={row.user_id}>
        <td>{row.username}{row.user_id === state.account?.user_id ? ' (tu cuenta)' : ''}</td><td>{row.role === 'Manager' ? 'Perfil retirado' : roleLabels[row.role]}</td><td>{row.is_active ? 'Activa' : 'Inactiva'}</td>
        <td>{row.employee_id === null ? 'Sin vínculo' : (() => { const employee = result.data.employees.find(employee => employee.employee_id === row.employee_id); return employee ? `${employee.first_names} ${employee.last_names} (#${employee.employee_id})` : `Empleado #${row.employee_id}` })()}</td>
        <td>{row.role === 'Manager' ? 'Acceso retirado; historial conservado' : <button type="button" aria-label={`Editar cuenta ${row.username}`} onClick={() => { setEditing({ ...row, role: row.role as Role }); setNotice('') }}>Editar</button>}</td>
      </tr>)}</tbody></table></TableContainer>{!rows.length && <p>No hay cuentas que coincidan.</p>}</section>
      <PageNavigation page={page} hasNext={rows.length > page * 20} onPageChange={setPage} />
    </>}
  </div>
}
