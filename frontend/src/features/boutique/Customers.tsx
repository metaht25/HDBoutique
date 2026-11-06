import { useState } from 'react'
import { Link } from 'react-router'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { Icon } from '../../shared/ui/Icon'
import { query, useChoices, useQuery } from './api'
import type { Customer, Page } from './contracts'
import { Badge, DataState, Modal, Pager, Panel, Stats } from './ui'
import { CommerceEmpty, CommerceIntro, CommerceSection, CommerceTable } from './CommerceUI'
import styles from './Boutique.module.css'
import ui from './Commerce.module.css'
import people from './People.module.css'

function customerType(kind: string | null) {
  return kind === 'general' ? 'Cliente general' : kind === 'delivery' ? 'Delivery' : 'Regular'
}

export default function Customers() {
  const [q, setQ] = useState(''), [status, setStatus] = useState(''), [department, setDepartment] = useState(''), [filters, setFilters] = useState(''), [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Customer | null>(null)
  const departments = useChoices('departments')
  const result = useQuery<Page<Customer>>(`reports/customer-directory?${filters}&offset=${(page - 1) * 20}&limit=20`), rows = result?.data?.items ?? [], summary = result?.data?.summary ?? {}
  return <div className={styles.page}>
    <CommerceIntro icon="people" title="Conoce a tus clientes" description="Información personal y domicilios de entrega, en un solo directorio." action={<Link className="button secondary" to="/new-sale"><Icon name="plus" size={16} />Registrar desde Nueva venta</Link>} />
    <DataState result={result}><Stats items={[[ 'Clientes registrados', 'total_count' ], [ 'Clientes nuevos', 'new_count' ], [ 'Clientes activos', 'active_count' ], [ 'Clientes con dirección', 'with_address' ]].map(([label, field]) => ({ label: label!, value: summary[field!] ?? '—', icon: <Icon name="people" size={17} /> }))} /></DataState>
    <div className={ui.note}><Icon name="people" size={20} /><p><strong>Cliente general</strong>Se reutiliza una única identidad para ventas sin datos personales. No forma parte del directorio de clientes registrados.</p></div>
    <Panel><div className={ui.heading}><div><h2>Encuentra un cliente</h2><p>Busca por nombre o teléfono y delimita por ubicación y estado.</p></div></div>
      <form className={`${ui.filters} ${people.filters}`} onSubmit={event => { event.preventDefault(); setFilters(query({ q, status, department_id: department })); setPage(1) }}>
        <TextField label="Buscar" placeholder="Nombre o teléfono" maxLength={100} value={q} onChange={event => setQ(event.target.value)} />
        <SelectField label="Departamento" value={department} onChange={event => setDepartment(event.target.value)}><option value="">Todos los departamentos</option>{departments?.data?.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</SelectField>
        <SelectField label="Estado" value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></SelectField>
        <div className={ui.actions}><button>Buscar</button><button type="button" className="secondary" onClick={() => { setQ(''); setStatus(''); setDepartment(''); setFilters(''); setPage(1) }}>Limpiar</button></div>
      </form><DataState result={departments}>{null}</DataState>
    </Panel>
    <Panel><div className={ui.heading}><div><h2>Listado de clientes</h2><p>El cliente general conserva una identidad única. Los demás clientes se registran desde Nueva venta.</p></div>{result?.data && <span className={ui.count}>{summary.total_count} clientes</span>}</div>
      {!result ? <CommerceEmpty title="Cargando clientes…" loading /> : result.error !== undefined ? <DataState result={result}>{null}</DataState> : !rows.length ? <CommerceEmpty title="No hay clientes para mostrar">Prueba con otro nombre o limpia los filtros. Los clientes registrados en Nueva venta aparecerán aquí.</CommerceEmpty> : <CommerceTable label="Directorio"><thead><tr><th>Nombre completo</th><th>Tipo de cliente</th><th>Teléfono</th><th>Dirección de entrega</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.map(row => <tr key={row.customer_id}>
        <td><strong>{row.first_names} {row.last_names}</strong><small>Cliente #{row.customer_id}</small></td><td data-label="Tipo de cliente"><span className={people.kind} data-kind={row.kind}>{customerType(row.kind)}</span></td><td data-label="Teléfono">{row.phone_number || 'Sin teléfono'}</td><td data-label="Dirección de entrega" data-wide>{row.address_line || 'Sin dirección registrada'}<small>{[row.department_name, row.municipality_name].filter(Boolean).join(' · ') || 'Sin ubicación registrada'}</small></td><td data-label="Estado"><Badge status={row.is_active} /></td><td data-action><button type="button" className="secondary" onClick={() => setDetail(row)}>Ver detalle</button></td>
      </tr>)}</tbody></CommerceTable>}
      <Pager page={page} total={Number(summary.total_count ?? 0)} onChange={setPage} />
    </Panel>
    {rows.length > 0 && <Panel title="Clientes recientes"><ul className={people.recent}>{rows.slice(0, 4).map(row => <li key={row.customer_id}><span className={people.avatar} aria-hidden="true"><Icon name="people" size={19} /></span><div><strong>{row.first_names} {row.last_names}</strong><small>{row.phone_number || 'Sin teléfono'} · {row.department_name || 'Sin domicilio registrado'}</small></div></li>)}</ul></Panel>}
    {detail && <Modal title={`Cliente #${detail.customer_id}`} onClose={() => setDetail(null)}><div className={styles.form}>
      <div className={ui.detailTop}><div className={ui.introCopy}><span className={ui.icon}><Icon name="people" /></span><p><strong>{detail.first_names} {detail.last_names}</strong>{customerType(detail.kind)}</p></div><Badge status={detail.is_active} /></div>
      <CommerceSection title="Información personal"><dl className={ui.contact}><dt>Teléfono</dt><dd>{detail.phone_number || 'No registrado'}</dd><dt>Tipo de cliente</dt><dd>{customerType(detail.kind)}</dd></dl></CommerceSection>
      <CommerceSection title="Datos de Delivery"><dl className={ui.contact}><dt>Departamento</dt><dd>{detail.department_name || 'No registrado'}</dd><dt>Municipio</dt><dd>{detail.municipality_name || 'No registrado'}</dd><dt>Dirección exacta</dt><dd>{detail.address_line || 'No registrada'}</dd></dl></CommerceSection>
      <div className={ui.note}><Icon name="people" size={20} /><p>{detail.kind === 'general' ? 'Esta identidad se reutiliza en las ventas a Cliente general.' : 'Los datos de Delivery se completan o actualizan al seleccionar este cliente en Nueva venta.'}</p></div>
      <div className={ui.footer}><button type="button" className="secondary" onClick={() => setDetail(null)}>Cerrar</button></div>
    </div></Modal>}
  </div>
}
