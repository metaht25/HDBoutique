import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiClient } from '../../shared/api/client'
import { getErrorMessage } from '../../shared/api/errors'
import { Message } from '../../shared/ui/Feedback'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { useCashCommand } from '../cash-register/useCashCommand'
import { SearchSelect } from './SearchSelect'
import { commercialDate, useChoices } from './api'
import { DataState, Modal } from './ui'
import styles from './Boutique.module.css'

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
  const [values, setValues] = useState<Record<string, string>>(() => row ? Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? '' : key === 'phone_number' && kind === 'employees' ? String(value).replace(/^([78][0-9]{3})([0-9]{4})$/, '$1-$2') : String(value)])) : { kind: initialKind ?? 'regular', start_date: commercialDate() })
  const supplierCommand = useCashCommand<Party>(userId ?? 0, 'supplier', onSaved)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), submitting = useRef(false)
  const customer = kind === 'customers', employee = kind === 'employees', delivery = values.kind === 'delivery', addressRequired = !customer || delivery
  const update = (field: string, value: string) => setValues(current => ({ ...current, [field]: value }))
  const input = (field: string, label: string, required = true, maxLength = 40, type = 'text') => <TextField label={label} required={required} maxLength={maxLength} type={type} value={values[field] ?? ''} onChange={e => update(field, e.target.value)} />
  async function submit(event: FormEvent) {
    event.preventDefault(); if (submitting.current) return
    if (kind === 'suppliers' && supplierCommand.pending) { await supplierCommand.send('', {}); return }
    const body: Record<string, unknown> = {}
    const fields = customer ? ['first_names', 'last_names', 'phone_number', 'kind'] : employee ? ['first_names', 'last_names', 'phone_number', 'job_title', 'start_date'] : ['company_name', 'contact_first_names', 'contact_last_names', 'phone_number', 'work_email']
    fields.forEach(field => { body[field] = field === 'kind' ? values[field] || 'regular' : values[field]?.trim() || null })
    if (!employee && body.phone_number !== null && !/^[0-9]{1,10}$/.test(String(body.phone_number))) { setError('El teléfono debe contener únicamente dígitos, hasta un máximo de diez.'); return }
    if (employee) {
      body.phone_number = (values.phone_number ?? '').replace(/-/g, '')
      if (!/^[78][0-9]{7}$/.test(String(body.phone_number))) { setError('El teléfono debe tener ocho dígitos y comenzar con 7 u 8.'); return }
    }
    const hasAddress = addressRequired || ['department_id', 'municipality_id', 'address_line'].some(field => !!values[field])
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
    submitting.current = true; setBusy(true); setError('')
    try {
      const saved = await apiClient.request<Party>(`/api/v1/${kind}${row ? '/' + partyId(row) : ''}`, { method: row ? 'PATCH' : 'POST', body }); onSaved({ ...saved, ...(hasAddress ? { department_id: Number(values.department_id), department_name: values.department_name, municipality_id: Number(values.municipality_id), municipality_name: values.municipality_name, address_line: values.address_line?.trim() ?? null } : {}) }) }
    catch (error) { setError(getErrorMessage(error, `No se pudo guardar el ${partyLabels[kind]}.`)) }
    finally { submitting.current = false; setBusy(false); update('password', '') }
  }
  return <Modal title={`${row ? 'Editar' : 'Nuevo'} ${partyLabels[kind]}`} onClose={() => { if (!busy && !supplierCommand.busy) onClose() }}><form className={styles.form} onSubmit={e => void submit(e)}><fieldset disabled={busy || (kind === 'suppliers' && supplierCommand.locked)}>
    <div className={styles.formGrid}>
      {customer && <div className={styles.full}><SelectField label="Tipo de cliente" value={values.kind || 'regular'} onChange={e => update('kind', e.target.value)}><option value="regular">Cliente</option><option value="delivery">Cliente delivery</option></SelectField></div>}
      {kind === 'suppliers' && <div className={styles.full}>{input('company_name', 'Empresa', true, 50)}</div>}
      {input(kind === 'suppliers' ? 'contact_first_names' : 'first_names', kind === 'suppliers' ? 'Nombres del contacto' : 'Nombres')}
      {input(kind === 'suppliers' ? 'contact_last_names' : 'last_names', kind === 'suppliers' ? 'Apellidos del contacto' : 'Apellidos')}
      {employee ? <TextField label="Teléfono" required type="tel" inputMode="numeric" placeholder="8000-0000" maxLength={9} onKeyDown={e => {
        const input = e.currentTarget, position = input.selectionStart
        if (position !== input.selectionEnd || input.value[4] !== '-') return
        const beforeDash = e.key === 'Delete' && position === 4
        const afterDash = e.key === 'Backspace' && position === 5
        if (!beforeDash && !afterDash) return
        e.preventDefault()
        const digits = input.value.replace(/-/g, ''), index = afterDash ? 3 : 4
        const next = digits.slice(0, index) + digits.slice(index + 1)
        update('phone_number', next.length > 4 ? next.slice(0, 4) + '-' + next.slice(4) : next)
        requestAnimationFrame(() => input.setSelectionRange(index, index))
      }} value={values.phone_number ?? ''} onChange={e => {
        const input = e.target, position = input.selectionStart ?? input.value.length
        const before = input.value.slice(0, position).replace(/[^0-9]/g, '').length
        const digits = input.value.replace(/[^0-9]/g, '').slice(0, 8)
        update('phone_number', digits.length > 4 ? digits.slice(0, 4) + '-' + digits.slice(4) : digits)
        requestAnimationFrame(() => { const caret = before + (before > 4 ? 1 : 0); input.setSelectionRange(caret, caret) })
      }} /> : <TextField label="Teléfono" required={!customer || delivery} type="tel" inputMode="numeric" pattern="[0-9]{1,10}" maxLength={10} value={values.phone_number ?? ''} onChange={e => { if (/^[0-9]*$/.test(e.target.value)) update('phone_number', e.target.value) }} />}
      {!customer && !employee && input('work_email', 'Correo', false, employee ? 100 : 40, 'email')}
      {employee && <>{<SelectField label="Cargo" value={values.job_title ?? ''} onChange={e => update('job_title', e.target.value)}><option value="">Sin cargo asignado</option><option value="Vendedor">Vendedor</option>{row && values.job_title && values.job_title !== 'Vendedor' && <option value={values.job_title}>{values.job_title} (histórico)</option>}</SelectField>}{input('start_date', 'Fecha de ingreso', false, 10, 'date')}
        {!row ? input('username', 'Usuario de acceso', true, 64) : <p>Usuario de acceso: <b>{'username' in row ? row.username ?? 'Sin cuenta vinculada' : ''}</b></p>}
        <TextField label={row ? 'Nueva contraseña (opcional)' : 'Contraseña'} required={!row} type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={6} maxLength={128} value={values.password ?? ''} onChange={e => update('password', e.target.value)} /><button type="button" className="secondary" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</button></>}
      <AddressFields values={values} update={update} required={addressRequired} />
    </div>
    {employee && <p className={styles.hint}>La cuenta tendrá acceso como Colaborador. Solo Dueña puede reemplazar su contraseña. Usa de 6 a 128 caracteres.</p>}
    </fieldset>{(error || (kind === 'suppliers' && supplierCommand.error)) && <Message>{error || supplierCommand.error}</Message>}{kind === 'suppliers' && supplierCommand.pending && <Message variant="info">Proveedor pendiente de confirmación. Reintenta la misma solicitud.</Message>}<div className={styles.actions}><button type="button" className="secondary" disabled={busy || supplierCommand.busy} onClick={onClose}>Cancelar</button><button type="submit" disabled={busy || (kind === 'suppliers' && (supplierCommand.busy || supplierCommand.blocked))}>{kind === 'suppliers' && supplierCommand.pending ? 'Reintentar mismo proveedor' : busy ? 'Guardando…' : row ? 'Guardar cambios' : onDraft ? `Usar ${partyLabels[kind]} en esta operación` : `Guardar ${partyLabels[kind]}`}</button></div>
  </form></Modal>
}
