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
import { customerOptions, listCustomers, saveCustomer } from './api'
import type { Address, Customer, CustomerOptions } from './api'

function addressLabel(address: Address, options: CustomerOptions): string {
  const department = options.departments.find(row => row.department_id === address.department_id)
  return `#${address.address_id} · ${address.address_line ?? 'Sin detalle'} · ${department?.name ?? `Departamento #${address.department_id}`}`
}

function CustomerForm({ customer, options, canReadLocations, onSaved, onCancel }: {
  customer: Customer | null; options: CustomerOptions; canReadLocations: boolean
  onSaved: (customer: Customer) => void; onCancel: () => void
}) {
  const [firstNames, setFirstNames] = useState(customer?.first_names ?? '')
  const [lastNames, setLastNames] = useState(customer?.last_names ?? '')
  const [phone, setPhone] = useState(customer?.phone_number ?? '')
  const [type, setType] = useState(String(customer?.customer_type_id ?? ''))
  const [address, setAddress] = useState(String(customer?.address_id ?? ''))
  const [fields, setFields] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const addressHint = useId()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const errors: FieldErrors = {}
    const typeId = inputId(type), addressId = inputId(address)
    if (!firstNames.trim() || firstNames.trim().length > 40) errors.first_names = 'Escribe los nombres, hasta 40 caracteres.'
    if (!lastNames.trim() || lastNames.trim().length > 40) errors.last_names = 'Escribe los apellidos, hasta 40 caracteres.'
    if (!phone.trim() || phone.trim().length > 10) errors.phone_number = 'Escribe el teléfono, hasta 10 caracteres.'
    if (!typeId) errors.customer_type_id = 'Selecciona un tipo de cliente.'
    if (!addressId) errors.address_id = canReadLocations ? 'Selecciona una dirección existente.' : 'Indica un ID de dirección válido.'
    setFields(errors)
    setError('')
    if (Object.keys(errors).length || typeId === null || addressId === null) return
    submitting.current = true
    setBusy(true)
    try {
      const saved = await saveCustomer({ first_names: firstNames.trim(), last_names: lastNames.trim(),
        phone_number: phone.trim(), customer_type_id: typeId, address_id: addressId }, customer?.customer_id)
      onSaved(saved)
      if (!customer) { setFirstNames(''); setLastNames(''); setPhone(''); setType(''); setAddress('') }
    } catch (error) {
      setError(getErrorMessage(error, 'No se pudo guardar el cliente.'))
      setFields(serverFields(error))
    } finally { submitting.current = false; setBusy(false) }
  }
  return <section className={styles.panel}><h3>{customer ? `Editar cliente #${customer.customer_id}` : 'Nuevo cliente'}</h3>
    <form className={styles.form} noValidate onSubmit={event => void submit(event)}>
      <div className={styles.grid}>
        <TextField label="Nombres" name="first_names" value={firstNames} maxLength={40} required disabled={busy} autoFocus={!!customer}
          onChange={event => setFirstNames(event.target.value)} error={fields.first_names} />
        <TextField label="Apellidos" name="last_names" value={lastNames} maxLength={40} required disabled={busy}
          onChange={event => setLastNames(event.target.value)} error={fields.last_names} />
        <TextField label="Teléfono" name="phone_number" type="tel" value={phone} maxLength={10} required disabled={busy}
          onChange={event => setPhone(event.target.value)} error={fields.phone_number} />
        <SelectField label="Tipo de cliente" value={type} disabled={busy} error={fields.customer_type_id}
          onChange={event => setType(event.target.value)}>
          <option value="">Selecciona un tipo</option>
          {options.types.map(row => <option key={row.customer_type_id} value={row.customer_type_id}>{row.name ?? `Tipo #${row.customer_type_id}`}</option>)}
        </SelectField>
        {canReadLocations ? <SelectField label="Dirección existente" value={address} disabled={busy} error={fields.address_id}
          onChange={event => setAddress(event.target.value)}>
          <option value="">Selecciona una dirección</option>
          {options.addresses.map(row => <option key={row.address_id} value={row.address_id}>{addressLabel(row, options)}</option>)}
        </SelectField> : <TextField label="ID de dirección existente" value={address} inputMode="numeric" required disabled={busy}
          aria-describedby={addressHint} onChange={event => setAddress(event.target.value)} error={fields.address_id} />}
      </div>
      <p id={addressHint} className={styles.note}>{canReadLocations
        ? 'Se reutiliza una dirección registrada. Si falta, debe registrarla el personal autorizado antes de guardar el cliente.'
        : 'Solicita al personal autorizado el ID de una dirección registrada. El servidor comprobará que exista.'}</p>
      {options.types.length === 0 && <Message>No hay tipos de cliente disponibles. Solicita su registro al personal autorizado.</Message>}
      {canReadLocations && options.addresses.length === 0 && <Message>No hay direcciones disponibles. Solicita su registro al personal autorizado.</Message>}
      {error && <Message>{error}</Message>}
      <div className={styles.actions}><button disabled={busy || !options.types.length || (canReadLocations && !options.addresses.length)} type="submit">
        {busy ? 'Guardando…' : customer ? 'Actualizar cliente' : 'Guardar cliente'}</button>
        {customer && <button type="button" disabled={busy} onClick={onCancel}>Cancelar edición</button>}
      </div>
    </form>
  </section>
}

