import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { getErrorMessage } from '../../shared/api/errors'
import { exactMoney, inputId, serverFields } from '../../shared/forms/fields'
import type { FieldErrors } from '../../shared/forms/fields'
import { useResource } from '../../shared/hooks/useResource'
import { LoadingState, Message } from '../../shared/ui/Feedback'
import { TextField } from '../../shared/ui/TextField'
import { SelectField } from '../../shared/ui/SelectField'
import { TableContainer } from '../../shared/ui/TableContainer'
import { PageNavigation } from '../../shared/ui/PageNavigation'
import styles from '../../shared/ui/Management.module.css'
import { catalogs, catalogChoices, listCatalog, saveCatalog } from './api'
import type { Catalog, CatalogRow, Choice } from './api'

const relationLabels: Record<string, string> = { department_id: 'Departamento', product_id: 'Producto', supplier_id: 'Proveedor', supplier_product_id: 'Producto y costo de compra' }

function CatalogForm({ kind, row, choices, onSaved, onCancel }: {
  kind: Catalog; row: CatalogRow | null; choices: Record<string, Choice[]>; onSaved: (row: CatalogRow) => void; onCancel: () => void
}) {
  const config = catalogs[kind]
  const [text, setText] = useState(row?.text ?? '')
  const [references, setReferences] = useState<Record<string, string>>(() => Object.fromEntries(Object.keys(choices).map(field => [field, String(row?.[field as keyof CatalogRow] ?? '')])))
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [fields, setFields] = useState<FieldErrors>({})
  const submitting = useRef(false)
  const missing = Object.values(choices).some(values => values.length === 0)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    const body: Record<string, unknown> = {}, errors: FieldErrors = {}
    if (config.field) {
      if ((config.required && !text.trim()) || text.trim().length > config.max) errors[config.field] = `Revisa este campo (máximo ${config.max} caracteres).`
      if (kind === 'supplier-products') {
        const price = exactMoney(text)
        if (price === null || price.startsWith('-') || price === '0.00') errors.purchase_price = 'Indica un costo positivo con hasta dos decimales.'
        body.purchase_price = price
      } else body[config.field] = text.trim() || null
    }
    for (const [field, values] of Object.entries(choices)) {
      const id = inputId(references[field] ?? '')
      if (id === null || !values.some(option => option.id === id)) errors[field] = 'Selecciona un registro existente.'
      body[field] = id
    }
    setFields(errors); setError('')
    if (Object.keys(errors).length || missing) return
    submitting.current = true; setBusy(true)
    try { onSaved(await saveCatalog(kind, body, row?.id)) }
    catch (error) { setError(getErrorMessage(error, 'No se pudo guardar el registro.')); setFields(serverFields(error)) }
    finally { submitting.current = false; setBusy(false) }
  }
  return <section className={styles.panel}><h3>{row ? `Editar registro #${row.id}` : 'Nuevo registro'}</h3>
    <form className={styles.form} noValidate onSubmit={event => void submit(event)}><div className={styles.grid}>
      {Object.entries(choices).map(([field, values]) => <SelectField key={field} label={relationLabels[field] ?? field} value={references[field] ?? ''} disabled={busy || (!!row && kind === 'supplier-products')} error={fields[field]} onChange={event => setReferences({ ...references, [field]: event.target.value })}>
        <option value="">Selecciona</option>{values.map(value => <option key={value.id} value={value.id}>{value.label} (#{value.id})</option>)}
      </SelectField>)}
      {config.field && <TextField label={config.fieldLabel} value={text} maxLength={config.max} required={config.required} disabled={busy} inputMode={kind === 'supplier-products' ? 'decimal' : 'text'}
        error={fields[config.field]} onChange={event => setText(event.target.value)} />}
    </div>
      {missing && <Message>Faltan las referencias de este formulario. Regístralas en su sección y pulsa Recargar sección.</Message>}
      {!config.required && config.field && <p className={styles.note}>Este dato es opcional. Vaciarlo guarda el valor sin detalle.</p>}
      {kind === 'addresses' && <p className={styles.note}>La dirección se vincula al departamento seleccionado.</p>}
      {kind === 'supplier-products' && <p className={styles.note}>El costo vigente se copia al registrar cada compra; los importes históricos se conservan. El producto se conserva al editar el costo.</p>}
      {error && <Message>{error}</Message>}
      <div className={styles.actions}><button type="submit" disabled={busy || missing}>{busy ? 'Guardando…' : row ? 'Actualizar registro' : 'Guardar registro'}</button>
        {row && <button type="button" disabled={busy} onClick={onCancel}>Cancelar edición</button>}</div>
    </form>
  </section>
}

export function CatalogPanel({ kind }: { kind: Catalog }) {
  const [page, setPage] = useState(1), [revision, setRevision] = useState(0), [editing, setEditing] = useState<CatalogRow | null>(null), [notice, setNotice] = useState('')
  const load = useCallback((signal: AbortSignal) => listCatalog(kind, page, signal), [kind, page])
  const loadChoices = useCallback((signal: AbortSignal) => catalogChoices(kind, signal), [kind])
  const result = useResource(`${kind}:${page}:${revision}`, load), choices = useResource(`${kind}:choices:${revision}`, loadChoices)
  const rows = result?.data?.slice(0, 20) ?? []
  function label(field: string, id: number | undefined) { return choices?.data?.[field]?.find(option => option.id === id)?.label ?? `#${id}` }
  return <div className={styles.page}>
    <div className={styles.header}><h2>{catalogs[kind].label}</h2><button type="button" onClick={() => setRevision(value => value + 1)}>Recargar sección</button></div>
    {notice && <Message variant="success">{notice}</Message>}
    {!choices ? <LoadingState>Cargando opciones…</LoadingState> : choices.error !== undefined ? <Message>{getErrorMessage(choices.error, 'No se pudieron cargar opciones.')}</Message>
      : choices.data && <CatalogForm key={`${editing?.id ?? 'new'}:${revision}`} kind={kind} row={editing} choices={choices.data} onCancel={() => setEditing(null)} onSaved={row => {
        setNotice(`Registro #${row.id} guardado correctamente.`); setEditing(null); setRevision(value => value + 1)
      }} />}
    {!result ? <LoadingState>Cargando registros…</LoadingState> : result.error !== undefined ? <Message>{getErrorMessage(result.error, 'No se pudieron cargar los registros.')}</Message>
      : !rows.length ? <p>No hay registros en esta página.</p> : <section className={styles.panel}><TableContainer label={catalogs[kind].label}><table><thead><tr><th>ID</th>
        {Object.keys(choices?.data ?? {}).map(field => <th key={field}>{relationLabels[field]}</th>)}
        {catalogs[kind].field && <th>{catalogs[kind].fieldLabel}</th>}<th>Acciones</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.id}><td>{row.id}</td>{Object.keys(choices?.data ?? {}).map(field => <td key={field}>{label(field, row[field as keyof CatalogRow] as number | undefined)}</td>)}
          {catalogs[kind].field && <td>{row.text ?? 'Sin detalle'}</td>}<td><button type="button" aria-label={`Editar registro ${row.id}`} onClick={() => { setEditing(row); setNotice('') }}>Editar</button></td></tr>)}
      </tbody></table></TableContainer></section>}
    <PageNavigation page={page} hasNext={(result?.data?.length ?? 0) > 20} onPageChange={next => setPage(next)} />
  </div>
}
