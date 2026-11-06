import { useState } from 'react'
import { apiClient } from '../../shared/api/client'
import { getErrorMessage } from '../../shared/api/errors'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { Message } from '../../shared/ui/Feedback'
import { Icon } from '../../shared/ui/Icon'
import { useSession } from '../session/sessionContext'
import { dateText, query, useQuery } from './api'
import type { Employee, Page } from './contracts'
import { PartyForm } from './PartyForm'
import { ReferenceModal } from './ReferenceModal'
import { Badge, DataState, Modal, Pager, Panel, Stats } from './ui'
import { CommerceEmpty, CommerceIntro, CommerceTable } from './CommerceUI'
import styles from './Boutique.module.css'
import ui from './Commerce.module.css'
import people from './People.module.css'

export default function Employees() {
  const owner = useSession().state.account?.role === 'Administrator'
  const [q, setQ] = useState(''), [status, setStatus] = useState(''), [filters, setFilters] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<Employee | 'new' | null>(null), [changing, setChanging] = useState<Employee | null>(null), [reference, setReference] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const result = useQuery<Page<Employee>>(`reports/employee-directory?${filters}&offset=${(page - 1) * 20}&limit=20`, revision), rows = result?.data?.items ?? [], summary = result?.data?.summary ?? {}
  async function toggle() {
    if (!changing || busy) return
    setBusy(true); setError('')
    try {
      await apiClient.request(`/api/v1/employees/${changing.employee_id}`, { method: 'PATCH', body: { is_active: !changing.is_active } })
      setChanging(null); setRevision(value => value + 1); setNotice('Estado actualizado. El historial se conserva.')
    } catch (error) { setError(getErrorMessage(error, 'No se pudo cambiar el estado.')) } finally { setBusy(false) }
  }
  return <div className={styles.page}>
    <CommerceIntro icon="employees" title="El equipo de tu boutique" description="Datos del personal y gestión de sus cuentas de acceso." action={<div className={ui.actions}>{owner && <button type="button" className="secondary" onClick={() => setReference(true)}>Departamentos y municipios</button>}<button type="button" onClick={() => setEditing('new')}>+ Nuevo empleado</button></div>} />
    {notice && <Message variant="success">{notice}</Message>}
    <DataState result={result}><Stats items={[[ 'Empleados registrados', 'total_count' ], [ 'Activos', 'active_count' ], [ 'Inactivos', 'inactive_count' ], [ 'Colaboradores', 'collaborators' ]].map(([label, field]) => ({ label: label!, value: summary[field!] ?? '—', icon: <Icon name="employees" size={17} /> }))} /></DataState>
    <Panel><div className={ui.heading}><div><h2>Encuentra a alguien del equipo</h2><p>Consulta por nombre y filtra por estado del empleado.</p></div></div><form className={ui.filters} onSubmit={event => { event.preventDefault(); setFilters(query({ q, status })); setPage(1) }}>
      <TextField label="Buscar" placeholder="Nombre o apellidos" value={q} onChange={event => setQ(event.target.value)} maxLength={100} />
      <SelectField label="Estado" value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></SelectField>
      <div className={ui.actions}><button>Buscar</button><button type="button" className="secondary" onClick={() => { setQ(''); setStatus(''); setFilters(''); setPage(1) }}>Limpiar</button></div>
    </form></Panel>
    <Panel><div className={ui.heading}><div><h2>Listado de empleados</h2><p>El cargo describe su función. Los permisos pertenecen a su cuenta y se conservan al editar sus datos.</p></div>{result?.data && <span className={ui.count}>{summary.total_count} empleados</span>}</div>
      {!result ? <CommerceEmpty title="Cargando empleados…" loading /> : result.error !== undefined ? <DataState result={result}>{null}</DataState> : !rows.length ? <CommerceEmpty title="No hay empleados para mostrar">Prueba con otro nombre, limpia los filtros o registra a una persona con Nuevo empleado.</CommerceEmpty> : <CommerceTable label="Directorio"><thead><tr><th>Nombre completo</th><th>Cargo</th><th>Contacto y domicilio</th><th>Cuenta de acceso</th><th>Ingreso</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.map(row => <tr key={row.employee_id}>
        <td><strong>{row.first_names} {row.last_names}</strong><small>Empleado #{row.employee_id}</small></td><td data-label="Cargo">{row.job_title || 'Sin cargo histórico'}</td><td data-label="Contacto y domicilio" data-wide><strong>{row.phone_number?.replace(/^([78][0-9]{3})([0-9]{4})$/, '$1-$2') || 'Sin teléfono'}</strong><small>{row.address_line || 'Sin dirección registrada'}</small><small>{[row.department_name, row.municipality_name].filter(Boolean).join(' · ') || 'Sin ubicación registrada'}</small></td><td data-label="Cuenta de acceso"><span>{row.username || 'Sin cuenta vinculada'}</span><small>{row.user_id ? row.is_active ? 'Cuenta vinculada' : 'Acceso desactivado' : 'Sin acceso al sistema'}</small></td><td data-label="Ingreso">{dateText(row.start_date)}</td><td data-label="Estado"><Badge status={row.is_active} /></td><td data-action><div className={people.rowActions}><button type="button" className="secondary" title="Editar datos y gestionar contraseña" onClick={() => setEditing(row)}>Editar</button><button type="button" className={`secondary ${row.is_active ? people.sensitive : ''}`} onClick={() => { setChanging(row); setError('') }}>{row.is_active ? 'Desactivar' : 'Activar'}</button></div></td>
      </tr>)}</tbody></CommerceTable>}
      <Pager page={page} total={Number(summary.total_count ?? 0)} onChange={setPage} />
    </Panel>
    {editing && <PartyForm kind="employees" row={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRevision(value => value + 1); setNotice('Registro guardado correctamente.') }} />}
    {changing && <Modal title={`${changing.is_active ? 'Desactivar' : 'Activar'} empleado`} onClose={() => { if (!busy) setChanging(null) }}><div className={styles.form}>
      <div className={ui.formIntro}><span className={ui.icon}><Icon name="lock" /></span><p><strong>{changing.first_names} {changing.last_names}</strong>{changing.username || 'Sin cuenta vinculada'} · Empleado #{changing.employee_id}</p></div>
      <div className={ui.note}><Icon name="alert" size={20} /><p><strong>{changing.is_active ? 'Revisa el cambio de acceso' : 'Restaurar disponibilidad'}</strong>{changing.is_active ? 'Se bloqueará su acceso y se invalidarán sus sesiones. Su historial se conservará.' : 'Volverá a estar disponible para operaciones nuevas.'}</p></div>
      {error && <Message>{error}</Message>}
      <div className={ui.footer}><button type="button" className="secondary" disabled={busy} onClick={() => setChanging(null)}>Cancelar</button><button type="button" disabled={busy} onClick={() => void toggle()}>{busy ? 'Guardando…' : `Confirmar ${changing.is_active ? 'desactivación' : 'activación'}`}</button></div>
    </div></Modal>}
    {reference && <ReferenceModal kind="locations" onClose={() => { setReference(false); setRevision(value => value + 1) }} />}
  </div>
}