function CustomerWorkspace() {
  const { state } = useSession()
  const canReadLocations = state.status === 'authenticated' && state.account.role !== 'Cashier'
  const [params, setParams] = useSearchParams()
  const page = inputId(params.get('page') ?? '1') ?? 1
  const query = (params.get('q') ?? '').trim().slice(0, 100)
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [notice, setNotice] = useState('')
  const load = useCallback((signal: AbortSignal) => listCustomers(page, query, signal), [page, query])
  const loadOptions = useCallback((signal: AbortSignal) => customerOptions(canReadLocations, signal), [canReadLocations])
  const result = useResource(`${page}:${query}:${revision}`, load)
  const options = useResource(`customer-options:${canReadLocations}:${revision}`, loadOptions)
  const rows = result?.data?.slice(0, 20) ?? []
  function navigate(nextPage: number, nextQuery = query) {
    setParams({ ...(nextQuery ? { q: nextQuery } : {}), page: String(nextPage) })
  }
  return <div className={styles.page}>
    <div className={styles.header}><div><h2>Gestión de clientes</h2><p>Consulta y actualiza los datos de contacto.</p></div>
      <button type="button" onClick={() => setRevision(value => value + 1)}>Recargar clientes</button></div>
    {notice && <Message variant="success">{notice}</Message>}
    {!options ? <LoadingState>Cargando opciones de clientes…</LoadingState> : options.error !== undefined
      ? <Message>{getErrorMessage(options.error, 'No se pudieron cargar las opciones de clientes.')}</Message>
      : options.data && <CustomerForm key={editing?.customer_id ?? 'new'} customer={editing} options={options.data} canReadLocations={canReadLocations}
        onCancel={() => setEditing(null)} onSaved={customer => {
          setNotice(`Cliente #${customer.customer_id} guardado correctamente.`); setEditing(null); setRevision(value => value + 1)
        }} />}
    <form className={styles.search} key={query} onSubmit={event => {
      event.preventDefault(); navigate(1, String(new FormData(event.currentTarget).get('query') ?? '').trim())
    }}><TextField label="Buscar cliente por nombre o teléfono" name="query" type="search" maxLength={100} defaultValue={query} />
      <button type="submit">Buscar</button></form>
    {!result ? <LoadingState>Cargando clientes…</LoadingState> : result.error !== undefined
      ? <Message>{getErrorMessage(result.error, 'No se pudieron cargar los clientes.')}</Message>
      : rows.length === 0 ? <p className={styles.empty}>No hay clientes en esta página.</p>
        : <section className={styles.panel}><TableContainer label="Clientes"><table>
          <thead><tr><th>ID</th><th>Cliente</th><th>Teléfono</th><th>Tipo</th><th>Dirección</th><th>Acciones</th></tr></thead>
          <tbody>{rows.map(customer => {
            const type = options?.data?.types.find(row => row.customer_type_id === customer.customer_type_id)
            const address = options?.data?.addresses.find(row => row.address_id === customer.address_id)
            return <tr key={customer.customer_id}><td>{customer.customer_id}</td><td>{customer.first_names} {customer.last_names}</td>
              <td>{customer.phone_number}</td><td>{type?.name ?? `Tipo #${customer.customer_type_id}`}</td>
              <td>{address && options?.data ? addressLabel(address, options.data) : `Dirección #${customer.address_id}`}</td>
              <td><button type="button" aria-label={`Editar cliente ${customer.customer_id}`} onClick={() => {
                setEditing(customer); setNotice('')
              }}>Editar</button></td></tr>
          })}</tbody></table></TableContainer></section>}
    <PageNavigation page={page} hasNext={(result?.data?.length ?? 0) > 20} onPageChange={next => navigate(next)} />
  </div>
}
export default function CustomersPage() { return <ModuleAccess><CustomerWorkspace /></ModuleAccess> }
