import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { apiClient } from '../../shared/api/client'
import { getErrorMessage } from '../../shared/api/errors'
import { exactMoney } from '../../shared/forms/fields'
import { Message } from '../../shared/ui/Feedback'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { useSession } from '../session/sessionContext'
import { amount, cents, money, query, useChoices, useQuery } from './api'
import type { Page, Product } from './contracts'
import { Badge, DataState, Modal, Pager, Panel, Stats, Table } from './ui'
import { ReferenceModal } from './ReferenceModal'
import styles from './Boutique.module.css'

function ProductForm({ row, date, onSaved, onClose }: { row?: Product; date: string; onSaved: () => void; onClose: () => void }) {
  const [name, setName] = useState(row?.name ?? ''), [category, setCategory] = useState(String(row?.category_id ?? '')), [size, setSize] = useState(String(row?.size_id ?? '')), [cost, setCost] = useState(row?.cost ?? ''), [stock, setStock] = useState('0'), [description, setDescription] = useState(row?.description ?? ''), [busy, setBusy] = useState(false), [error, setError] = useState(''), sending = useRef(false)
  const categories = useChoices('categories'), sizes = useChoices('sizes')
  const calculated = exactMoney(cost) && cents(cost) > 0n ? amount((cents(cost) * 115n + 50n) / 100n) : null
  async function submit(event: FormEvent) {
    event.preventDefault(); if (sending.current) return
    if (!category || !size || (!row && (!calculated || !/^\d+$/.test(stock))) || (cost && !calculated)) { setError('Revisa categoría, talla, costo positivo y cantidad inicial entera.'); return }
    const body = { name: name.trim(), category_id: Number(category), ...(!row || Number(size) !== row.size_id ? { size_id: Number(size) } : {}), description: description.trim() || null, ...(cost ? { cost: exactMoney(cost) } : {}), ...(!row ? { initial_stock: Number(stock) } : {}) }
    sending.current = true; setBusy(true); setError('')
    try { await apiClient.request(`/api/v1/products${row ? '/' + row.product_id : ''}`, { method: row ? 'PATCH' : 'POST', body }); onSaved() }
    catch (error) { setError(getErrorMessage(error, 'No se pudo guardar el producto.')) } finally { sending.current = false; setBusy(false) }
  }
  return <Modal title={row ? 'Editar producto' : 'Nuevo producto'} onClose={() => { if (!busy) onClose() }}><form className={styles.form} onSubmit={e => void submit(e)}><fieldset disabled={busy}><div className={styles.formGrid}>
    <TextField label="Nombre" required maxLength={40} value={name} onChange={e => setName(e.target.value)} /><TextField label="Fecha actual" type="date" readOnly value={date} />
    <DataState result={categories}><SelectField label="Categoría" required value={category} onChange={e => setCategory(e.target.value)}><option value="">Selecciona</option>{categories?.data?.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField></DataState>
    <DataState result={sizes}><SelectField label="Talla" required value={size} onChange={e => setSize(e.target.value)}><option value="">Selecciona</option>{row && !sizes?.data?.some(item => item.id === row.size_id) && <option value={row.size_id}>{row.size_name} (histórica)</option>}{sizes?.data?.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField></DataState>
    <TextField label="Costo (NIO)" required={!row} inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)} />
    <TextField label="Precio de venta (+15 %)" readOnly value={money(calculated ?? row?.unit_price)} />
    {!row && <TextField label="Cantidad inicial" inputMode="numeric" required value={stock} onChange={e => setStock(e.target.value)} />}
    <div className={styles.full}><TextField label="Descripción (opcional)" maxLength={500} value={description} onChange={e => setDescription(e.target.value)} /></div>
  </div><p className={styles.hint}>{row ? 'El stock cambia mediante ventas, recepciones y anulaciones autorizadas.' : 'La cantidad inicial se registra como un movimiento de inventario auditable.'} Nombre identifica la prenda; categoría la agrupa y talla indica su medida. El costo principal determina el precio (+15 %, redondeado a dos decimales). La cantidad inicial son las unidades disponibles al registrar el producto. La descripción permite añadir detalles. Los costos de compra por proveedor se registran en Compras y conservan su historia.</p>
    {error && <Message>{error}</Message>}<div className={styles.actions}><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button>{busy ? 'Guardando…' : row ? 'Guardar cambios' : 'Guardar producto'}</button></div>
  </fieldset></form></Modal>
}
export default function Products() {
  const owner = useSession().state.account?.role === 'Administrator', [params] = useSearchParams()
  const [q, setQ] = useState(''), [category, setCategory] = useState(''), [status, setStatus] = useState(params.get('status') ?? ''), [filters, setFilters] = useState(query({ status: params.get('status') ?? '' })), [page, setPage] = useState(1), [revision, setRevision] = useState(0), [editing, setEditing] = useState<Product | 'new' | null>(null), [changing, setChanging] = useState<Product | null>(null), [catalogs, setCatalogs] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const categories = useChoices('categories', revision), result = useQuery<Page<Product>>(`reports/product-catalog?${filters}&offset=${(page - 1) * 20}&limit=20`, revision), summary = result?.data?.summary ?? {}, rows = result?.data?.items ?? []
  async function toggle() {
    if (!changing || busy) return
    setBusy(true); setError('')
    try { await apiClient.request(`/api/v1/products/${changing.product_id}`, { method: 'PATCH', body: { is_active: !changing.is_active } }); setChanging(null); setRevision(value => value + 1) }
    catch (error) { setError(getErrorMessage(error, 'No se pudo cambiar el estado.')) } finally { setBusy(false) }
  }
  return <div className={styles.page}><div className={styles.intro}><p>{owner ? 'Control de productos e inventario de H&D Boutique' : 'Consulta productos, precios y disponibilidad'}</p>{owner && <div className={styles.actions}><button className="secondary" onClick={() => setCatalogs(true)}>Categorías</button><button onClick={() => setEditing('new')}>+ Nuevo producto</button></div>}</div>
    {notice && <Message variant="success">{notice}</Message>}
    <DataState result={result}><Stats items={[{ label: 'Total de productos', value: summary.total_count }, ...(owner ? [{ label: 'Valor del inventario', value: money(summary.inventory_value), hint: Number(summary.unknown_value_count) > 0 ? `${summary.unknown_value_count} sin valoración completa` : 'Valor al costo' }] : []), { label: 'Productos bajos en stock', value: summary.low_stock, hint: 'Stock entre 1 y 5' }, { label: 'Productos sin stock', value: summary.out_of_stock, hint: 'Necesitan reposición' }]} /></DataState>
    <Panel><form className={styles.filters} onSubmit={e => { e.preventDefault(); setFilters(query({ q, category_id: category, status })); setPage(1) }}><TextField label="Buscar producto" placeholder="Buscar por nombre" value={q} maxLength={100} onChange={e => setQ(e.target.value)} />
      <SelectField label="Categoría" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas las categorías</option>{categories?.data?.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</SelectField>
      <SelectField label="Estado" value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="available">En stock</option><option value="low_stock">Stock bajo (1–5)</option><option value="out_of_stock">Agotados</option><option value="unknown">Pendientes de conteo</option><option value="invalid">Stock inválido</option></SelectField>
      <div className={styles.actions}><button>Buscar</button><button type="button" className="secondary" onClick={() => { setQ(''); setCategory(''); setStatus(''); setFilters(''); setPage(1) }}>Limpiar</button></div></form></Panel>
    <Panel title="Listado de productos"><DataState result={result} empty={!rows.length}><Table label="Listado de productos"><thead><tr><th>Producto</th><th>Categoría</th><th>Talla</th>{owner && <th>Proveedor</th>}<th>Precio de venta</th>{owner && <th>Costo</th>}<th>Stock</th><th>Estado</th>{owner && <th>Acciones</th>}</tr></thead><tbody>{rows.map(row => <tr key={row.product_id}><td>{row.name ?? 'Sin nombre'}</td><td>{row.category_name ?? 'Sin categoría'}</td><td>{row.size_name}</td>{owner && <td>{row.suppliers?.length ? row.suppliers.join('; ') : row.supplier_name ?? 'Sin proveedores registrados'}</td>}<td>{money(row.unit_price)}</td>{owner && <td>{money(row.cost)}</td>}<td>{row.legacy_stock ?? 'Pendiente'}</td><td><Badge status={row.is_active ? row.status : false} /></td>{owner && <td><div className={styles.actions}><button className="secondary" onClick={() => setEditing(row)}>Editar</button><button className="secondary" onClick={() => { setChanging(row); setError('') }}>{row.is_active ? 'Desactivar' : 'Activar'}</button></div></td>}</tr>)}</tbody></Table></DataState><Pager page={page} total={Number(summary.total_count ?? 0)} onChange={setPage} /></Panel>
    {editing && owner && <ProductForm row={editing === 'new' ? undefined : editing} date={result?.data?.context.business_date ?? ''} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRevision(value => value + 1); setNotice('Producto guardado correctamente.') }} />}
    {changing && <Modal title={changing.is_active ? 'Desactivar producto' : 'Activar producto'} onClose={() => { if (!busy) setChanging(null) }}><p>{changing.name}</p><p>{changing.is_active ? 'No podrá utilizarse en nuevas ventas o compras. Se conservará todo su historial.' : 'Volverá a estar disponible para nuevas operaciones.'}</p>{error && <Message>{error}</Message>}<button disabled={busy} onClick={() => void toggle()}>Confirmar</button></Modal>}
    {catalogs && owner && <ReferenceModal kind="products" onClose={() => { setCatalogs(false); setRevision(value => value + 1) }} />}
  </div>
}
