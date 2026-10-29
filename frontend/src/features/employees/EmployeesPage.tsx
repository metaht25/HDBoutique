import { useCallback, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { ModuleAccess } from '../session/ModuleAccess'
import { useSession } from '../session/sessionContext'
import { getErrorMessage } from '../../shared/api/errors'
import { inputId, serverFields } from '../../shared/forms/fields'
import type { FieldErrors } from '../../shared/forms/fields'
import { useResource } from '../../shared/hooks/useResource'
import { LoadingState, Message } from '../../shared/ui/Feedback'
import { PageNavigation } from '../../shared/ui/PageNavigation'
import { SelectField } from '../../shared/ui/SelectField'
import { TableContainer } from '../../shared/ui/TableContainer'
import { TextField } from '../../shared/ui/TextField'
import styles from '../../shared/ui/Management.module.css'
import { employeeLocations, listEmployees, saveEmployee } from './api'
import type { Address, Employee, EmployeeLocations } from './api'

function addressLabel(address: Address, options: EmployeeLocations): string {
  const department = options.departments.find(row => row.department_id === address.department_id)
  return `#${address.address_id} · ${address.address_line ?? 'Sin detalle'} · ${department?.name ?? `Departamento #${address.department_id}`}`
}

function EmployeeForm({ employee, options, canReadLocations, onSaved, onCancel }: {
  employee: Employee | null; options: EmployeeLocations; canReadLocations: boolean
  onSaved: (employee: Employee) => void; onCancel: () => void
}) {
  const [firstNames, setFirstNames] = useState(employee?.first_names ?? '')
  const [lastNames, setLastNames] = useState(employee?.last_names ?? '')
  const [phone, setPhone] = useState(employee?.phone_number ?? '')
  const [email, setEmail] = useState(employee?.work_email ?? '')
  const [title, setTitle] = useState(employee?.job_title ?? '')
  const [start, setStart] = useState(employee?.start_date ?? '')
  const [end, setEnd] = useState(employee?.end_date ?? '')
  const [address, setAddress] = useState(String(employee?.address_id ?? ''))
  const [fields, setFields] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const addressHint = useId()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const errors: FieldErrors = {}
    const addressId = inputId(address)
    if (!firstNames.trim() || firstNames.trim().length > 40) errors.first_names = 'Escribe los nombres, hasta 40 caracteres.'
    if (!lastNames.trim() || lastNames.trim().length > 40) errors.last_names = 'Escribe los apellidos, hasta 40 caracteres.'
    if (!phone.trim() || phone.trim().length > 10) errors.phone_number = 'Escribe el teléfono, hasta 10 caracteres.'
    if (!addressId) errors.address_id = canReadLocations ? 'Selecciona una dirección existente.' : 'Indica un ID de dirección válido.'
    setFields(errors)
    setError('')
    if (Object.keys(errors).length || addressId === null) return
    submitting.current = true
    setBusy(true)
    try {
      const saved = await saveEmployee({ first_names: firstNames.trim(), last_names: lastNames.trim(),
        phone_number: phone.trim(), address_id: addressId, work_email: email.trim() || null, job_title: title.trim() || null, start_date: start || null, end_date: end || null }, employee?.employee_id)
      onSaved(saved)
      if (!employee) { setFirstNames(''); setLastNames(''); setPhone(''); setEmail(''); setTitle(''); setStart(''); setEnd(''); setAddress('') }
    } catch (error) {
      setError(getErrorMessage(error, 'No se pudo guardar el empleado.'))
      setFields(serverFields(error))
    } finally { submitting.current = false; setBusy(false) }
  }
  return <section className={styles.panel}><h3>{employee ? `Editar empleado #${employee.employee_id}` : 'Nuevo empleado'}</h3>
    <form className={styles.form} noValidate onSubmit={event => void submit(event)}>
      <div className={styles.grid}>
        <TextField label="Nombres" name="first_names" value={firstNames} maxLength={40} required disabled={busy} autoFocus={!!employee}
          onChange={event => setFirstNames(event.target.value)} error={fields.first_names} />
        <TextField label="Apellidos" name="last_names" value={lastNames} maxLength={40} required disabled={busy}
          onChange={event => setLastNames(event.target.value)} error={fields.last_names} />
        <TextField label="Teléfono" name="phone_number" type="tel" value={phone} maxLength={10} required disabled={busy}
          onChange={event => setPhone(event.target.value)} error={fields.phone_number} />
        <TextField label="Correo laboral" value={email} maxLength={20} disabled={busy} error={fields.work_email} onChange={event => setEmail(event.target.value)} />
        <TextField label="Cargo" value={title} maxLength={20} disabled={busy} error={fields.job_title} onChange={event => setTitle(event.target.value)} />
        <TextField label="Fecha de ingreso" type="date" value={start} disabled={busy} error={fields.start_date} onChange={event => setStart(event.target.value)} />
        <TextField label="Fecha de salida" type="date" value={end} disabled={busy} error={fields.end_date} onChange={event => setEnd(event.target.value)} />
        {canReadLocations ? <SelectField label="Dirección existente" value={address} disabled={busy} error={fields.address_id}
          onChange={event => setAddress(event.target.value)}>
          <option value="">Selecciona una dirección</option>
          {options.addresses.map(row => <option key={row.address_id} value={row.address_id}>{addressLabel(row, options)}</option>)}
        </SelectField> : <TextField label="ID de dirección existente" value={address} inputMode="numeric" required disabled={busy}
          aria-describedby={addressHint} onChange={event => setAddress(event.target.value)} error={fields.address_id} />}
      </div>
      <p id={addressHint} className={styles.note}>{canReadLocations
        ? 'Se reutiliza una dirección registrada. Si falta, debe registrarla el personal autorizado antes de guardar el empleado.'
        : 'Solicita al personal autorizado el ID de una dirección registrada. El servidor comprobará que exista.'}</p>
      {canReadLocations && options.addresses.length === 0 && <Message>No hay direcciones disponibles. Solicita su registro al personal autorizado.</Message>}
      {error && <Message>{error}</Message>}
      <div className={styles.actions}><button disabled={busy || (canReadLocations && !options.addresses.length)} type="submit">
        {busy ? 'Guardando…' : employee ? 'Actualizar empleado' : 'Guardar empleado'}</button>
        {employee && <button type="button" disabled={busy} onClick={onCancel}>Cancelar edición</button>}
      </div>
    </form>
  </section>
}

