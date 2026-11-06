import { useState } from 'react'
import type { FormEvent } from 'react'
import { exactMoney } from '../../shared/forms/fields'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { Message } from '../../shared/ui/Feedback'
import { Icon } from '../../shared/ui/Icon'
import { SearchSelect } from './SearchSelect'
import { PurchaseProductSelect, PurchaseSupplierSelect } from './PurchaseSelectors'
import { useSession } from '../session/sessionContext'
import { useCashCommand } from '../cash-register/useCashCommand'
import { amount, cents, dateText, money, query, useQuery } from './api'
import { PartyForm } from './PartyForm'
import type { Page, Product, PurchaseRow, Supplier } from './contracts'
import { Badge, DataState, Modal, Pager, Panel, Stats } from './ui'
import { CommerceEmpty, CommerceIntro, CommerceSection, CommerceTable } from './CommerceUI'
import ui from './Commerce.module.css'
import styles from './Boutique.module.css'

interface Purchase { purchase_id: number; purchase_date: string; status: string | null; shipping_cost: string | null; total: string | null; description: string | null; items: { purchase_item_id: number; product_id: number | null; quantity: number; unit_cost: string | null; subtotal: string | null }[] }
interface Offer { supplierId: number; costId: number; productId: number; name: string; price: string }
function PurchaseForm({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: () => void }) {
  const [newSupplier, setNewSupplier] = useState(false), [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null), [notice, setNotice] = useState(''), [supplierRevision, setSupplierRevision] = useState(0)
  const account = useSession().state.account!, [supplier, setSupplier] = useState(''), [selectedProduct, setSelectedProduct] = useState<Product | null>(null), [quantity, setQuantity] = useState('1'), [shipping, setShipping] = useState('0.00'), [description, setDescription] = useState(''), [lines, setLines] = useState<{ offer: Offer; quantity: number }[]>([])
  const command = useCashCommand<Purchase>(account.user_id, 'purchase', onSaved)
  const cost = selectedProduct?.cost ?? ''
  const total = lines.reduce((sum, line) => sum + cents(line.offer.price) * BigInt(line.quantity), 0n) + cents(shipping)
  function add() {
    const product = selectedProduct
    const offer: Offer | undefined = product && exactMoney(cost) && cents(cost) > 0n ? { supplierId: Number(supplier), costId: product.product_id, productId: product.product_id, name: product.name ?? 'Nombre histórico no registrado', price: exactMoney(cost)! } : undefined
    if (!offer || !/^[1-9]\d*$/.test(quantity) || Number(quantity) > 2147483647) { command.setError('Selecciona un producto, costo positivo y cantidad entera positiva.'); return }
    setLines(current => { const found = current.find(row => row.offer.costId === offer.costId); return found ? current.map(row => row === found ? { ...row, quantity: row.quantity + Number(quantity) } : row) : [...current, { offer, quantity: Number(quantity) }] }); command.setError('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (command.pending) { await command.send('', {}); return }
    if (!supplier || !lines.length || exactMoney(shipping) === null || cents(shipping) < 0n) { command.setError('Revisa proveedor, productos y costo de envío.'); return }
    await command.send('/api/v1/purchases', { supplier_id: Number(supplier), purchase_date: date, shipping_cost: exactMoney(shipping), description: description.trim() || null, items: lines.map(line => ({ product_id: line.offer.productId, quantity: line.quantity })) })
  }
  return <Modal title="Nueva compra" wide onClose={() => { if (!command.busy) onClose() }}><form className={styles.form} onSubmit={e => void submit(e)}><fieldset disabled={command.locked}>
    <div className={ui.formIntro}><span className={ui.icon}><Icon name="purchases" /></span><p><strong>Prepara tu próxima entrada de mercadería</strong>Selecciona un proveedor, añade sus productos y revisa el importe.</p></div>
    <CommerceSection number="01" title="Proveedor y fecha"><div className={ui.supplierRow}><PurchaseSupplierSelect value={supplier} current={selectedSupplier} activeOnly revision={supplierRevision} onChange={row => { setSelectedSupplier(row); setSupplier(row ? String(row.supplier_id) : ''); setLines([]); setSelectedProduct(null) }} />
      <button type="button" className="secondary" onClick={() => setNewSupplier(true)}>+ Registrar proveedor</button><TextField label="Fecha de compra" readOnly type="date" value={date} />
    </div>{notice && <Message variant="success">{notice}</Message>}{selectedSupplier && <div className={`${ui.note} ${ui.supplierNote}`}><Icon name="suppliers" size={18} /><p><strong>{selectedSupplier.company_name}</strong>{[`${selectedSupplier.contact_first_names ?? ''} ${selectedSupplier.contact_last_names ?? ''}`.trim(), selectedSupplier.phone_number, selectedSupplier.address_line].filter(Boolean).join(' · ')}</p></div>}</CommerceSection>
    <CommerceSection number="02" title="Productos asociados" description="El buscador muestra únicamente los productos de este proveedor. Puedes buscar por nombre o recorrer las páginas."><div className={ui.selection}>{supplier ? <PurchaseProductSelect key={supplier} supplierId={supplier} current={selectedProduct} onChange={setSelectedProduct} /> : <SearchSelect label="Producto" disabled value="" options={[]} onChange={() => undefined} />}<TextField label="Costo de compra (NIO)" readOnly value={money(cost)} /><TextField label="Cantidad" inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)} /><button type="button" className="secondary" onClick={add}>Agregar producto</button></div></CommerceSection>
    <CommerceSection number="03" title="Resumen de productos"><CommerceTable label="Productos de compra"><thead><tr><th>Producto</th><th>Cantidad</th><th>Costo</th><th>Subtotal</th><th>Acción</th></tr></thead><tbody>{lines.map(line => <tr key={line.offer.costId}><td>{line.offer.name}</td><td data-label="Cantidad">{line.quantity}</td><td data-label="Costo" data-money>{money(line.offer.price)}</td><td data-label="Subtotal" data-money data-total>{money(amount(cents(line.offer.price) * BigInt(line.quantity)))}</td><td data-action><button type="button" className="secondary" onClick={() => setLines(current => current.filter(row => row !== line))}>Quitar</button></td></tr>)}</tbody></CommerceTable>{!lines.length && <CommerceEmpty title="Aún no has agregado productos">Selecciona una prenda y su cantidad para incorporarla a la compra.</CommerceEmpty>}</CommerceSection>
    <CommerceSection number="04" title="Envío y observaciones"><div className={ui.formGrid}><TextField label="Costo de envío (NIO)" inputMode="decimal" value={shipping} onChange={e => setShipping(e.target.value)} /><TextField label="Descripción (opcional)" maxLength={500} value={description} onChange={e => setDescription(e.target.value)} /></div></CommerceSection>
    <div className={ui.summary}><div><span>Total de la compra</span><p>Productos y costo de envío · NIO</p></div><strong>{money(amount(total))}</strong></div><div className={ui.note}><Icon name="alert" size={18} /><p><strong>Se guardará como Pendiente</strong>El stock aumenta únicamente al confirmar la recepción completa.</p></div>
    </fieldset>{command.error && <Message>{command.error}</Message>}{command.pending && <Message variant="info">Compra pendiente de confirmación. Reintenta la misma solicitud.</Message>}
    <div className={ui.footer}><button type="button" className="secondary" disabled={command.busy} onClick={onClose}>Cerrar</button><button disabled={command.busy || command.blocked}>{command.busy ? 'Guardando…' : command.pending ? 'Reintentar misma compra' : 'Guardar compra pendiente'}</button></div>
  </form>{newSupplier && <PartyForm userId={account.user_id} kind="suppliers" onSaved={row => { const saved = row as Supplier; setSelectedSupplier(saved); setSupplierRevision(value => value + 1); setSupplier(String(saved.supplier_id)); setLines([]); setSelectedProduct(null); setNewSupplier(false); setNotice('Proveedor guardado y seleccionado. Ya está disponible para próximas compras.') }} onClose={() => setNewSupplier(false)} />}</Modal>
}
function PurchaseDetail({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
  const account = useSession().state.account!, [revision, setRevision] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const result = useQuery<Purchase>(`purchases/${id}`, revision), purchase = result?.data
  const command = useCashCommand(account.user_id, `receive.${id}`, () => { setConfirming(false); setRevision(value => value + 1); onSaved() })
  return <Modal title={`Compra #${id}`} wide onClose={onClose}><DataState result={result}>{purchase && <div className={styles.form}><div className={ui.detailTop}><p><strong>Detalle de la compra</strong>{dateText(purchase.purchase_date)}</p><Badge status={purchase.status ?? 'legacy'} /></div>
    <CommerceTable label="Detalle de compra"><thead><tr><th>Producto</th><th>Cantidad</th><th>Costo registrado</th><th>Subtotal</th></tr></thead><tbody>{purchase.items.map(row => <tr key={row.purchase_item_id}><td>Producto #{row.product_id ?? 'No registrado'}</td><td data-label="Cantidad">{row.quantity}</td><td data-label="Costo registrado" data-money>{money(row.unit_cost)}</td><td data-label="Subtotal" data-money data-total>{money(row.subtotal)}</td></tr>)}</tbody></CommerceTable><div className={ui.summary}><div><span>Total de la compra</span><p>Envío: {money(purchase.shipping_cost)}</p></div><strong>{money(purchase.total)}</strong></div>{purchase.description && <CommerceSection title="Observaciones"><p className={ui.muted}>{purchase.description}</p></CommerceSection>}
    <div className={ui.note}><Icon name={purchase.status === 'received' ? 'products' : 'alert'} size={19} /><p>{purchase.status === 'received' ? 'Mercadería recibida. Las existencias ya fueron actualizadas.' : purchase.status === 'registered' ? 'Compra pendiente: todavía no modifica las existencias. Confirma la recepción cuando llegue toda la mercadería.' : 'Registro histórico. Se conservan sus datos originales.'}</p></div>
    {(purchase.status === 'registered' || command.pending) && <div className={ui.footer}><button disabled={command.busy || command.blocked} onClick={() => command.pending ? void command.send(`/api/v1/purchases/${id}/receive`, {}) : setConfirming(true)}>{command.pending ? 'Reintentar misma recepción' : 'Marcar como recibida'}</button></div>}
    {command.error && <Message>{command.error}</Message>}
  </div>}</DataState>{confirming && <Modal title="Confirmar recepción" onClose={() => { if (!command.busy) setConfirming(false) }}><div className={styles.form}><div className={ui.note}><Icon name="products" size={22} /><p><strong>Compra #{id} · Recepción completa</strong>Confirma que recibiste todos los productos y cantidades del detalle. Se incorporarán al inventario una sola vez.</p></div>{command.error && <Message>{command.error}</Message>}<div className={ui.footer}><button type="button" className="secondary" disabled={command.busy} onClick={() => setConfirming(false)}>Cancelar</button><button disabled={command.busy || command.blocked} onClick={() => void command.send(`/api/v1/purchases/${id}/receive`, {})}>{command.busy ? 'Confirmando…' : 'Confirmar recepción'}</button></div></div></Modal>}</Modal>
}
export default function Purchases() {
  const [values, setValues] = useState<Record<string, string>>({}), [filters, setFilters] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0), [creating, setCreating] = useState(false), [detail, setDetail] = useState<number | null>(null)
  const [historySupplier, setHistorySupplier] = useState<Supplier | null>(null), [supplierReset, setSupplierReset] = useState(0)
  const result = useQuery<Page<PurchaseRow>>(`reports/purchase-ledger?${filters}&offset=${(page - 1) * 20}&limit=20`, revision), s = result?.data?.summary ?? {}, rows = result?.data?.items ?? []
  const update = (field: string, value: string) => setValues(current => ({ ...current, [field]: value }))
  return <div className={styles.page}>
    <CommerceIntro icon="purchases" title="Cada compra, bien organizada" description="Proveedores, mercadería y recepción en un solo lugar." action={<button aria-label="+ Nueva compra" onClick={() => setCreating(true)}><Icon name="plus" size={17} />Nueva compra</button>} />
    <DataState result={result}><Stats items={[{ label: 'Compras del mes', value: money(s.month_amount), icon: <Icon name="calendar" size={17} /> }, { label: 'Órdenes registradas', value: s.total_count, icon: <Icon name="purchases" size={17} /> }, { label: 'Monto invertido', value: money(s.invested_amount), hint: Number(s.unknown_total_count) > 0 ? `${s.unknown_total_count} importes históricos no registrados` : undefined, icon: <Icon name="wallet" size={17} /> }, { label: 'Proveedores activos', value: s.active_suppliers, icon: <Icon name="suppliers" size={17} /> }]} /></DataState>
    <Panel><div className={ui.heading}><div><h2>Consulta tus compras</h2><p>Filtra por proveedor, fecha o estado de recepción.</p></div></div><form className={ui.filters} onSubmit={event => { event.preventDefault(); setFilters(query(values)); setPage(1) }}>
      <TextField label="Buscar compra" placeholder="Número, proveedor o producto…" value={values.q ?? ''} maxLength={100} onChange={e => update('q', e.target.value)} />
      <PurchaseSupplierSelect key={supplierReset} value={values.supplier_id ?? ''} current={historySupplier} onChange={row => { setHistorySupplier(row); update('supplier_id', row ? String(row.supplier_id) : '') }} />
      <SelectField label="Estado" value={values.status ?? ''} onChange={e => update('status', e.target.value)}><option value="">Todos</option><option value="registered">Pendiente</option><option value="received">Recibida</option><option value="legacy">Histórica</option></SelectField>
      <TextField label="Desde" type="date" value={values.start_date ?? ''} onChange={e => update('start_date', e.target.value)} /><TextField label="Hasta" type="date" min={values.start_date} value={values.end_date ?? ''} onChange={e => update('end_date', e.target.value)} />
      <div className={ui.actions}><button>Buscar</button><button className="secondary" type="button" onClick={() => { setValues({}); setFilters(''); setPage(1); setHistorySupplier(null); setSupplierReset(value => value + 1) }}>Limpiar</button></div>
    </form></Panel>
    <Panel><div className={ui.heading}><div><h2>Listado de compras</h2><p>Conserva el seguimiento de cada orden y su recepción.</p></div>{result?.data && <span className={ui.count}>{s.total_count} compras</span>}</div>
      {!result ? <CommerceEmpty title="Cargando compras…" loading /> : result.error !== undefined ? <DataState result={result}>{null}</DataState> : !rows.length ? <CommerceEmpty title="No hay compras para mostrar">Las compras registradas aparecerán aquí. Puedes ajustar los filtros o preparar una nueva orden.</CommerceEmpty> : <CommerceTable label="Compras"><thead><tr><th>Número</th><th>Fecha</th><th>Proveedor</th><th>Productos</th><th>Cantidad</th><th>Envío</th><th>Monto</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{rows.map(row => <tr key={row.purchase_id}>
        <td>#{row.purchase_id}</td><td data-label="Fecha">{dateText(row.purchase_date)}</td><td data-label="Proveedor" data-wide>{row.supplier_name}</td><td data-label="Productos" data-wide>{row.products ?? 'Sin detalle'}</td><td data-label="Cantidad">{row.units ?? '—'}</td><td data-label="Envío" data-money>{money(row.shipping_cost)}</td><td data-label="Monto" data-money data-total>{money(row.total)}</td><td data-label="Estado" data-state><Badge status={row.status} /></td><td data-action><button className="secondary" onClick={() => setDetail(row.purchase_id)}>{row.status === 'registered' ? 'Ver / recibir' : 'Ver'}</button></td>
      </tr>)}</tbody></CommerceTable>}
      <Pager page={page} total={Number(s.total_count ?? 0)} onChange={setPage} />
    </Panel>
    {creating && <PurchaseForm date={result?.data?.context.business_date ?? ''} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setRevision(value => value + 1) }} />}
    {detail && <PurchaseDetail id={detail} onClose={() => setDetail(null)} onSaved={() => setRevision(value => value + 1)} />}
  </div>
}