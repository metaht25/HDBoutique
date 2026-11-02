import { useState } from 'react'
import type { FormEvent } from 'react'
import { EmployeeSelect } from '../employees/EmployeeSelect'
import { useSession } from '../session/sessionContext'
import { useCashCommand } from '../cash-register/useCashCommand'
import { exactMoney } from '../../shared/forms/fields'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { Message } from '../../shared/ui/Feedback'
import { amount, cents, money, query, useQuery } from './api'
import type { Customer, Page, Product, Sale } from './contracts'
import { DataState, Modal, Pager, Panel, Table } from './ui'
import { PartyForm } from './PartyForm'
import { ReceiptModal } from './ReceiptModal'
import styles from './Boutique.module.css'

interface CartLine { product: Product; quantity: number }
export default function Checkout() {
  const account = useSession().state.account!
  const [customerDraft, setCustomerDraft] = useState<Record<string, unknown> | null>(null)
  const [kind, setKind] = useState('general'), [customer, setCustomer] = useState<Customer | null>(null), [customerQuery, setCustomerQuery] = useState(''), [newCustomer, setNewCustomer] = useState(false)
  const [q, setQ] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0), [cart, setCart] = useState<CartLine[]>([])
  const [method, setMethod] = useState('cash'), [received, setReceived] = useState(''), [transfer, setTransfer] = useState(''), [reference, setReference] = useState(''), [confirmed, setConfirmed] = useState(false), [delivery, setDelivery] = useState('0.00'), [notes, setNotes] = useState(''), [employee, setEmployee] = useState(String(account.employee_id ?? ''))
  const [completed, setCompleted] = useState<Sale | null>(null), [receipt, setReceipt] = useState<number | null>(null), [cancel, setCancel] = useState(false)
  const command = useCashCommand<Sale>(account.user_id, 'checkout', sale => { setCompleted(sale); setCustomerDraft(null); setCustomer(current => current ? { ...current, customer_id: sale.customer_id } : null); setCart([]); setReceived(''); setTransfer(''); setReference(''); setConfirmed(false); setNotes(''); setDelivery('0.00'); setRevision(value => value + 1) })
  const products = useQuery<Page<Product>>('reports/product-catalog?' + query({ q: search, status: 'active', offset: (page - 1) * 20, limit: 20 }), revision)
  const customers = useQuery<Page<Customer>>('reports/customer-directory?' + query({ q: customerQuery, status: 'active', limit: 100 }), revision)
  const subtotal = cart.reduce((sum, line) => sum + cents(line.product.unit_price) * BigInt(line.quantity), 0n), deliveryCents = kind === 'delivery' ? cents(delivery) : 0n, total = subtotal + deliveryCents
  const transferred = method === 'mixed' ? cents(transfer) : method === 'transfer' ? total : 0n, cash = total - transferred, change = method !== 'transfer' ? cents(received) - cash : 0n
  function add(product: Product) {
    if (command.locked || product.legacy_stock === null || product.legacy_stock <= 0 || !product.unit_price) return
    setCart(current => { const found = current.find(row => row.product.product_id === product.product_id); return found ? current.map(row => row === found ? { product, quantity: Math.min(row.quantity + 1, product.legacy_stock!) } : row) : [...current, { product, quantity: 1 }] })
  }
  function quantity(id: number, delta: number) { setCart(current => current.map(row => row.product.product_id === id ? { ...row, quantity: Math.max(1, Math.min(row.quantity + delta, row.product.legacy_stock ?? 0)) } : row)) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (command.pending) { await command.send('', {}); return }
    if (!employee || !cart.length || total <= 0n || (kind !== 'general' && !customer)) { command.setError('Selecciona el responsable, cliente y al menos un producto disponible.'); return }
    if (kind === 'delivery' && (!customer?.phone_number || !customer.municipality_id || !customer.address_line || exactMoney(delivery) === null || deliveryCents < 0n)) { command.setError('Revisa los datos obligatorios del cliente delivery y el costo de entrega.'); return }
    if (exactMoney(received) === null || (method === 'transfer' ? cents(received) !== total : change < 0n) || (method === 'mixed' && (exactMoney(transfer) === null || transferred <= 0n || transferred >= total))) { command.setError('Revisa el monto recibido y los componentes del pago. Deben cubrir el total completo.'); return }
    if (method !== 'cash' && (!reference.trim() || !confirmed)) { command.setError('Escribe la referencia y confirma manualmente la transferencia.'); return }
    await command.send('/api/v1/sales', {
      customer_kind: kind, ...(customerDraft ? { customer: customerDraft } : customer && kind !== 'general' ? { customer_id: customer.customer_id } : {}), employee_id: Number(employee), delivery_cost: amount(deliveryCents), notes: notes.trim() || null,
      items: cart.map(line => ({ product_id: line.product.product_id, quantity: line.quantity })),
      payment: { method, received_amount: exactMoney(received), ...(method !== 'cash' ? { reference: reference.trim(), transfer_confirmed: confirmed } : {}), ...(method === 'mixed' ? { transfer_amount: exactMoney(transfer) } : {}) },
    })
  }
  return <div className={styles.page}>
    <form className={styles.form} onSubmit={event => void submit(event)}><fieldset disabled={command.locked}>
      <Panel><div className={styles.filters}><SelectField label="Tipo de cliente" value={kind} onChange={e => { setKind(e.target.value); setCustomer(null); setCustomerDraft(null) }}><option value="general">Cliente general</option><option value="regular">Cliente</option><option value="delivery">Cliente delivery</option></SelectField>
        <TextField label="Fecha actual" type="date" readOnly value={products?.data?.context.business_date ?? ''} />
        <SelectField label="Método de pago" value={method} onChange={e => { setMethod(e.target.value); setReceived(''); setTransfer(''); setReference(''); setConfirmed(false) }}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="mixed">Mixto</option></SelectField>
        <EmployeeSelect label="Responsable de venta" value={employee} disabled={account.employee_id !== null || command.locked} onChange={setEmployee} />
      </div>
      {kind !== 'general' && <div className={styles.form}><div className={styles.filters}><TextField label="Buscar cliente" maxLength={100} value={customerQuery} onChange={e => setCustomerQuery(e.target.value)} /><SelectField label="Seleccionar cliente" value={customer?.customer_id ?? ''} onChange={e => { setCustomerDraft(null); setCustomer(customers?.data?.items.find(row => row.customer_id === Number(e.target.value)) ?? null) }}><option value="">Selecciona</option>{customer && !customers?.data?.items.some(row => row.customer_id === customer.customer_id) && <option value={customer.customer_id}>{customer.first_names} {customer.last_names}</option>}{customers?.data?.items.filter(row => kind !== 'delivery' || row.kind === 'delivery').map(row => <option key={row.customer_id} value={row.customer_id}>{row.first_names} {row.last_names} · {row.phone_number ?? 'Sin teléfono'}</option>)}</SelectField><button type="button" className="secondary" onClick={() => setNewCustomer(true)}>+ Registrar cliente</button></div>
        {customer && <p className={styles.hint}>{customer.first_names} {customer.last_names} · {customer.phone_number ?? 'Sin teléfono'} · {customer.department_name ?? 'Sin departamento'}, {customer.municipality_name ?? 'Sin municipio'} · {customer.address_line ?? 'Sin dirección registrada'}</p>}
        {kind === 'delivery' && <TextField label="Costo del delivery (NIO)" inputMode="decimal" value={delivery} onChange={e => setDelivery(e.target.value)} />}</div>}
      </Panel>
      <div className={styles.equalColumns}>
        <Panel title="Productos disponibles"><div className={styles.filters}><TextField label="Buscar producto" placeholder="Nombre del producto" maxLength={100} value={q} onChange={e => setQ(e.target.value)} /><button type="button" className="secondary" onClick={() => { setSearch(q); setPage(1) }}>Buscar productos</button></div>
          <DataState result={products} empty={!products?.data?.items.length}><div className={styles.productGrid}>{products?.data?.items.map(product => <article className={styles.productCard} key={product.product_id}><h3>{product.name ?? 'Sin nombre'}</h3><p className={styles.hint}>{product.category_name} · Talla {product.size_name}</p><p><b>{money(product.unit_price)}</b></p><p>Stock: {product.legacy_stock ?? 'Pendiente de conteo'}</p><button type="button" className="secondary" disabled={!product.unit_price || product.legacy_stock === null || product.legacy_stock <= 0 || (cart.find(row => row.product.product_id === product.product_id)?.quantity ?? 0) >= product.legacy_stock} onClick={() => add(product)}>+ Agregar</button></article>)}</div></DataState>
          <Pager page={page} total={Number(products?.data?.summary.total_count ?? 0)} onChange={setPage} />
        </Panel>
        <Panel title="Carrito de venta" action={<button type="button" className="secondary" disabled={!cart.length} onClick={() => setCancel(true)}>Vaciar carrito</button>}>
          {cart.length ? <Table label="Carrito"><thead><tr><th>Producto / talla</th><th>Precio</th><th>Cantidad</th><th>Subtotal</th><th>Acción</th></tr></thead><tbody>{cart.map(line => <tr key={line.product.product_id}><td>{line.product.name}<small> · {line.product.size_name}</small></td><td>{money(line.product.unit_price)}</td><td><div className={styles.quantity}><button type="button" className="secondary" aria-label={`Disminuir ${line.product.name}`} disabled={line.quantity <= 1} onClick={() => quantity(line.product.product_id, -1)}>−</button><span>{line.quantity}</span><button type="button" className="secondary" aria-label={`Aumentar ${line.product.name}`} disabled={line.quantity >= (line.product.legacy_stock ?? 0)} onClick={() => quantity(line.product.product_id, 1)}>+</button></div></td><td>{money(amount(cents(line.product.unit_price) * BigInt(line.quantity)))}</td><td><button type="button" className="secondary" aria-label={`Quitar ${line.product.name}`} onClick={() => setCart(current => current.filter(row => row !== line))}>Quitar</button></td></tr>)}</tbody></Table> : <p className={styles.empty}>Agrega productos para comenzar la venta.</p>}
          <div className={styles.form}>
            <div className={styles.summary}><p><span>Productos ({cart.reduce((sum, row) => sum + row.quantity, 0)})</span><b>{money(amount(subtotal))}</b></p>{kind === 'delivery' && <p><span>Delivery</span><b>{money(amount(deliveryCents))}</b></p>}<p className={styles.total}><span>Total</span><span>{money(amount(total))}</span></p></div>
            {method === 'mixed' && <><TextField label="Monto transferido (NIO)" inputMode="decimal" value={transfer} onChange={e => setTransfer(e.target.value)} /><p>Efectivo a aplicar: <b>{money(amount(cash))}</b></p></>}
            <TextField label={method === 'transfer' ? 'Monto exacto transferido (NIO)' : 'Efectivo recibido (NIO)'} inputMode="decimal" value={received} onChange={e => setReceived(e.target.value)} />
            {method !== 'cash' && <><TextField label="Referencia de transferencia" maxLength={100} value={reference} onChange={e => setReference(e.target.value)} /><label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confirmo que la transferencia fue recibida</label></>}
            {method !== 'transfer' && <p>Cambio: <b>{change >= 0n ? money(amount(change)) : 'Pago insuficiente'}</b></p>}
            <TextField label="Notas (opcional)" maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </Panel>
      </div>
    </fieldset>
    {command.pending && <Message variant="info">La venta está pendiente de confirmación. Reintenta la misma solicitud; se conserva al recargar para evitar duplicados.</Message>}
    {command.error && <Message>{command.error}</Message>}
    <div className={styles.actions}><button type="button" className="secondary" disabled={command.locked} onClick={() => setCancel(true)}>Cancelar venta</button><button type="submit" disabled={command.busy || command.blocked || (!command.pending && !cart.length)}>{command.busy ? 'Confirmando venta…' : command.pending ? 'Reintentar misma venta' : 'Finalizar venta'}</button></div>
    </form>
    {newCustomer && <PartyForm kind="customers" initialKind={kind} onDraft={(body, display) => { setCustomerDraft(body); setKind(String(body.kind ?? kind)); setCustomer({ customer_id: 0, first_names: display.first_names ?? '', last_names: display.last_names ?? '', phone_number: display.phone_number ?? null, kind: String(body.kind ?? kind), is_active: true, created_at: null, address_id: null, department_id: Number(display.department_id) || null, municipality_id: Number(display.municipality_id) || null, address_line: display.address_line ?? null, department_name: display.department_name ?? null, municipality_name: display.municipality_name ?? null }); setNewCustomer(false) }} onClose={() => setNewCustomer(false)} onSaved={row => { setCustomer(row as Customer); setNewCustomer(false); setRevision(value => value + 1) }} />}
    {cancel && <Modal title="Vaciar venta" onClose={() => setCancel(false)}><p>Se quitarán los productos del carrito. No se ha registrado ninguna venta.</p><div className={styles.actions}><button className="secondary" onClick={() => setCancel(false)}>Conservar venta</button><button onClick={() => { setCart([]); setCancel(false) }}>Vaciar carrito</button></div></Modal>}
    {completed && <Modal title="¡Venta completada!" onClose={() => setCompleted(null)}><p>Venta V-{String(completed.sale_id).padStart(5, '0')} registrada correctamente.</p><p className={styles.total}>{money(completed.total)}</p><p>Cambio: {money(completed.payment?.change_amount)}</p><div className={styles.actions}><button className="secondary" onClick={() => setReceipt(completed.sale_id)}>Ver recibo / imprimir</button><button onClick={() => setCompleted(null)}>Cerrar</button></div></Modal>}
    {receipt && <ReceiptModal saleId={receipt} onClose={() => setReceipt(null)} />}
  </div>
}
