import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiClient } from '../../shared/api/client'
import { getErrorMessage } from '../../shared/api/errors'
import { serverFields } from '../../shared/forms/fields'
import type { FieldErrors } from '../../shared/forms/fields'
import { Message } from '../../shared/ui/Feedback'
import { TextField } from '../../shared/ui/TextField'
import { PhoneField } from './PhoneField'
import { canonicalPhone, validPhone, formatPhone } from './phone'
import { useCashCommand } from '../cash-register/useCashCommand'
import { SearchSelect } from './SearchSelect'
import { commercialDate, useChoices } from './api'
import { DataState, Modal } from './ui'
import styles from './Boutique.module.css'
import { SupplierFields } from './SupplierFields'
import { CustomerFields } from './CustomerFields'
import { EmployeeFields } from './EmployeeFields'
import { Icon } from '../../shared/ui/Icon'
import ui from './Commerce.module.css'
import people from './People.module.css'

import { partyId, partyLabels } from './party'
import type { Party, PartyKind } from './party'

export function AddressFields({ values, update, required }: { values: Record<string, string>; update: (field: string, value: string) => void; required: boolean }) {
  const departments = useChoices('departments'), municipalities = useChoices('municipalities')
  return <><DataState result={departments}><SearchSelect label="Departamento" required={required} value={values.department_id ?? ''} options={departments?.data ?? []} onChange={value => { update('department_id', value); update('department_name', departments?.data?.find(row => row.id === Number(value))?.label ?? ''); update('municipality_id', ''); update('municipality_name', '') }} /></DataState>
    <DataState result={municipalities}><SearchSelect key={values.department_id} label="Municipio" required={required} disabled={!values.department_id} value={values.municipality_id ?? ''} options={municipalities?.data?.filter(row => row.department_id === Number(values.department_id)) ?? []} onChange={value => { update('municipality_id', value); update('municipality_name', municipalities?.data?.find(row => row.id === Number(value))?.label ?? '') }} /></DataState>
    <div className={styles.full}><TextField label="Dirección exacta" required={required} maxLength={100} value={values.address_line ?? ''} onChange={e => update('address_line', e.target.value)} /></div>
  </>
}
export function PartyForm({ kind, row, initialKind, onDraft, onSaved, onClose, userId }: { userId?: number; kind: PartyKind; row?: Party; initialKind?: string; onDraft?: (body: Record<string, unknown>, display: Record<string, string>) => void; onSaved: (row: Party) => void; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => row ? Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? '' : key === 'phone_number' ? formatPhone(String(value)) : String(value)])) : { kind: initialKind ?? 'regular', start_date: commercialDate() })
  const supplierCommand = useCashCommand<Party>(userId ?? 0, 'supplier', onSaved)
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), submitting = useRef(false)
  const customer = kind === 'customers', employee = kind === 'employees', delivery = (initialKind ?? values.kind) === 'delivery', addressRequired = employee || delivery
  const update = (field: string, value: string) => { setValues(current => ({ ...current, [field]: value })); setFieldErrors(current => ({ ...current, [field]: '' })) }
  const input = (field: string, label: string, required = true, maxLength = 40, type = 'text') => <TextField label={label} error={fieldErrors[field]} required={required} maxLength={maxLength} type={type} readOnly={customer && !!row && ['first_names', 'last_names'].includes(field)} value={values[field] ?? ''} onChange={e => update(field, e.target.value)} />
  async function submit(event: FormEvent) {
    event.preventDefault(); if (submitting.current) return
    if (kind === 'suppliers' && supplierCommand.pending) { await supplierCommand.send('', {}); return }
    const body: Record<string, unknown> = {}
    const fields = customer ? ['first_names', 'last_names', 'phone_number', 'kind'] : employee ? ['first_names', 'last_names', 'phone_number', 'start_date'] : ['company_name', 'contact_first_names', 'contact_last_names', 'phone_number', 'work_email']
    fields.forEach(field => { body[field] = field === 'kind' ? values[field] || 'regular' : values[field]?.trim() || null })
    if (!customer || delivery) {
      body.phone_number = canonicalPhone(values.phone_number ?? '') || null
      if (body.phone_number !== null && !validPhone(String(body.phone_number))) { setError('El teléfono debe tener ocho dígitos y comenzar con 7 u 8.'); return }
    } else { delete body.phone_number }
    if (customer) body.kind = delivery ? 'delivery' : 'regular'
    if (kind === 'suppliers') body.address_line = values.address_line?.trim() || null
    const hasAddress = addressRequired
    if (hasAddress) {
      if (!values.department_id || !values.municipality_id || !values.address_line?.trim()) { setError('Completa departamento, municipio y dirección exacta.'); return }
      body.address = { department_id: Number(values.department_id), municipality_id: Number(values.municipality_id), address_line: values.address_line.trim() }
    }
    if (employee) {
      if (!row) body.username = values.username?.trim()
      if (values.password) body.password = values.password
    }
    if (onDraft) { onDraft(body, values); return }
    if (kind === 'suppliers' && !row) { await supplierCommand.send('/api/v1/purchases/suppliers', body); return }
    submitting.current = true; setBusy(true); setError(''); setFieldErrors({})
    try {
      const saved = await apiClient.request<Party>(`/api/v1/${kind}${row ? '/' + partyId(row) : ''}`, { method: row ? 'PATCH' : 'POST', body }); onSaved({ ...saved, ...(hasAddress ? { department_id: Number(values.department_id), department_name: values.department_name, municipality_id: Number(values.municipality_id), municipality_name: values.municipality_name, address_line: values.address_line?.trim() ?? null } : {}) }) }
    catch (error) { setError(getErrorMessage(error, `No se pudo guardar el ${partyLabels[kind]}.`)); setFieldErrors(serverFields(error)) }
    finally { submitting.current = false; setBusy(false); setValues(current => ({ ...current, password: '' })) }
  }
  const supplierFields = kind === 'suppliers' ? <SupplierFields field={input} phone={<PhoneField value={values.phone_number ?? ''} required onChange={value => update('phone_number', value)} />} /> : null
  const customerFields = customer ? <CustomerFields field={input} delivery={delivery} existing={!!row} phone={<PhoneField value={values.phone_number ?? ''} required onChange={value => update('phone_number', value)} />} address={<AddressFields values={values} update={update} required />} /> : null
  const employeeFields = employee ? <EmployeeFields field={input} existing={!!row} replacingPassword={!!row && !!values.password} phone={<PhoneField value={values.phone_number ?? ''} required onChange={value => update('phone_number', value)} />} address={<AddressFields values={values} update={update} required />} jobTitle={<TextField label="Cargo" value={row && 'job_title' in row ? row.job_title ?? 'Sin cargo histórico' : 'Vendedor'} readOnly />} username={!row ? input('username', 'Usuario de acceso', true, 64) : <dl className={ui.contact}><dt>Usuario de acceso</dt><dd>{'username' in row ? row.username || 'Sin cuenta vinculada' : 'Sin cuenta vinculada'}</dd></dl>} password={<div className={people.password}>
    <TextField error={fieldErrors.password} label={row ? 'Nueva contraseña (opcional)' : 'Contraseña'} required={!row} type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={6} maxLength={128} value={values.password ?? ''} onChange={e => update('password', e.target.value)} />
    <button type="button" className="secondary" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><Icon name="eye" size={16} />{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</button>
  </div>} /> : null
  return <Modal title={`${row ? 'Editar' : 'Nuevo'} ${partyLabels[kind]}`} onClose={() => { if (!busy && !supplierCommand.busy) onClose() }}><form className={styles.form} onSubmit={e => void submit(e)}>
    {kind === 'suppliers' && <div className={ui.formIntro}><span className={ui.icon}><Icon name="suppliers" /></span><p><strong>{row ? 'Información del proveedor' : 'Añade un aliado para tu boutique'}</strong>Organiza su información comercial y de contacto.</p></div>}
    <fieldset disabled={busy || (kind === 'suppliers' && supplierCommand.locked)}>
    {supplierFields ?? customerFields ?? employeeFields}
    </fieldset>{(error || (kind === 'suppliers' && supplierCommand.error)) && <Message>{error || supplierCommand.error}</Message>}{kind === 'suppliers' && supplierCommand.pending && <Message variant="info">Proveedor pendiente de confirmación. Reintenta la misma solicitud.</Message>}<div className={styles.actions}><button type="button" className="secondary" disabled={busy || supplierCommand.busy} onClick={onClose}>Cancelar</button><button type="submit" disabled={busy || (kind === 'suppliers' && (supplierCommand.busy || supplierCommand.blocked))}>{kind === 'suppliers' && supplierCommand.pending ? 'Reintentar mismo proveedor' : busy ? 'Guardando…' : row ? 'Guardar cambios' : onDraft ? `Usar ${partyLabels[kind]} en esta operación` : `Guardar ${partyLabels[kind]}`}</button></div>
  </form></Modal>
}