function EmployeeWorkspace() {
  const { state } = useSession()
  if (state.status === 'authenticated' && state.account.role === 'Cashier') return <Message>No tienes permiso para gestionar empleados.</Message>
  return <EmployeeWorkspaceContent key={state.account?.user_id} />
}

function EmployeeWorkspaceContent() {
  const canReadLocations = true
  const [params, setParams] = useSearchParams()
  const page = inputId(params.get('page') ?? '1') ?? 1
  const query = (params.get('q') ?? '').trim().slice(0, 100)
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [notice, setNotice] = useState('')
  const load = useCallback((signal: AbortSignal) => listEmployees(page, query, signal), [page, query])
  const loadOptions = useCallback((signal: AbortSignal) => employeeLocations(signal), [])
  const result = useResource(`${page}:${query}:${revision}`, load)
  const options = useResource(`employee-options:${canReadLocations}:${revision}`, loadOptions)
  const rows = result?.data?.slice(0, 20) ?? []
  function navigate(nextPage: number, nextQuery = query) {
    setParams({ ...(nextQuery ? { q: nextQuery } : {}), page: String(nextPage) })
  }
  return <div className={styles.page}>
    <div className={styles.header}><div><h2>Gestión de empleados</h2><p>Consulta y actualiza los datos de contacto.</p></div>
      <button type="button" onClick={() => setRevision(value => value + 1)}>Recargar empleados</button></div>
    {notice && <Message variant="success">{notice}</Message>}
    {!options ? <LoadingState>Cargando opciones de empleados…</LoadingState> : options.error !== undefined
      ? <Message>{getErrorMessage(options.error, 'No se pudieron cargar las opciones de empleados.')}</Message>
      : options.data && <EmployeeForm key={editing?.employee_id ?? 'new'} employee={editing} options={options.data} canReadLocations={canReadLocations}
        onCancel={() => setEditing(null)} onSaved={employee => {
          setNotice(`Empleado #${employee.employee_id} guardado correctamente.`); setEditing(null); setRevision(value => value + 1)
        }} />}
    <form className={styles.search} key={query} onSubmit={event => {
      event.preventDefault(); navigate(1, String(new FormData(event.currentTarget).get('query') ?? '').trim())
    }}><TextField label="Buscar empleado por nombre o teléfono" name="query" type="search" maxLength={100} defaultValue={query} />
      <button type="submit">Buscar</button></form>
    {!result ? <LoadingState>Cargando empleados…</LoadingState> : result.error !== undefined
      ? <Message>{getErrorMessage(result.error, 'No se pudieron cargar los empleados.')}</Message>
      : rows.length === 0 ? <p className={styles.empty}>No hay empleados en esta página.</p>
        : <section className={styles.panel}><TableContainer label="Empleados"><table>
          <thead><tr><th>ID</th><th>Empleado</th><th>Teléfono</th><th>Cargo</th><th>Correo laboral</th><th>Ingreso / salida</th><th>Dirección</th><th>Acciones</th></tr></thead>
          <tbody>{rows.map(employee => {
            const address = options?.data?.addresses.find(row => row.address_id === employee.address_id)
            return <tr key={employee.employee_id}><td>{employee.employee_id}</td><td>{employee.first_names} {employee.last_names}</td>
              <td>{employee.phone_number}</td><td>{employee.job_title ?? "Sin dato"}</td><td>{employee.work_email ?? "Sin dato"}</td><td>{employee.start_date ?? "Sin dato"} / {employee.end_date ?? "Sin dato"}</td>
              <td>{address && options?.data ? addressLabel(address, options.data) : `Dirección #${employee.address_id}`}</td>
              <td><button type="button" aria-label={`Editar empleado ${employee.employee_id}`} onClick={() => {
                setEditing(employee); setNotice('')
              }}>Editar</button></td></tr>
          })}</tbody></table></TableContainer></section>}
    <PageNavigation page={page} hasNext={(result?.data?.length ?? 0) > 20} onPageChange={next => navigate(next)} />
  </div>
}
export default function EmployeesPage() { return <ModuleAccess><EmployeeWorkspace /></ModuleAccess> }
