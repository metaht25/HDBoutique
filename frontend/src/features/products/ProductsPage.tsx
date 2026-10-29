import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { ModuleAccess } from '../session/ModuleAccess'
import { useSession } from '../session/sessionContext'
import { getErrorMessage } from '../../shared/api/errors'
import { exactMoney, displayMoney, inputId, serverFields } from '../../shared/forms/fields'
import type { FieldErrors } from '../../shared/forms/fields'
import { useResource } from '../../shared/hooks/useResource'
import { LoadingState, Message } from '../../shared/ui/Feedback'
import { PageNavigation } from '../../shared/ui/PageNavigation'
import { SelectField } from '../../shared/ui/SelectField'
import { TableContainer } from '../../shared/ui/TableContainer'
import { TextField } from '../../shared/ui/TextField'
import styles from '../../shared/ui/Management.module.css'
import { listProducts, productOptions, saveProduct } from './api'
import type { Category, Product, Size } from './api'

function stockLabel(value: number | null): string {
  return value === null ? 'Sin conteo' : value < 0 ? `Revisar conteo (${value})` : String(value)
}

function ProductForm({ product, categories, sizes, onSaved, onCancel }: {
  product: Product | null; categories: Category[]; sizes: Size[]
  onSaved: (product: Product) => void; onCancel: () => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product?.unit_price ?? '')
  const [category, setCategory] = useState(String(product?.category_id ?? ''))
  const [size, setSize] = useState(String(product?.size_id ?? ''))
  const [fields, setFields] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const errors: FieldErrors = {}
    const categoryId = inputId(category), sizeId = inputId(size)
    const unitPrice = price.trim() ? exactMoney(price) : null
    if (name.trim().length > 40) errors.name = 'Máximo 40 caracteres.'
    if (!categoryId) errors.category_id = 'Selecciona una categoría.'
    if (!sizeId) errors.size_id = 'Selecciona una talla.'
    if (price.trim() && unitPrice === null) errors.unit_price = 'Usa hasta ocho enteros y dos decimales, sin redondear.'
    setFields(errors)
    setError('')
    if (Object.keys(errors).length || categoryId === null || sizeId === null) return
    submitting.current = true
    setBusy(true)
    try {
      const saved = await saveProduct({ name: name.trim() || null, unit_price: unitPrice,
        category_id: categoryId, size_id: sizeId }, product?.product_id)
      onSaved(saved)
      if (!product) { setName(''); setPrice(''); setCategory(''); setSize('') }
    } catch (error) {
      setError(getErrorMessage(error, 'No se pudo guardar el producto.'))
      setFields(serverFields(error))
    } finally { submitting.current = false; setBusy(false) }
  }
  return <section className={styles.panel}><h3>{product ? `Editar producto #${product.product_id}` : 'Nuevo producto'}</h3>
    <form className={styles.form} noValidate onSubmit={event => void submit(event)}>
      <div className={styles.grid}>
        <TextField label="Nombre" name="name" value={name} maxLength={40} disabled={busy} autoFocus={!!product}
          onChange={event => setName(event.target.value)} error={fields.name} />
        <TextField label="Precio unitario (NIO)" name="unit_price" value={price} inputMode="decimal" disabled={busy}
          onChange={event => setPrice(event.target.value)} error={fields.unit_price} />
        <SelectField label="Categoría" value={category} disabled={busy} error={fields.category_id}
          onChange={event => setCategory(event.target.value)}>
          <option value="">Selecciona una categoría</option>
          {categories.map(row => <option key={row.category_id} value={row.category_id}>{row.name ?? `Categoría #${row.category_id}`}</option>)}
        </SelectField>
        <SelectField label="Talla" value={size} disabled={busy} error={fields.size_id} onChange={event => setSize(event.target.value)}>
          <option value="">Selecciona una talla</option>
          {sizes.map(row => <option key={row.size_id} value={row.size_id}>{row.name}</option>)}
        </SelectField>
      </div>
      <p className={styles.readOnly}>{product
        ? `Disponible: ${stockLabel(product.legacy_stock)}. Cifra histórica: ${product.legacy_stock_quantity ?? 'Sin registro'}.`
        : 'El producto nuevo inicia con disponible cero. Las existencias se actualizan con los movimientos de inventario.'}</p>
      {error && <Message>{error}</Message>}
      <div className={styles.actions}><button disabled={busy} type="submit">
        {busy ? 'Guardando…' : product ? 'Actualizar producto' : 'Guardar producto'}</button>
        {product && <button disabled={busy} type="button" onClick={onCancel}>Cancelar edición</button>}
      </div>
    </form>
  </section>
}

