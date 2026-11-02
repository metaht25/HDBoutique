import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiClient } from '../../shared/api/client'
import { getErrorMessage } from '../../shared/api/errors'
import { Message } from '../../shared/ui/Feedback'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { commercialDate, useChoices } from './api'
import { DataState, Modal } from './ui'
import styles from './Boutique.module.css'

import { partyId, partyLabels } from './party'
import type { Party, PartyKind } from './party'

export function AddressFields({ values, update, required }: { values: Record<string, string>; update: (field: string, value: string) => void; required: boolean }) {
  const departments = useChoices('departments'), municipalities = useChoices('municipalities')
  return <><DataState result={departments}><SelectField label="Departamento" required={required} value={values.department_id ?? ''} onChange={e => { update('department_id', e.target.value); update('department_name', departments?.data?.find(row => row.id === Number(e.target.value))?.label ?? ''); update('municipality_id', ''); update('municipality_name', '') }}><option value="">Selecciona departamento</option>{departments?.data?.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</SelectField></DataState>
    <DataState result={municipalities}><SelectField label="Municipio" required={required} disabled={!values.department_id} value={values.municipality_id ?? ''} onChange={e => { update('municipality_id', e.target.value); update('municipality_name', municipalities?.data?.find(row => row.id === Number(e.target.value))?.label ?? '') }}><option value="">Selecciona municipio</option>{municipalities?.data?.filter(row => row.department_id === Number(values.department_id)).map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</SelectField></DataState>
    <div className={styles.full}><TextField label="Dirección exacta" required={required} maxLength={100} value={values.address_line ?? ''} onChange={e => update('address_line', e.target.value)} /></div>
  </>
}
export function PartyForm({ kind, row, initialKind, onSaved, onClose }: { kind: PartyKind; row?: Party; initialKind?: string; onSaved: (row: Party) => void; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => row ? Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? '' : String(value)])) : { kind: initialKind ?? 'regular', start_date: commercialDate() })
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), submitting = useRef(false)
  const customer = kind === 'customers', employee = kind === 'employees', delivery = values.kind === 'delivery', addressRequired = !customer || delivery
  const update = (field: string, value: string) => setValues(current => ({ ...current, [field]: value }))
  const input = (field: string, label: string, required = true, maxLength = 40, type = 'text') => <TextField label={label} required={required} maxLength={maxLength} type={type} value={values[field] ?? ''} onChange={e => update(field, e.target.value)} />
  async function submit(event: FormEvent) {
    event.preventDefault(); if (submitting.current) return
    const body: Record<string, unknown> = {}
    const fields = customer ? ['first_names', 'last_names', 'phone_number', 'kind'] : employee ? ['first_names', 'last_names', 'phone_number', 'work_email', 'job_title', 'start_date'] : ['company_name', 'contact_first_names', 'contact_last_names', 'phone_number', 'work_email']
    fields.forEach(field => { body[field] = field === 'kind' ? values[field] || 'regular' : values[field]?.trim() || null })
    const hasAddress = addressRequired || ['department_id', 'municipality_id', 'address_line'].some(field => !!values[field])
    if (hasAddress) {
      if (!values.department_id || !values.municipality_id || !values.address_line?.trim()) { setError('Completa departamento, municipio y dirección exacta.'); return }
      body.address = { department_id: Number(values.department_id), municipality_id: Number(values.municipality_id), address_line: values.address_line.trim() }
    }
    if (employee) {
      if (!row) body.username = values.username?.trim()
      if (values.temporary_password) body.temporary_password = values.temporary_password
    }
    submitting.current = true; setBusy(true); setError('')
    try { const saved = await apiClient.request<Party>(`/api/v1/${kind}${row ? '/' + partyId(row) : ''}`, { method: row ? 'PATCH' : 'POST', body }); onSaved({ ...saved, ...(hasAddress ? { department_id: Number(values.department_id), department_name: values.department_name, municipality_id: Number(values.municipality_id), municipality_name: values.municipality_name, address_line: values.address_line?.trim() ?? null } : {}) }) }
    catch (error) { setError(getErrorMessage(error, `No se pudo guardar el ${partyLabels[kind]}.`)) }
    finally { submitting.current = false; setBusy(false); update('temporary_password', '') }
  }
  return <Modal title={`${row ? 'Editar' : 'Nuevo'} ${partyLabels[kind]}`} onClose={() => { if (!busy) onClose() }}><form className={styles.form} onSubmit={e => void submit(e)}><fieldset disabled={busy}>
    <div className={styles.formGrid}>
      {customer && <div className={styles.full}><SelectField label="Tipo de cliente" value={values.kind || 'regular'} onChange={e => update('kind', e.target.value)}><option value="regular">Cliente</option><option value="delivery">Cliente delivery</option></SelectField></div>}
      {kind === 'suppliers' && <div className={styles.full}>{input('company_name', 'Empresa', true, 50)}</div>}
      {input(kind === 'suppliers' ? 'contact_first_names' : 'first_names', kind === 'suppliers' ? 'Nombres del contacto' : 'Nombres')}
      {input(kind === 'suppliers' ? 'contact_last_names' : 'last_names', kind === 'suppliers' ? 'Apellidos del contacto' : 'Apellidos')}
      {input('phone_number', 'Teléfono', !customer || delivery, 10, 'tel')}
      {!customer && input('work_email', 'Correo', false, employee ? 100 : 40, 'email')}
      {employee && <>{input('job_title', 'Cargo', false, 20)}{input('start_date', 'Fecha de ingreso', false, 10, 'date')}
        {!row ? input('username', 'Usuario de acceso', true, 64) : <p>Usuario de acceso: <b>{'username' in row ? row.username ?? 'Sin cuenta vinculada' : ''}</b></p>}
        <TextField label={row ? 'Nueva contraseña temporal (opcional)' : 'Contraseña temporal'} required={!row} type="password" autoComplete="new-password" minLength={12} maxLength={128} value={values.temporary_password ?? ''} onChange={e => update('temporary_password', e.target.value)} /></>}
      <AddressFields values={values} update={update} required={addressRequired} />
    </div>
    {employee && <p className={styles.hint}>La cuenta tendrá acceso como Colaborador y deberá cambiar la contraseña temporal al ingresar. Usa al menos 12 caracteres.</p>}
    {error && <Message>{error}</Message>}<div className={styles.actions}><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit">{busy ? 'Guardando…' : row ? 'Guardar cambios' : `Guardar ${partyLabels[kind]}`}</button></div>
  </fieldset></form></Modal>
}
