import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { apiClient } from '../../shared/api/client'
import { getErrorMessage } from '../../shared/api/errors'
import { exactMoney, serverFields } from '../../shared/forms/fields'
import type { FieldErrors } from '../../shared/forms/fields'
import { Icon } from '../../shared/ui/Icon'
import { Message } from '../../shared/ui/Feedback'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { useSession } from '../session/sessionContext'
import { amount, cents, money, query, useChoices, useQuery } from './api'
import { SearchSelect } from './SearchSelect'
import type { Page, Product, Supplier } from './contracts'
import { DataState, Modal, Pager, Panel, Stats } from './ui'
import { ReferenceModal } from './ReferenceModal'
import { ProductCatalog } from './ProductCatalog'
import styles from './Boutique.module.css'
import ui from './Products.module.css'

function ProductForm({ row, date, onSaved, onClose }: { row?: Product; date: string; onSaved: () => void; onClose: () => void }) {
  const [name, setName] = useState(row?.name ?? ''), [category, setCategory] = useState(String(row?.category_id ?? '')), [size, setSize] = useState(String(row?.size_id ?? '')), [cost, setCost] = useState(row?.cost ?? ''), [supplier, setSupplier] = useState(''), [supplierQuery, setSupplierQuery] = useState(''), [selectedSuppliers, setSelectedSuppliers] = useState<{ id: number; label: string }[]>([]), [description, setDescription] = useState(row?.description ?? ''), [busy, setBusy] = useState(false), [error, setError] = useState(''), sending = useRef(false)
  const categories = useChoices('categories'), sizes = useChoices('sizes')
  const [fields, setFields] = useState<FieldErrors>({})
  const clearField = (field: string) => setFields(current => ({ ...current, [field]: '' }))
  const suppliers = useQuery<Page<Supplier>>('reports/supplier-directory?' + query({ q: supplierQuery, status: 'active', limit: 20 }))
  const calculated = exactMoney(cost) && cents(cost) > 0n ? amount((cents(cost) * 115n + 50n) / 100n) : null
  async function submit(event: FormEvent) {
    event.preventDefault(); if (sending.current) return
    if (!category || !size || (!row && (!calculated || !selectedSuppliers.length)) || (cost && !calculated)) { setError('Revisa categoría, talla, costo positivo y al menos un proveedor.'); return }
    const body = { name: name.trim(), category_id: Number(category), ...(!row || Number(size) !== row.size_id ? { size_id: Number(size) } : {}), description: description.trim() || null, ...(cost ? { cost: exactMoney(cost) } : {}), ...(selectedSuppliers.length ? { supplier_ids: selectedSuppliers.map(item => item.id) } : {}) }
    sending.current = true; setBusy(true); setError(''); setFields({})
    try { await apiClient.request(`/api/v1/products${row ? '/' + row.product_id : ''}`, { method: row ? 'PATCH' : 'POST', body }); onSaved() }
    catch (error) { setError(getErrorMessage(error, 'No se pudo guardar el producto.')); setFields(serverFields(error)) } finally { sending.current = false; setBusy(false) }
  }
  return <Modal title={row ? 'Editar producto' : 'Nuevo producto'} onClose={() => { if (!busy) onClose() }}><form className={styles.form} onSubmit={e => void submit(e)}>
    <div className={ui.formIntro}><span className={ui.introIcon}><Icon name="products" /></span><p><strong>{row ? `Producto #${row.product_id}` : 'Una nueva prenda para tu catálogo'}</strong>{row ? 'Actualiza sus datos conservando el historial.' : 'Completa la información, el costo y sus proveedores.'}</p></div>
    <fieldset disabled={busy}>
      <section className={ui.formSection} aria-labelledby="product-information"><h3 id="product-information" className={ui.sectionHeading}><span>01</span> Información del producto</h3><div className={styles.formGrid}>
        <TextField label="Nombre" error={fields.name} required maxLength={40} value={name} onChange={e => { setName(e.target.value); clearField('name') }} /><TextField label="Fecha actual" type="date" readOnly value={date} />
        <DataState result={categories}><SelectField label="Categoría" error={fields.category_id} required value={category} onChange={e => { setCategory(e.target.value); clearField('category_id') }}><option value="">Selecciona</option>{categories?.data?.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField></DataState>
        <DataState result={sizes}><SelectField label="Talla" error={fields.size_id} required value={size} onChange={e => { setSize(e.target.value); clearField('size_id') }}><option value="">Selecciona</option>{row && !sizes?.data?.some(item => item.id === row.size_id) && <option value={row.size_id}>{row.size_name} (histórica)</option>}{sizes?.data?.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField></DataState>
      </div></section>
      <section className={ui.formSection} aria-labelledby="product-pricing"><h3 id="product-pricing" className={ui.sectionHeading}><span>02</span> Costo y precio de venta</h3><div className={styles.formGrid}>
        <div><TextField label="Costo (NIO)" error={fields.cost} required={!row} inputMode="decimal" value={cost} onChange={e => { setCost(e.target.value); clearField('cost') }} /><p className={ui.help}>Importe en córdobas, con hasta dos decimales.</p></div>
        <div className={ui.pricePreview}><TextField label="Precio de venta (+15 %)" readOnly value={money(calculated ?? row?.unit_price)} /><p>Se calcula a partir del costo.</p></div>
      </div></section>
      <section className={ui.formSection} aria-labelledby="product-suppliers"><h3 id="product-suppliers" className={ui.sectionHeading}><span>03</span> Proveedores</h3>
        <SearchSelect loading={!suppliers} label="Proveedor" value={supplier} options={suppliers?.data?.items.map(item => ({ id: item.supplier_id, label: item.company_name, description: `${item.contact_first_names ?? ''} ${item.contact_last_names ?? ''} · ${item.phone_number ?? ''} · #${item.supplier_id}` })) ?? []} onSearch={setSupplierQuery} onChange={value => { setSupplier(value); const item = suppliers?.data?.items.find(item => item.supplier_id === Number(value)); if (item) setSelectedSuppliers(current => current.some(row => row.id === item.supplier_id) ? current : [...current, { id: item.supplier_id, label: item.company_name }]) }} />
        {!!selectedSuppliers.length && <ul className={ui.supplierList} aria-label="Proveedores seleccionados">{selectedSuppliers.map(item => <li key={item.id}><span>{item.label}</span><button type="button" onClick={() => setSelectedSuppliers(current => current.filter(row => row.id !== item.id))}>Quitar selección<span className={ui.srOnly}> de {item.label}</span></button></li>)}</ul>}
        {!!row?.suppliers?.length && <><p className={ui.help}>Proveedores asociados actualmente</p><ul className={ui.supplierList}>{row.suppliers.map(item => <li key={item}>{item}</li>)}</ul></>}
        <p className={ui.help}>Puedes añadir varios proveedores. Las asociaciones y los importes históricos se conservan.</p>
      </section>
      <section className={ui.formSection}><TextField label="Descripción (opcional)" error={fields.description} maxLength={500} value={description} onChange={e => { setDescription(e.target.value); clearField('description') }} /></section>
      <div className={ui.inventoryNote}><Icon name="products" size={18} /><p><strong>Las existencias se gestionan desde Compras</strong>{row ? 'Editar los datos conserva las existencias y el historial. Las entradas se registran mediante Compras y recepción.' : 'El producto comienza sin mercancía y registra un movimiento inicial de cero. Las existencias ingresan mediante Compras y recepción.'}</p></div>
    </fieldset>
    {error && <Message>{error}</Message>}<div className={ui.formActions}><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancelar</button><button disabled={busy}>{busy ? 'Guardando…' : row ? 'Guardar cambios' : 'Guardar producto'}</button></div>
  </form></Modal>
}
export default function Products() {
  const owner = useSession().state.account?.role === 'Administrator', [params] = useSearchParams()
  const [q, setQ] = useState(''), [category, setCategory] = useState(''), [status, setStatus] = useState(params.get('status') ?? ''), [filters, setFilters] = useState(query({ status: params.get('status') ?? '' })), [page, setPage] = useState(1), [revision, setRevision] = useState(0), [editing, setEditing] = useState<Product | 'new' | null>(null), [changing, setChanging] = useState<Product | null>(null), [catalogs, setCatalogs] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const categories = useChoices('categories', revision), result = useQuery<Page<Product>>(`reports/product-catalog?${filters}&offset=${(page - 1) * 20}&limit=20`, revision), summary = result?.data?.summary ?? {}, rows = result?.data?.items ?? []
  function clearFilters() { setQ(''); setCategory(''); setStatus(''); setFilters(''); setPage(1) }
  async function toggle() {
    if (!changing || busy) return
    setBusy(true); setError('')
    try { await apiClient.request(`/api/v1/products/${changing.product_id}`, { method: 'PATCH', body: { is_active: !changing.is_active } }); setChanging(null); setRevision(value => value + 1) }
    catch (error) { setError(getErrorMessage(error, 'No se pudo cambiar el estado.')) } finally { setBusy(false) }
  }
  return <div className={`${styles.page} ${ui.page}`}><div className={ui.intro}><div className={ui.introCopy}><span className={ui.introIcon}><Icon name="products" size={24} /></span><div><h2>{owner ? 'Tu catálogo, bajo control' : 'Encuentra la prenda ideal'}</h2><p>{owner ? 'Productos, precios y existencias en un solo vistazo.' : 'Consulta productos, precios y disponibilidad.'}</p></div></div>{owner && <div className={ui.toolbar}><button className="secondary" onClick={() => setCatalogs(true)}><Icon name="menu" size={16} />Categorías</button><button aria-label="+ Nuevo producto" onClick={() => setEditing('new')}><Icon name="plus" size={16} />Nuevo producto</button></div>}</div>
    {notice && <Message variant="success">{notice}</Message>}
    {result?.error === undefined && <DataState result={result}><Stats items={[{ label: 'Total de productos', value: summary.total_count, icon: <Icon name="products" size={17} /> }, ...(owner ? [{ label: 'Valor del inventario', value: money(summary.inventory_value), hint: Number(summary.unknown_value_count) > 0 ? `${summary.unknown_value_count} sin valoración completa` : 'Valor al costo', icon: <Icon name="wallet" size={17} /> }] : []), { label: 'Productos bajos en stock', value: summary.low_stock, hint: 'Stock entre 1 y 5', icon: <Icon name="chart" size={17} /> }, { label: 'Productos sin stock', value: summary.out_of_stock, hint: 'Necesitan reposición', icon: <Icon name="alert" size={17} /> }]} /></DataState>}
    <Panel><div className={ui.filtersHeading}><div><h2>Encuentra un producto</h2><p>Busca por nombre o combina los filtros de tu catálogo.</p></div></div><form className={ui.filters} onSubmit={e => { e.preventDefault(); setFilters(query({ q, category_id: category, status })); setPage(1) }}><TextField label="Buscar producto" placeholder="Nombre del producto…" value={q} maxLength={100} onChange={e => setQ(e.target.value)} />
      <SelectField label="Categoría" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas las categorías</option>{categories?.data?.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</SelectField>
      <SelectField label="Estado" value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="available">En stock</option><option value="low_stock">Stock bajo (1–5)</option><option value="out_of_stock">Agotados</option><option value="unknown">Pendientes de conteo</option><option value="invalid">Stock inválido</option></SelectField>
      <div className={ui.filterActions}><button>Buscar</button><button type="button" className="secondary" onClick={clearFilters}>Limpiar</button></div></form></Panel>
    <Panel><div className={ui.listHeading}><div><h2>Listado de productos</h2><p>Precios en córdobas · Existencias actuales</p></div>{result?.data && <span className={ui.count}>{summary.total_count} productos</span>}</div>
      {!result ? <div className={ui.loading} role="status" aria-live="polite"><p>Cargando productos…</p>{[1, 2, 3].map(item => <div key={item} className={ui.loadingRow} aria-hidden="true" />)}</div>
        : result.error !== undefined ? <div className={ui.empty}><Icon name="alert" size={30} /><Message>{getErrorMessage(result.error, 'No se pudieron cargar los productos.')}</Message><button type="button" className="secondary" onClick={() => setRevision(value => value + 1)}>Reintentar</button></div>
          : !rows.length ? <div className={ui.empty}><Icon name="products" size={34} /><h3>{filters ? 'No encontramos productos' : 'Tu catálogo está por comenzar'}</h3><p>{filters ? 'Prueba con otro nombre o ajusta los filtros para encontrar lo que buscas.' : owner ? 'Registra tu primera prenda para organizar sus precios, proveedores y existencias.' : 'Aquí aparecerán las prendas y su disponibilidad cuando estén registradas.'}</p>{filters ? <button type="button" className="secondary" onClick={clearFilters}>Limpiar filtros</button> : owner && <button type="button" onClick={() => setEditing('new')}>Registrar primer producto</button>}</div>
            : <ProductCatalog rows={rows} owner={owner} onEdit={setEditing} onToggle={row => { setChanging(row); setError('') }} />}
      <Pager page={page} total={Number(summary.total_count ?? 0)} onChange={setPage} />
    </Panel>
    {editing && owner && <ProductForm row={editing === 'new' ? undefined : editing} date={result?.data?.context.business_date ?? ''} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRevision(value => value + 1); setNotice('Producto guardado correctamente.') }} />}
    {changing && <Modal title={changing.is_active ? 'Desactivar producto' : 'Activar producto'} onClose={() => { if (!busy) setChanging(null) }}><div className={ui.confirmation}><div className={ui.confirmationProduct}><Icon name="products" size={26} /><div><strong>{changing.name}</strong><p>Producto #{changing.product_id} · Talla {changing.size_name}</p></div></div><div className={ui.inventoryNote}><Icon name={changing.is_active ? 'alert' : 'products'} size={20} /><p>{changing.is_active ? 'No podrá utilizarse en nuevas ventas o compras. Se conservará todo su historial.' : 'Volverá a estar disponible para nuevas operaciones.'}</p></div>{error && <Message>{error}</Message>}<div className={ui.formActions}><button type="button" className="secondary" disabled={busy} onClick={() => setChanging(null)}>Cancelar</button><button disabled={busy} onClick={() => void toggle()}>{busy ? 'Guardando…' : 'Confirmar'}</button></div></div></Modal>}
    {catalogs && owner && <ReferenceModal kind="products" onClose={() => { setCatalogs(false); setRevision(value => value + 1) }} />}
  </div>
}
