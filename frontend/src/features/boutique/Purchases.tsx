import { useState } from 'react'
import type { FormEvent } from 'react'
import { exactMoney } from '../../shared/forms/fields'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { Message } from '../../shared/ui/Feedback'
import { SearchSelect } from './SearchSelect'
import { useSession } from '../session/sessionContext'
import { useCashCommand } from '../cash-register/useCashCommand'
import { amount, cents, dateText, money, query, useQuery } from './api'
import { PartyForm } from './PartyForm'
import type { Page, Product, PurchaseRow, Supplier } from './contracts'
import { Badge, DataState, Modal, Pager, Panel, Stats, Table } from './ui'
import styles from './Boutique.module.css'

interface Purchase { purchase_id: number; purchase_date: string; status: string | null; shipping_cost: string | null; total: string | null; description: string | null; items: { purchase_item_id: number; product_id: number | null; quantity: number; unit_cost: string | null; subtotal: string | null }[] }
interface Offer { supplierId: number; costId: number; productId: number; name: string; price: string }
function PurchaseForm({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: () => void }) {
  const [newSupplier, setNewSupplier] = useState(false), [createdSupplier, setCreatedSupplier] = useState<Supplier | null>(null), [notice, setNotice] = useState(''), [supplierRevision, setSupplierRevision] = useState(0)
  const account = useSession().state.account!, [supplier, setSupplier] = useState(''), [q, setQ] = useState(''), [selected, setSelected] = useState(''), [quantity, setQuantity] = useState('1'), [shipping, setShipping] = useState('0.00'), [description, setDescription] = useState(''), [lines, setLines] = useState<{ offer: Offer; quantity: number }[]>([])
  const command = useCashCommand<Purchase>(account.user_id, 'purchase', onSaved), products = useQuery<Page<Product>>('reports/product-catalog?' + query({ status: 'active', supplier_id: supplier || undefined, limit: 100 }))
  const suppliers = useQuery<Page<Supplier>>('reports/supplier-directory?' + query({ q, status: 'active', limit: 20 }), supplierRevision)
  const supplierOptions = [...(createdSupplier && !suppliers?.data?.items.some(row => row.supplier_id === createdSupplier.supplier_id) ? [createdSupplier] : []), ...(suppliers?.data?.items ?? [])]
  const selectedSupplier = supplierOptions.find(row => row.supplier_id === Number(supplier))
  const cost = products?.data?.items.find(row => row.product_id === Number(selected))?.cost ?? ''
  const total = lines.reduce((sum, line) => sum + cents(line.offer.price) * BigInt(line.quantity), 0n) + cents(shipping)
  function add() {
    const product = products?.data?.items.find(row => row.product_id === Number(selected))
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
    <div className={styles.formGrid}><SearchSelect loading={!suppliers} label="Proveedor" required value={supplier} options={supplierOptions.map(row => ({ id: row.supplier_id, label: row.company_name, description: `${row.contact_first_names ?? ''} ${row.contact_last_names ?? ''} · ${row.phone_number ?? ''} · #${row.supplier_id}` }))} onSearch={setQ} onChange={value => { setSupplier(value); setLines([]); setSelected('') }} />
      <button type="button" className="secondary" onClick={() => setNewSupplier(true)}>+ Registrar proveedor</button><TextField label="Fecha de compra" readOnly type="date" value={date} />
    </div>{notice && <Message variant="success">{notice}</Message>}{selectedSupplier && <p className={styles.hint}>{[`${selectedSupplier.contact_first_names} ${selectedSupplier.contact_last_names}`, selectedSupplier.phone_number, selectedSupplier.address_line].filter(Boolean).join(' · ')}</p>}<DataState result={products}><div className={styles.filters}><SelectField label="Producto" disabled={!supplier} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Selecciona producto</option>{products?.data?.items.map(row => <option key={row.product_id} value={row.product_id}>{row.name ?? 'Nombre histórico no registrado'}</option>)}</SelectField><TextField label="Costo de compra (NIO)" readOnly value={money(cost)} /><TextField label="Cantidad" inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)} /><button type="button" className="secondary" onClick={add}>Agregar producto</button></div></DataState>
    <Table label="Productos de compra"><thead><tr><th>Producto</th><th>Cantidad</th><th>Costo</th><th>Subtotal</th><th>Acción</th></tr></thead><tbody>{lines.map(line => <tr key={line.offer.costId}><td>{line.offer.name}</td><td>{line.quantity}</td><td>{money(line.offer.price)}</td><td>{money(amount(cents(line.offer.price) * BigInt(line.quantity)))}</td><td><button type="button" className="secondary" onClick={() => setLines(current => current.filter(row => row !== line))}>Quitar</button></td></tr>)}</tbody></Table>
    <div className={styles.formGrid}><TextField label="Costo de envío (NIO)" inputMode="decimal" value={shipping} onChange={e => setShipping(e.target.value)} /><TextField label="Descripción (opcional)" maxLength={500} value={description} onChange={e => setDescription(e.target.value)} /></div>
    <div className={styles.summary}><p className={styles.total}><span>Total</span><span>{money(amount(total))}</span></p></div><p className={styles.hint}>La compra quedará Pendiente. El stock aumenta únicamente al confirmar la recepción completa.</p>
    </fieldset>{command.error && <Message>{command.error}</Message>}{command.pending && <Message variant="info">Compra pendiente de confirmación. Reintenta la misma solicitud.</Message>}
    <div className={styles.actions}><button type="button" className="secondary" disabled={command.busy} onClick={onClose}>Cerrar</button><button disabled={command.busy || command.blocked}>{command.busy ? 'Guardando…' : command.pending ? 'Reintentar misma compra' : 'Guardar compra pendiente'}</button></div>
  </form>{newSupplier && <PartyForm userId={account.user_id} kind="suppliers" onSaved={row => { const saved = row as Supplier; setCreatedSupplier(saved); setSupplierRevision(value => value + 1); setSupplier(String(saved.supplier_id)); setNewSupplier(false); setNotice('Proveedor guardado y seleccionado. Ya está disponible para próximas compras.') }} onClose={() => setNewSupplier(false)} />}</Modal>
}
function PurchaseDetail({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
  const account = useSession().state.account!, [revision, setRevision] = useState(0)
  const result = useQuery<Purchase>(`purchases/${id}`, revision), purchase = result?.data
  const command = useCashCommand(account.user_id, `receive.${id}`, () => { setRevision(value => value + 1); onSaved() })
  return <Modal title={`Compra #${id}`} wide onClose={onClose}><DataState result={result}>{purchase && <div className={styles.form}><div className={styles.actions}><p>{dateText(purchase.purchase_date)}</p><Badge status={purchase.status ?? 'legacy'} /></div>
    <Table label="Detalle de compra"><thead><tr><th>Producto</th><th>Cantidad</th><th>Costo registrado</th><th>Subtotal</th></tr></thead><tbody>{purchase.items.map(row => <tr key={row.purchase_item_id}><td>Producto #{row.product_id ?? 'No registrado'}</td><td>{row.quantity}</td><td>{money(row.unit_cost)}</td><td>{money(row.subtotal)}</td></tr>)}</tbody></Table><p>Envío: {money(purchase.shipping_cost)}</p><p className={styles.total}>Total: {money(purchase.total)}</p>{purchase.description && <p>{purchase.description}</p>}
    {(purchase.status === 'registered' || command.pending) && <><button disabled={command.busy || command.blocked} onClick={() => void command.send(`/api/v1/purchases/${id}/receive`, {})}>{command.pending ? 'Reintentar misma recepción' : 'Marcar como recibida'}</button></>}
    {command.error && <Message>{command.error}</Message>}
  </div>}</DataState></Modal>
}
export default function Purchases() {
  const [values, setValues] = useState<Record<string, string>>({}), [filters, setFilters] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0), [creating, setCreating] = useState(false), [detail, setDetail] = useState<number | null>(null)
  const result = useQuery<Page<PurchaseRow>>(`reports/purchase-ledger?${filters}&offset=${(page - 1) * 20}&limit=20`, revision), s = result?.data?.summary ?? {}, suppliers = useQuery<Page<Supplier>>('reports/supplier-directory?limit=100'), rows = result?.data?.items ?? []
  const update = (field: string, value: string) => setValues(current => ({ ...current, [field]: value }))
  return <div className={styles.page}><div className={styles.intro}><p>Órdenes, proveedores y recepción de mercadería</p><button onClick={() => setCreating(true)}>+ Nueva compra</button></div><DataState result={result}><Stats items={[{ label: 'Compras del mes', value: money(s.month_amount) }, { label: 'Órdenes registradas', value: s.total_count }, { label: 'Monto invertido', value: money(s.invested_amount), hint: Number(s.unknown_total_count) > 0 ? `${s.unknown_total_count} importes históricos no registrados` : undefined }, { label: 'Proveedores activos', value: s.active_suppliers }]} /></DataState>
    <Panel><form className={styles.filters} onSubmit={event => { event.preventDefault(); setFilters(query(values)); setPage(1) }}><TextField label="Buscar compra" value={values.q ?? ''} maxLength={100} onChange={e => update('q', e.target.value)} /><SelectField label="Proveedor" value={values.supplier_id ?? ''} onChange={e => update('supplier_id', e.target.value)}><option value="">Todos</option>{suppliers?.data?.items.map(row => <option key={row.supplier_id} value={row.supplier_id}>{row.company_name}</option>)}</SelectField><TextField label="Desde" type="date" value={values.start_date ?? ''} onChange={e => update('start_date', e.target.value)} /><TextField label="Hasta" type="date" min={values.start_date} value={values.end_date ?? ''} onChange={e => update('end_date', e.target.value)} /><SelectField label="Estado" value={values.status ?? ''} onChange={e => update('status', e.target.value)}><option value="">Todos</option><option value="registered">Pendiente</option><option value="received">Recibida</option><option value="legacy">Histórica</option></SelectField><div className={styles.actions}><button>Buscar</button><button className="secondary" type="button" onClick={() => { setValues({}); setFilters(''); setPage(1) }}>Limpiar</button></div></form></Panel>
    <Panel title="Listado de compras"><DataState result={result} empty={!rows.length}><Table label="Compras"><thead><tr><th>Número</th><th>Fecha</th><th>Proveedor</th><th>Productos</th><th>Cantidad</th><th>Envío</th><th>Monto</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{rows.map(row => <tr key={row.purchase_id}><td>#{row.purchase_id}</td><td>{dateText(row.purchase_date)}</td><td>{row.supplier_name}</td><td>{row.products ?? 'Sin detalle'}</td><td>{row.units ?? '—'}</td><td>{money(row.shipping_cost)}</td><td>{money(row.total)}</td><td><Badge status={row.status} /></td><td><button className="secondary" onClick={() => setDetail(row.purchase_id)}>{row.status === 'registered' ? 'Ver / recibir' : 'Ver'}</button></td></tr>)}</tbody></Table></DataState><Pager page={page} total={Number(s.total_count ?? 0)} onChange={setPage} /></Panel>
    {creating && <PurchaseForm date={result?.data?.context.business_date ?? ''} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setRevision(value => value + 1) }} />}
    {detail && <PurchaseDetail id={detail} onClose={() => setDetail(null)} onSaved={() => setRevision(value => value + 1)} />}
  </div>
}
