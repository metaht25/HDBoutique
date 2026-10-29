import { useCallback, useRef, useState } from 'react'
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
import { listSuppliers, saveSupplier, supplierAddresses } from './api'
import type { AddressOption, Supplier, SupplierInput } from './api'
import styles from '../../shared/ui/Management.module.css'

function SupplierForm({ supplier, addresses, onSaved, onCancel }: { supplier: Supplier | null; addresses: AddressOption[]; onSaved: (supplier: Supplier) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState({ company_name: supplier?.company_name ?? '', contact_first_names: supplier?.contact_first_names ?? '',
    contact_last_names: supplier?.contact_last_names ?? '', phone_number: supplier?.phone_number ?? '', work_email: supplier?.work_email ?? '', address_id: String(supplier?.address_id ?? '') })
  const [fields, setFields] = useState<FieldErrors>({}), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const labels = { company_name: 'Empresa', contact_first_names: 'Nombres del contacto', contact_last_names: 'Apellidos del contacto', phone_number: 'Teléfono', work_email: 'Correo de trabajo' }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (submitting.current) return
    const errors: FieldErrors = {}, addressId = inputId(draft.address_id)
    for (const field of ['company_name', 'contact_first_names', 'contact_last_names', 'phone_number'] as const) {
      const limit = field === 'phone_number' ? 10 : 50
      if (!draft[field].trim() || draft[field].trim().length > limit) errors[field] = `Campo obligatorio, hasta ${limit} caracteres.`
    }
    if (draft.work_email.trim().length > 40) errors.work_email = 'Máximo 40 caracteres.'
    if (!addressId) errors.address_id = 'Selecciona una dirección existente.'
    setFields(errors); setError('')
    if (Object.keys(errors).length || addressId === null) return
    const input: SupplierInput = { address_id: addressId, company_name: draft.company_name.trim(), contact_first_names: draft.contact_first_names.trim(),
      contact_last_names: draft.contact_last_names.trim(), phone_number: draft.phone_number.trim(), work_email: draft.work_email.trim() || null }
    submitting.current = true; setBusy(true)
    try { onSaved(await saveSupplier(input, supplier?.supplier_id)) } catch (error) { setError(getErrorMessage(error, 'No se pudo guardar el proveedor.')); setFields(serverFields(error)) }
    finally { submitting.current = false; setBusy(false) }
  }
  return <section className={styles.panel}><h3>{supplier ? `Editar proveedor #${supplier.supplier_id}` : 'Nuevo proveedor'}</h3>
    <form className={styles.form} noValidate onSubmit={event => void submit(event)}><div className={styles.grid}>
      {(Object.keys(labels) as (keyof typeof labels)[]).map(field => <TextField key={field} label={labels[field]} value={draft[field]}
        maxLength={field === 'phone_number' ? 10 : field === 'work_email' ? 40 : 50} disabled={busy} error={fields[field]}
        onChange={event => setDraft({ ...draft, [field]: event.target.value })} />)}
      <SelectField label="Dirección existente" value={draft.address_id} disabled={busy} error={fields.address_id} onChange={event => setDraft({ ...draft, address_id: event.target.value })}>
        <option value="">Selecciona una dirección</option>{addresses.map(row => <option key={row.address_id} value={row.address_id}>#{row.address_id} · {row.address_line ?? 'Sin detalle'}</option>)}
      </SelectField></div>
      <p className={styles.note}>Se reutiliza una dirección registrada. Teléfono textual de hasta 10 caracteres; correo opcional de hasta 40.</p>
      {!addresses.length && <Message>Registra una dirección con personal autorizado antes de crear el proveedor.</Message>}
      {error && <Message>{error}</Message>}<div className={styles.actions}><button type="submit" disabled={busy || !addresses.length}>{busy ? 'Guardando…' : supplier ? 'Actualizar proveedor' : 'Guardar proveedor'}</button>
        {supplier && <button type="button" disabled={busy} onClick={onCancel}>Cancelar edición</button>}</div>
    </form></section>
}

function SuppliersWorkspace() {
  const [params, setParams] = useSearchParams(), [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<Supplier | null>(null), [notice, setNotice] = useState('')
  const page = inputId(params.get('page') ?? '1') ?? 1
  const query = (params.get('q') ?? '').trim().slice(0, 100)
  const load = useCallback((signal: AbortSignal) => listSuppliers(page, signal, query), [page, query])
  const result = useResource(`suppliers:${page}:${query}:${revision}`, load), addresses = useResource(`supplier-addresses:${revision}`, supplierAddresses)
  return <div className={styles.page}><div className={styles.header}><div><h2>Gestión de proveedores</h2><p>Datos de contacto y direcciones existentes.</p></div>
    <button type="button" onClick={() => setRevision(value => value + 1)}>Recargar proveedores</button></div>
    {notice && <Message variant="success">{notice}</Message>}
    {!addresses ? <LoadingState>Cargando direcciones…</LoadingState> : addresses.error !== undefined ? <Message>{getErrorMessage(addresses.error, 'No se pudieron cargar direcciones.')}</Message>
      : addresses.data && <SupplierForm key={`${editing?.supplier_id ?? 'new'}:${revision}`} supplier={editing} addresses={addresses.data} onCancel={() => setEditing(null)} onSaved={row => {
        setNotice(`Proveedor #${row.supplier_id} guardado correctamente.`); setEditing(null); setRevision(value => value + 1)
      }} />}
    <form className={styles.search} key={query} onSubmit={event => { event.preventDefault(); setParams({ page: '1', q: String(new FormData(event.currentTarget).get('q') ?? '').trim() }) }}>
      <TextField label="Buscar proveedor" name="q" type="search" maxLength={100} defaultValue={query} /><button type="submit">Buscar</button></form>
    {!result ? <LoadingState>Cargando proveedores…</LoadingState> : result.error !== undefined ? <Message>{getErrorMessage(result.error, 'No se pudieron cargar proveedores.')}</Message>
      : !result.data?.length ? <p>No hay proveedores en esta página.</p> : <section className={styles.panel}><TableContainer label="Proveedores"><table>
        <thead><tr><th>ID</th><th>Empresa</th><th>Contacto</th><th>Teléfono</th><th>Correo</th><th>Dirección</th><th>Acciones</th></tr></thead>
        <tbody>{result.data.slice(0, 20).map(row => <tr key={row.supplier_id}><td>{row.supplier_id}</td><td>{row.company_name}</td><td>{row.contact_first_names} {row.contact_last_names}</td>
          <td>{row.phone_number}</td><td>{row.work_email ?? 'Sin correo'}</td><td>#{row.address_id}</td><td><button type="button" aria-label={`Editar proveedor ${row.supplier_id}`} onClick={() => setEditing(row)}>Editar</button></td></tr>)}</tbody>
      </table></TableContainer></section>}
    <PageNavigation page={page} hasNext={(result?.data?.length ?? 0) > 20} onPageChange={next => setParams({ page: String(next), q: query })} />
  </div>
}
function Access() { const { state } = useSession(); return state.status === 'authenticated' && state.account.role === 'Cashier' ? <Message>No tienes permiso para consultar proveedores.</Message> : <SuppliersWorkspace /> }
export default function SuppliersPage() { return <ModuleAccess><Access /></ModuleAccess> }
