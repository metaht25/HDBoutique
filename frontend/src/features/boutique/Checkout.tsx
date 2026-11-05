import { useState } from 'react'
import type { FormEvent } from 'react'
import { SearchSelect } from './SearchSelect'
import { validPhone } from './phone'
import { useSession } from '../session/sessionContext'
import { useCashCommand } from '../cash-register/useCashCommand'
import { exactMoney } from '../../shared/forms/fields'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { Message } from '../../shared/ui/Feedback'
import { Icon } from '../../shared/ui/Icon'
import { amount, cents, money, query, useQuery } from './api'
import type { Customer, Page, Product, Sale } from './contracts'
import { DataState, Modal, Pager, Panel } from './ui'
import { PartyForm } from './PartyForm'
import { ReceiptModal } from './ReceiptModal'
import styles from './Boutique.module.css'
import checkout from './Checkout.module.css'

interface CartLine { product: Product; quantity: number }
export default function Checkout() {
  const account = useSession().state.account!
  const [customerDraft, setCustomerDraft] = useState<Record<string, unknown> | null>(null)
  const [kind, setKind] = useState('general'), [customer, setCustomer] = useState<Customer | null>(null), [customerQuery, setCustomerQuery] = useState(''), [newCustomer, setNewCustomer] = useState(false)
  const [q, setQ] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0), [cart, setCart] = useState<CartLine[]>([])
  const [method, setMethod] = useState('cash'), [received, setReceived] = useState(''), [split, setSplit] = useState({ field: 'transfer', value: '' }), [reference, setReference] = useState(''), [confirmed, setConfirmed] = useState(false), [delivery, setDelivery] = useState('0.00'), [notes, setNotes] = useState(''), [deliveryDetails, setDeliveryDetails] = useState<Record<string, unknown> | null>(null)
  const [completed, setCompleted] = useState<Sale | null>(null), [receipt, setReceipt] = useState<number | null>(null), [cancel, setCancel] = useState(false)
  const command = useCashCommand<Sale>(account.user_id, 'checkout', sale => { setCompleted(sale); setCustomerDraft(null); setDeliveryDetails(null); setCustomer(current => current ? { ...current, customer_id: sale.customer_id } : null); setCart([]); setReceived(''); setSplit({ field: 'transfer', value: '' }); setReference(''); setConfirmed(false); setNotes(''); setDelivery('0.00'); setRevision(value => value + 1) })
  const products = useQuery<Page<Product>>('reports/product-catalog?' + query({ q: search, status: 'sellable', offset: (page - 1) * 20, limit: 20 }), revision)
  const customers = useQuery<Page<Customer>>('reports/customer-directory?' + query({ q: customerQuery, status: 'active', limit: 20 }), revision)
  const subtotal = cart.reduce((sum, line) => sum + cents(line.product.unit_price) * BigInt(line.quantity), 0n), deliveryCents = kind === 'delivery' ? cents(delivery) : 0n, total = subtotal + deliveryCents
  const splitAmount = cents(split.value), remainder = total >= splitAmount ? total - splitAmount : 0n
  const transfer = split.field === 'transfer' ? split.value : amount(remainder), applied = split.field === 'cash' ? split.value : amount(remainder)
  const transferred = method === 'mixed' ? cents(transfer) : method === 'transfer' ? total : 0n, cash = total - transferred, change = method !== 'transfer' ? cents(received) - cash : 0n
  function add(product: Product) {
    if (command.locked || product.legacy_stock === null || product.legacy_stock <= 0 || !product.unit_price) return
    setCart(current => { const found = current.find(row => row.product.product_id === product.product_id); return found ? current.map(row => row === found ? { product, quantity: Math.min(row.quantity + 1, product.legacy_stock!) } : row) : [...current, { product, quantity: 1 }] })
  }
  function quantity(id: number, delta: number) { setCart(current => current.map(row => row.product.product_id === id ? { ...row, quantity: Math.max(1, Math.min(row.quantity + delta, row.product.legacy_stock ?? 0)) } : row)) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (command.pending) { await command.send('', {}); return }
    if (!cart.length || total <= 0n || (kind !== 'general' && !customer)) { command.setError('Selecciona el cliente y al menos un producto disponible.'); return }
    if (kind === 'delivery' && (!validPhone(customer?.phone_number ?? '') || !customer?.department_id || !customer.municipality_id || !customer.address_line || exactMoney(delivery) === null || deliveryCents < 0n)) { command.setError('Revisa los datos obligatorios del cliente delivery y el costo de entrega.'); return }
    if (exactMoney(received) === null || (method === 'transfer' ? cents(received) !== total : change < 0n) || (method === 'mixed' && (exactMoney(split.value) === null || splitAmount > total || transferred <= 0n || transferred >= total))) { command.setError('Revisa el monto recibido y los componentes del pago. Deben cubrir el total completo.'); return }
    if (method !== 'cash' && !confirmed) { command.setError('Confirma manualmente que la transferencia fue recibida.'); return }
    await command.send('/api/v1/sales', {
      customer_kind: kind, ...(customerDraft && kind !== 'general' ? { customer: { ...customerDraft, kind } } : customer && kind !== 'general' ? { customer_id: customer.customer_id } : {}), ...(kind === 'delivery' && deliveryDetails && !customerDraft ? { delivery_details: deliveryDetails } : {}), delivery_cost: amount(deliveryCents), notes: notes.trim() || null,
      items: cart.map(line => ({ product_id: line.product.product_id, quantity: line.quantity })),
      payment: { method, received_amount: exactMoney(received), ...(method !== 'cash' ? { reference: reference.trim() || null, transfer_confirmed: confirmed } : {}), ...(method === 'mixed' ? { transfer_amount: exactMoney(transfer) } : {}) },
    })
  }
  return <div className={`${styles.page} ${checkout.checkout}`}>
    <div className={checkout.intro}><span className={checkout.introIcon}><Icon name="sales" size={24} /></span><div><h2>Prepara tu venta</h2><p>Elige los productos, revisa el cliente y confirma el pago.</p></div><span className={checkout.currency}>Importes en NIO</span></div>
    <form className={styles.form} onSubmit={event => void submit(event)}><fieldset disabled={command.locked}>
      <div className={checkout.workspace}>
        <div className={checkout.selection}>
          <Panel title="Productos disponibles" action={<span className={checkout.sectionTag}><Icon name="products" size={16} />Catálogo</span>}>
            <div className={checkout.searchRow}><TextField label="Buscar producto" placeholder="Nombre del producto" maxLength={100} value={q} onChange={e => setQ(e.target.value)} /><button type="button" className="secondary" onClick={() => { setSearch(q); setPage(1) }}>Buscar productos</button></div>
            <p className={checkout.help}>Agrega productos disponibles y ajusta las cantidades en el carrito.</p>
            <DataState result={products} empty={!products?.data?.items.length}><div className={checkout.productGrid}>{products?.data?.items.map(product => <article className={checkout.productCard} key={product.product_id}>
              <div className={checkout.productTop}><span className={checkout.productIcon}><Icon name="products" /></span><span className={checkout.stock} data-status={product.status}>Stock: {product.legacy_stock ?? 'Pendiente de conteo'}</span></div>
              <h3>{product.name ?? 'Sin nombre'}</h3><p className={checkout.productMeta}>{product.category_name} <span>·</span> Talla {product.size_name}</p>
              <strong className={checkout.productPrice}>{money(product.unit_price)}</strong>
              <button type="button" className="secondary" disabled={!product.unit_price || product.legacy_stock === null || product.legacy_stock <= 0 || (cart.find(row => row.product.product_id === product.product_id)?.quantity ?? 0) >= product.legacy_stock} onClick={() => add(product)}>+ Agregar</button>
            </article>)}</div></DataState>
            <Pager page={page} total={Number(products?.data?.summary.total_count ?? 0)} onChange={setPage} />
          </Panel>
          <Panel title="Cliente y entrega" action={<span className={checkout.sectionTag}><Icon name="people" size={16} />Cliente</span>}>
            <div className={checkout.customerFields}><div className={styles.formGrid}><SelectField label="Tipo de cliente" value={kind} onChange={e => { setKind(e.target.value) }}><option value="general">Cliente general</option><option value="regular">Cliente</option><option value="delivery">Cliente delivery</option></SelectField><TextField label="Fecha actual" type="date" readOnly value={products?.data?.context.business_date ?? ''} /></div>
              {kind === 'general' ? <div className={checkout.customerNote}><Icon name="people" size={18} /><p><b>Cliente general</b><span>Puedes continuar sin registrar datos de un cliente.</span></p></div> : <>
                <div className={checkout.customerSearch}><SearchSelect label="Seleccionar cliente" value={customer ? String(customer.customer_id) : ''} loading={!customers} onSearch={setCustomerQuery} options={[...(customer && !customers?.data?.items.some(row => row.customer_id === customer.customer_id) ? [customer] : []), ...(customers?.data?.items ?? [])].map(row => ({ id: row.customer_id, label: `${row.first_names} ${row.last_names}`, description: `Cliente #${row.customer_id} · ${row.phone_number ?? 'Sin teléfono'}` }))} onChange={value => { setCustomerDraft(null); setDeliveryDetails(null); setCustomer(customers?.data?.items.find(row => row.customer_id === Number(value)) ?? null) }} /><button type="button" className="secondary" onClick={() => { setCustomer(null); setCustomerDraft(null); setDeliveryDetails(null); setNewCustomer(true) }}>+ Registrar cliente</button></div>
                {customers?.error !== undefined && <Message>No se pudo buscar clientes. Intenta nuevamente.</Message>}
                {customer && <div className={checkout.selectedCustomer}><span className={checkout.customerAvatar}><Icon name="people" size={18} /></span><div><small>CLIENTE SELECCIONADO</small><strong>{customer.first_names} {customer.last_names}</strong></div></div>}
                {kind === 'delivery' && <section className={checkout.delivery} aria-label="Datos de entrega"><div className={checkout.deliveryHeading}><Icon name="suppliers" size={18} /><h3>Entrega a domicilio</h3></div>
                  {customer ? <><dl className={checkout.deliveryDetails}><div><dt>Teléfono</dt><dd>{customer.phone_number ?? 'Sin teléfono'}</dd></div><div><dt>Ubicación</dt><dd>{customer.department_name ?? 'Sin departamento'}, {customer.municipality_name ?? 'Sin municipio'}</dd></div><div><dt>Dirección</dt><dd>{customer.address_line ?? 'Sin dirección registrada'}</dd></div></dl><button type="button" className="secondary" onClick={() => setNewCustomer(true)}>Completar datos de entrega</button></> : <p className={checkout.help}>Selecciona o registra un cliente para completar su teléfono y dirección.</p>}
                  <div className={checkout.deliveryCost}><TextField label="Costo del delivery (NIO)" inputMode="decimal" value={delivery} onChange={e => setDelivery(e.target.value)} /><p className={checkout.help}>El costo de entrega se incluye en el total de esta venta.</p></div>
                </section>}
              </>}
            </div>
          </Panel>
        </div>
        <div className={checkout.review}>
          <Panel title="Carrito de venta" action={<button type="button" className={`secondary ${checkout.clearCart}`} disabled={!cart.length} onClick={() => setCancel(true)}>Vaciar carrito</button>}>
            {cart.length ? <ul className={checkout.cart} aria-label="Carrito">{cart.map(line => <li className={checkout.cartLine} key={line.product.product_id}>
              <div className={checkout.lineHeading}><div><strong>{line.product.name}</strong><span>Talla {line.product.size_name} · {money(line.product.unit_price)} por unidad</span></div><button type="button" className={`secondary ${checkout.remove}`} aria-label={`Quitar ${line.product.name}`} onClick={() => setCart(current => current.filter(row => row !== line))}>Quitar</button></div>
              <div className={checkout.lineAmounts}><div className={checkout.quantity} role="group" aria-label={`Cantidad de ${line.product.name}`}><button type="button" className="secondary" aria-label={`Disminuir ${line.product.name}`} disabled={line.quantity <= 1} onClick={() => quantity(line.product.product_id, -1)}>−</button><span>{line.quantity}</span><button type="button" className="secondary" aria-label={`Aumentar ${line.product.name}`} disabled={line.quantity >= (line.product.legacy_stock ?? 0)} onClick={() => quantity(line.product.product_id, 1)}>+</button></div><div className={checkout.lineSubtotal}><small>Subtotal</small><b>{money(amount(cents(line.product.unit_price) * BigInt(line.quantity)))}</b></div></div>
            </li>)}</ul> : <div className={checkout.emptyCart}><span><Icon name="sales" size={28} /></span><h3>Tu carrito está vacío</h3><p>Agrega productos para comenzar la venta.</p></div>}
            <div className={checkout.totals} aria-label="Resumen de venta"><p><span>Productos ({cart.reduce((sum, row) => sum + row.quantity, 0)})</span><b>{money(amount(subtotal))}</b></p>{kind === 'delivery' && <p><span>Delivery</span><b>{money(amount(deliveryCents))}</b></p>}<p className={checkout.total}><span>Total</span><strong>{money(amount(total))}</strong></p></div>
          </Panel>
          <Panel title="Pago de la venta" action={<span className={checkout.sectionTag}><Icon name="wallet" size={16} />Pago completo</span>}>
            <div className={checkout.paymentFields}>
              <SelectField label="Método de pago" value={method} onChange={e => { setMethod(e.target.value); setReceived(''); setSplit({ field: 'transfer', value: '' }); setReference(''); setConfirmed(false) }}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="mixed">Mixto</option></SelectField>
              <p className={checkout.methodHelp}><Icon name={method === 'cash' ? 'wallet' : method === 'transfer' ? 'receipt' : 'chart'} size={17} />{method === 'cash' ? 'Registra el efectivo recibido para consultar el cambio.' : method === 'transfer' ? 'Ingresa el monto exacto y confirma la transferencia.' : 'Distribuye el total entre efectivo y transferencia.'}</p>
              {method === 'mixed' && <div className={checkout.splitFields}><TextField label="Monto transferido (NIO)" inputMode="decimal" value={transfer} onChange={e => setSplit({ field: 'transfer', value: e.target.value })} /><TextField label="Efectivo a aplicar (NIO)" inputMode="decimal" value={applied} onChange={e => setSplit({ field: 'cash', value: e.target.value })} /></div>}
              <TextField label={method === 'transfer' ? 'Monto exacto transferido (NIO)' : 'Efectivo recibido (NIO)'} inputMode="decimal" value={received} onChange={e => setReceived(e.target.value)} />
              {method !== 'cash' && <><TextField label="Referencia de transferencia (opcional)" maxLength={100} value={reference} onChange={e => setReference(e.target.value)} /><label className={checkout.transferConfirmation}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confirmo que la transferencia fue recibida</label></>}
              <div className={checkout.paymentBreakdown}><p><span>Efectivo aplicado</span><b>{money(amount(cash))}</b></p><p><span>Transferencia</span><b>{money(amount(transferred))}</b></p></div>
              {method !== 'transfer' && <p className={checkout.change} data-sufficient={change >= 0n} aria-live="polite">Cambio: <b>{change >= 0n ? money(amount(change)) : 'Pago insuficiente'}</b></p>}
              <div className={checkout.notes}><TextField label="Notas (opcional)" maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
          </Panel>
        </div>
      </div>
    </fieldset>
    <div className={checkout.feedback}>
      {command.pending && <Message variant="info"><div className={checkout.messageContent}><Icon name="history" /><div><strong>Venta pendiente de confirmación</strong><p>La venta está pendiente de confirmación. Reintenta la misma solicitud; se conserva al recargar para evitar duplicados.</p></div></div></Message>}
      {command.error && <Message><div className={checkout.messageContent}><Icon name="alert" /><div><strong>Revisa la venta</strong><p>{command.error}</p></div></div></Message>}
    </div>
    <div className={checkout.submitBar}><div><Icon name="receipt" /><p>Revisa los datos antes de confirmar.<small>La venta se registra con su pago completo.</small></p></div><div className={checkout.submitActions}><button type="button" className="secondary" disabled={command.locked} onClick={() => setCancel(true)}>Cancelar venta</button><button type="submit" disabled={command.busy || command.blocked || (!command.pending && !cart.length)}>{command.busy ? 'Confirmando venta…' : command.pending ? 'Reintentar misma venta' : 'Finalizar venta'}<Icon name="arrow" size={18} /></button></div></div>
    </form>
    {newCustomer && <PartyForm kind="customers" row={customer?.customer_id ? customer : undefined} initialKind={kind} onDraft={(body, display) => { if (customer?.customer_id) { setDeliveryDetails({ phone_number: body.phone_number, address: body.address }); setCustomer({ ...customer, phone_number: String(body.phone_number), department_id: Number(display.department_id), municipality_id: Number(display.municipality_id), department_name: display.department_name ?? null, municipality_name: display.municipality_name ?? null, address_line: display.address_line ?? null }); setNewCustomer(false); return } setCustomerDraft(body); setKind(String(body.kind ?? kind)); setCustomer({ customer_id: 0, first_names: display.first_names ?? '', last_names: display.last_names ?? '', phone_number: display.phone_number ?? null, kind: String(body.kind ?? kind), is_active: true, created_at: null, address_id: null, department_id: Number(display.department_id) || null, municipality_id: Number(display.municipality_id) || null, address_line: display.address_line ?? null, department_name: display.department_name ?? null, municipality_name: display.municipality_name ?? null }); setNewCustomer(false) }} onClose={() => setNewCustomer(false)} onSaved={row => { setCustomer(row as Customer); setNewCustomer(false); setRevision(value => value + 1) }} />}
    {cancel && <Modal title="Vaciar venta" onClose={() => setCancel(false)}><p>Se quitarán los productos del carrito. No se ha registrado ninguna venta.</p><div className={styles.actions}><button className="secondary" onClick={() => setCancel(false)}>Conservar venta</button><button onClick={() => { setCart([]); setCancel(false) }}>Vaciar carrito</button></div></Modal>}
    {completed && <Modal title="¡Venta completada!" onClose={() => setCompleted(null)}><p>Venta V-{String(completed.sale_id).padStart(5, '0')} registrada correctamente.</p><p className={styles.total}>{money(completed.total)}</p><p>Cambio: {money(completed.payment?.change_amount)}</p><div className={styles.actions}><button className="secondary" onClick={() => setReceipt(completed.sale_id)}>Ver recibo / imprimir</button><button onClick={() => setCompleted(null)}>Cerrar</button></div></Modal>}
    {receipt && <ReceiptModal saleId={receipt} onClose={() => setReceipt(null)} />}
  </div>
}