function ProductWorkspace() {
  const { state } = useSession()
  const canWrite = state.status === 'authenticated' && state.account.role !== 'Cashier'
  const [params, setParams] = useSearchParams()
  const page = inputId(params.get('page') ?? '1') ?? 1
  const query = (params.get('q') ?? '').trim().slice(0, 100)
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<Product | null>(null)
  const [notice, setNotice] = useState('')
  const load = useCallback((signal: AbortSignal) => listProducts(page, query, signal), [page, query])
  const result = useResource(`${page}:${query}:${revision}`, load)
  const options = useResource(`product-options:${revision}`, productOptions)
  function navigate(nextPage: number, nextQuery = query) {
    setParams({ ...(nextQuery ? { q: nextQuery } : {}), page: String(nextPage) })
  }
  const rows = result?.data?.slice(0, 20) ?? []
  return <div className={styles.page}>
    <div className={styles.header}><div><h2>Productos e inventario</h2>
      <p>Consulta las existencias disponibles y los datos del catálogo.</p></div>
      <button type="button" onClick={() => setRevision(value => value + 1)}>Recargar productos</button>
    </div>
    {notice && <Message variant="success">{notice}</Message>}
    {options?.error !== undefined && <Message>{getErrorMessage(options.error, 'No se pudieron cargar categorías y tallas.')}</Message>}
    {canWrite && options?.data && <ProductForm key={editing?.product_id ?? 'new'} product={editing}
      categories={options.data.categories} sizes={options.data.sizes} onCancel={() => setEditing(null)}
      onSaved={product => { setNotice(`Producto #${product.product_id} guardado correctamente.`); setEditing(null); setRevision(value => value + 1) }} />}
    <form className={styles.search} key={query} onSubmit={event => {
      event.preventDefault()
      navigate(1, String(new FormData(event.currentTarget).get('query') ?? '').trim())
    }}><TextField label="Buscar producto" name="query" type="search" maxLength={100} defaultValue={query} />
      <button type="submit">Buscar</button>
    </form>
    {!result ? <LoadingState>Cargando productos…</LoadingState> : result.error !== undefined
      ? <Message>{getErrorMessage(result.error, 'No se pudieron cargar los productos.')}</Message>
      : rows.length === 0 ? <p className={styles.empty}>No hay productos en esta página.</p>
        : <section className={styles.panel}><TableContainer label="Productos">
          <table><thead><tr><th>ID</th><th>Producto</th><th>Precio unitario</th><th>Disponible</th><th>Cifra histórica</th>
            {canWrite && <th>Acciones</th>}</tr></thead><tbody>
            {rows.map(product => <tr key={product.product_id}><td>{product.product_id}</td>
              <td>{product.name ?? 'Sin nombre'}</td><td>{displayMoney(product.unit_price)}</td>
              <td>{stockLabel(product.legacy_stock)}</td><td>{product.legacy_stock_quantity ?? 'Sin registro'}</td>
              {canWrite && <td><button type="button" onClick={() => { setEditing(product); setNotice('') }}
                aria-label={`Editar producto ${product.product_id}`}>Editar</button></td>}</tr>)}
          </tbody></table></TableContainer></section>}
    <PageNavigation page={page} hasNext={(result?.data?.length ?? 0) > 20} onPageChange={next => navigate(next)} />
  </div>
}
export default function ProductsPage() { return <ModuleAccess><ProductWorkspace /></ModuleAccess> }
