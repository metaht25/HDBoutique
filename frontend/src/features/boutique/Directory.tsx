import { useState } from 'react'
import { apiClient } from '../../shared/api/client'
import { getErrorMessage } from '../../shared/api/errors'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { Message } from '../../shared/ui/Feedback'
import { useSession } from '../session/sessionContext'
import { query, useChoices, useQuery } from './api'
import type { Page } from './contracts'
import { PartyForm } from './PartyForm'
import { partyId, partyLabels, partyName } from './party'
import type { Party, PartyKind } from './party'
import { Badge, DataState, Modal, Pager, Panel, Stats, Table } from './ui'
import { ReferenceModal } from './ReferenceModal'
import styles from './Boutique.module.css'

export default function Directory({ kind }: { kind: PartyKind }) {
  const owner = useSession().state.account?.role === 'Administrator'
  const [q, setQ] = useState(''), [status, setStatus] = useState(''), [department, setDepartment] = useState(''), [filters, setFilters] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<Party | 'new' | null>(null), [changing, setChanging] = useState<Party | null>(null), [reference, setReference] = useState<'locations' | 'accounts' | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const departments = useChoices('departments', revision)
  const names = { customers: 'customer', suppliers: 'supplier', employees: 'employee' }
  const result = useQuery<Page<Party>>(`reports/${names[kind]}-directory?${filters}&offset=${(page - 1) * 20}&limit=20`, revision), data = result?.data, summary = data?.summary ?? {}, rows = data?.items ?? []
  const stats = kind === 'customers' ? [ ['Clientes registrados', 'total_count'], ['Clientes nuevos', 'new_count'], ['Clientes activos', 'active_count'], ['Clientes con dirección', 'with_address'] ] : kind === 'suppliers' ? [ ['Total de proveedores', 'total_count'], ['Activos', 'active_count'], ['Inactivos', 'inactive_count'] ] : [ ['Empleados registrados', 'total_count'], ['Activos', 'active_count'], ['Inactivos', 'inactive_count'], ['Colaboradores', 'collaborators'] ]
  async function toggle() {
    if (!changing || busy) return
    setBusy(true); setError('')
    try { await apiClient.request(`/api/v1/${kind}/${partyId(changing)}`, { method: 'PATCH', body: { is_active: !changing.is_active } }); setChanging(null); setRevision(value => value + 1); setNotice('Estado actualizado. El historial se conserva.') }
    catch (error) { setError(getErrorMessage(error, 'No se pudo cambiar el estado.')) } finally { setBusy(false) }
  }
  return <div className={styles.page}>
    <div className={styles.intro}><p>{kind === 'customers' ? 'Consulta tus clientes y sus domicilios' : kind === 'suppliers' ? 'Contactos y proveedores de H&D Boutique' : 'Personal de la boutique y cuentas de acceso'}</p><div className={styles.actions}>
      {owner && <button className="secondary" onClick={() => setReference('locations')}>Departamentos y municipios</button>}{kind === 'employees' && <button className="secondary" onClick={() => setReference('accounts')}>Cuentas y accesos</button>}
      {kind === 'employees' && <button onClick={() => setEditing('new')}>+ Nuevo empleado</button>}</div></div>
    {notice && <Message variant="success">{notice}</Message>}
    <DataState result={result}><Stats items={stats.map(([label, field]) => ({ label: label!, value: summary[field!] ?? '—' }))} /></DataState>
    <Panel><form className={styles.filters} onSubmit={e => { e.preventDefault(); setFilters(query({ q, status, department_id: kind === 'customers' ? department : undefined })); setPage(1) }}>
      <TextField label="Buscar" placeholder="Nombre, teléfono o empresa" value={q} onChange={e => setQ(e.target.value)} maxLength={100} />
      {kind === 'customers' && <SelectField label="Departamento" value={department} onChange={e => setDepartment(e.target.value)}><option value="">Todos los departamentos</option>{departments?.data?.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</SelectField>}
      <SelectField label="Estado" value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></SelectField>
      <div className={styles.actions}><button>Buscar</button><button type="button" className="secondary" onClick={() => { setQ(''); setStatus(''); setDepartment(''); setFilters(''); setPage(1) }}>Limpiar</button></div>
    </form></Panel>
    <Panel title={`Listado de ${kind === 'customers' ? 'clientes' : kind === 'suppliers' ? 'proveedores' : 'empleados'}`}><DataState result={result} empty={rows.length === 0}><Table label="Directorio"><thead><tr><th>{kind === 'suppliers' ? 'Empresa' : 'Nombre completo'}</th>{kind === 'suppliers' && <th>Contacto</th>}<th>Teléfono</th>{kind === 'suppliers' && <th>Correo</th>}<th>Dirección</th><th>Departamento</th><th>Municipio</th>{kind === 'employees' && <><th>Cargo</th><th>Usuario</th><th>Ingreso</th></>}<th>Estado</th>{kind !== 'customers' && <th>Acciones</th>}</tr></thead>
      <tbody>{rows.map(row => <tr key={partyId(row)}><td>{partyName(row)}</td>{'company_name' in row && <td>{row.contact_first_names} {row.contact_last_names}</td>}<td>{kind === 'employees' ? row.phone_number?.replace(/^([78][0-9]{3})([0-9]{4})$/, '$1-$2') || '—' : row.phone_number || '—'}</td>{kind === 'suppliers' && 'work_email' in row && <td>{row.work_email ?? '—'}</td>}<td>{row.address_line ?? 'Sin dirección'}</td><td>{row.department_name ?? '—'}</td><td>{row.municipality_name ?? '—'}</td>{'employee_id' in row && <><td>{row.job_title ?? '—'}</td><td>{row.username ?? 'Sin acceso'}</td><td>{row.start_date ?? '—'}</td></>}<td><Badge status={row.is_active} /></td>{kind !== 'customers' && <td><div className={styles.actions}>{kind === 'employees' && <button className="secondary" onClick={() => setEditing(row)}>Editar</button>}<button className="secondary" onClick={() => { setChanging(row); setError('') }}>{row.is_active ? 'Desactivar' : 'Activar'}</button></div></td>}</tr>)}</tbody>
    </Table></DataState><Pager page={page} total={Number(summary.total_count ?? 0)} onChange={setPage} /></Panel>
    {kind === 'customers' && rows.length > 0 && <Panel title="Clientes recientes"><ul className={styles.recent}>{rows.slice(0, 4).map(row => <li key={partyId(row)}>{partyName(row)}<small>{row.phone_number ?? 'Sin teléfono'} · {row.department_name ?? 'Sin domicilio registrado'}</small></li>)}</ul></Panel>}
    {editing && <PartyForm kind={kind} row={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRevision(value => value + 1); setNotice('Registro guardado correctamente.') }} />}
    {changing && <Modal title={`${changing.is_active ? 'Desactivar' : 'Activar'} ${partyLabels[kind]}`} onClose={() => { if (!busy) setChanging(null) }}><p>{partyName(changing)}</p><p>{changing.is_active ? kind === 'employees' ? 'Se bloqueará su acceso y se invalidarán sus sesiones. Su historial se conservará.' : 'Dejará de estar disponible para nuevas operaciones. Su historial se conservará.' : 'Volverá a estar disponible para operaciones nuevas.'}</p>{error && <Message>{error}</Message>}<div className={styles.actions}><button className="secondary" disabled={busy} onClick={() => setChanging(null)}>Cancelar</button><button disabled={busy} onClick={() => void toggle()}>Confirmar {changing.is_active ? 'desactivación' : 'activación'}</button></div></Modal>}
    {reference && <ReferenceModal kind={reference} onClose={() => { setReference(null); setRevision(value => value + 1) }} />}
  </div>
}
