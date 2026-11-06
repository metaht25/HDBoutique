import { useState } from 'react'
import { Link } from 'react-router'
import { apiClient } from '../../shared/api/client'
import { getErrorMessage } from '../../shared/api/errors'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { Message } from '../../shared/ui/Feedback'
import { Icon } from '../../shared/ui/Icon'
import { money, query, useQuery } from './api'
import type { Page, Product, Supplier } from './contracts'
import { Badge, DataState, Modal, Pager, Panel, Stats } from './ui'
import { CommerceEmpty, CommerceIntro, CommerceSection, CommerceTable } from './CommerceUI'
import styles from './Boutique.module.css'
import ui from './Commerce.module.css'

function SupplierProducts({ supplierId }: { supplierId: number }) {
  const [q, setQ] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const result = useQuery<Page<Product>>('reports/product-catalog?' + query({ supplier_id: supplierId, q: search, offset: (page - 1) * 20, limit: 20 })), rows = result?.data?.items ?? []
  return <CommerceSection title="Productos asociados" description="Consulta las prendas vinculadas a este proveedor. Las asociaciones se gestionan desde Productos e Inventario.">
    <form className={ui.filters} onSubmit={event => { event.preventDefault(); setSearch(q); setPage(1) }}><TextField label="Buscar producto asociado" maxLength={100} placeholder="Nombre del producto…" value={q} onChange={event => setQ(event.target.value)} /><button type="submit" className="secondary">Buscar productos</button></form>
    <DataState result={result}>{rows.length ? <CommerceTable label="Productos asociados"><thead><tr><th>Producto</th><th>Talla</th><th>Costo</th><th>Precio de venta</th><th>Estado</th></tr></thead><tbody>{rows.map(row => <tr key={row.product_id}><td><strong>{row.name ?? 'Sin nombre'}</strong><small>{row.category_name ?? 'Sin categoría'} · #{row.product_id}</small></td><td data-label="Talla">{row.size_name}</td><td data-label="Costo" data-money>{money(row.cost)}</td><td data-label="Precio de venta" data-money>{money(row.unit_price)}</td><td data-label="Estado"><Badge status={row.is_active} /></td></tr>)}</tbody></CommerceTable> : <CommerceEmpty title="No hay productos para esta búsqueda">Los productos asociados aparecerán aquí cuando estén vinculados en el catálogo.</CommerceEmpty>}</DataState>
    <Pager page={page} total={Number(result?.data?.summary.total_count ?? 0)} onChange={setPage} />
  </CommerceSection>
}

export default function Suppliers() {
  const [q, setQ] = useState(''), [status, setStatus] = useState(''), [filters, setFilters] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0)
  const [detail, setDetail] = useState<Supplier | null>(null), [changing, setChanging] = useState<Supplier | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const result = useQuery<Page<Supplier>>(`reports/supplier-directory?${filters}&offset=${(page - 1) * 20}&limit=20`, revision), rows = result?.data?.items ?? [], summary = result?.data?.summary ?? {}
  async function toggle() {
    if (!changing || busy) return
    setBusy(true); setError('')
    try { await apiClient.request(`/api/v1/suppliers/${changing.supplier_id}`, { method: 'PATCH', body: { is_active: !changing.is_active } }); setChanging(null); setRevision(value => value + 1); setNotice('Estado actualizado. El historial se conserva.') }
    catch (error) { setError(getErrorMessage(error, 'No se pudo cambiar el estado.')) } finally { setBusy(false) }
  }
  return <div className={styles.page}>
    <CommerceIntro icon="suppliers" title="Tus aliados comerciales" description="Contactos, información comercial y productos de cada proveedor." action={<Link className="button secondary" to="/purchases"><Icon name="plus" size={16} />Registrar desde Compras</Link>} />
    {notice && <Message variant="success">{notice}</Message>}
    <DataState result={result}><Stats items={[{ label: 'Total de proveedores', value: summary.total_count, icon: <Icon name="suppliers" size={17} /> }, { label: 'Activos', value: summary.active_count, icon: <Icon name="people" size={17} /> }, { label: 'Inactivos', value: summary.inactive_count, icon: <Icon name="history" size={17} /> }]} /></DataState>
    <Panel><div className={ui.heading}><div><h2>Encuentra un proveedor</h2><p>Consulta por nombre, teléfono o empresa.</p></div></div><form className={ui.filters} onSubmit={event => { event.preventDefault(); setFilters(query({ q, status })); setPage(1) }}>
      <TextField label="Buscar" placeholder="Nombre, teléfono o empresa" value={q} onChange={event => setQ(event.target.value)} maxLength={100} />
      <SelectField label="Estado" value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></SelectField>
      <div className={ui.actions}><button>Buscar</button><button type="button" className="secondary" onClick={() => { setQ(''); setStatus(''); setFilters(''); setPage(1) }}>Limpiar</button></div>
    </form></Panel>
    <Panel><div className={ui.heading}><div><h2>Listado de proveedores</h2><p>Revisa los datos de contacto y su disponibilidad para nuevas operaciones.</p></div>{result?.data && <span className={ui.count}>{summary.total_count} proveedores</span>}</div>
      {!result ? <CommerceEmpty title="Cargando proveedores…" loading /> : result.error !== undefined ? <DataState result={result}>{null}</DataState> : !rows.length ? <CommerceEmpty title="No hay proveedores para mostrar">Ajusta los filtros o registra un proveedor desde Nueva compra. Su información se conserva aunque canceles esa compra.</CommerceEmpty> : <CommerceTable label="Directorio"><thead><tr><th>Empresa</th><th>Contacto</th><th>Teléfono</th><th>Correo</th><th>Dirección</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.map(row => <tr key={row.supplier_id}>
        <td><strong>{row.company_name}</strong><small>Proveedor #{row.supplier_id}</small></td><td data-label="Contacto">{row.contact_first_names} {row.contact_last_names}</td><td data-label="Teléfono">{row.phone_number || '—'}</td><td data-label="Correo">{row.work_email ?? '—'}</td><td data-label="Dirección" data-wide>{row.address_line ?? 'Sin dirección'}{(row.department_name || row.municipality_name) && <small>{[row.department_name, row.municipality_name].filter(Boolean).join(' · ')}</small>}</td><td data-label="Estado"><Badge status={row.is_active} /></td><td data-action><div><button type="button" className="secondary" onClick={() => setDetail(row)}>Ver detalle</button><button type="button" className="secondary" onClick={() => { setChanging(row); setError('') }}>{row.is_active ? 'Desactivar' : 'Activar'}</button></div></td>
      </tr>)}</tbody></CommerceTable>}
      <Pager page={page} total={Number(summary.total_count ?? 0)} onChange={setPage} />
    </Panel>
    {detail && <Modal title={`Proveedor #${detail.supplier_id}`} wide onClose={() => setDetail(null)}><div className={styles.form}>
      <div className={ui.detailTop}><div className={ui.introCopy}><span className={ui.icon}><Icon name="suppliers" /></span><p><strong>{detail.company_name}</strong>Información comercial</p></div><Badge status={detail.is_active} /></div>
      <div className={ui.formGrid}><CommerceSection title="Contacto"><dl className={ui.contact}><dt>Persona de contacto</dt><dd>{detail.contact_first_names} {detail.contact_last_names}</dd><dt>Teléfono</dt><dd>{detail.phone_number || 'No registrado'}</dd><dt>Correo</dt><dd>{detail.work_email ?? 'No registrado'}</dd></dl></CommerceSection><CommerceSection title="Ubicación"><dl className={ui.contact}><dt>Dirección</dt><dd>{detail.address_line ?? 'No registrada'}</dd>{detail.department_name && <><dt>Departamento</dt><dd>{detail.department_name}</dd></>}{detail.municipality_name && <><dt>Municipio</dt><dd>{detail.municipality_name}</dd></>}</dl></CommerceSection></div>
      <SupplierProducts supplierId={detail.supplier_id} />
      <div className={ui.footer}><button type="button" className="secondary" onClick={() => setDetail(null)}>Cerrar</button></div>
    </div></Modal>}
    {changing && <Modal title={`${changing.is_active ? 'Desactivar' : 'Activar'} proveedor`} onClose={() => { if (!busy) setChanging(null) }}><div className={styles.form}>
      <div className={ui.formIntro}><span className={ui.icon}><Icon name="suppliers" /></span><p><strong>{changing.company_name}</strong>Proveedor #{changing.supplier_id}</p></div><div className={ui.note}><Icon name="alert" size={19} /><p>{changing.is_active ? 'Dejará de estar disponible para nuevas operaciones. Su historial se conservará.' : 'Volverá a estar disponible para operaciones nuevas.'}</p></div>{error && <Message>{error}</Message>}
      <div className={ui.footer}><button type="button" className="secondary" disabled={busy} onClick={() => setChanging(null)}>Cancelar</button><button disabled={busy} onClick={() => void toggle()}>{busy ? 'Guardando…' : `Confirmar ${changing.is_active ? 'desactivación' : 'activación'}`}</button></div>
    </div></Modal>}
  </div>
}
