import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { getErrorMessage } from '../../shared/api/errors'
import { Message } from '../../shared/ui/Feedback'
import { statusLabels } from './api'
import styles from './Boutique.module.css'

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId(), close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement as HTMLElement | null
    dialog?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  return <dialog ref={ref} className={`${styles.modal} ${wide ? styles.wide : ''}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close.current() }}>
    <header className={styles.modalHeader}><h2 id={titleId}>{title}</h2><button type="button" className="secondary" aria-label="Cerrar ventana" onClick={onClose}>×</button></header>
    <div className={styles.modalBody}>{children}</div>
  </dialog>
}
export function Panel({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) { return <section className={styles.panel}>{(title || action) && <div className={styles.heading}><h2>{title}</h2>{action}</div>}{children}</section> }
export function Stats({ items }: { items: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }[] }) { return <div className={styles.stats}>{items.map(item => <section className={styles.stat} key={item.label}><div className={styles.statHeading}><span>{item.label}</span>{item.icon && <span className={styles.statIcon}>{item.icon}</span>}</div><strong>{item.value}</strong>{item.hint && <small>{item.hint}</small>}</section>)}</div> }
export function Badge({ status }: { status: string | boolean }) { const text = typeof status === 'boolean' ? status ? 'Activo' : 'Inactivo' : statusLabels[status] ?? status; return <span className={styles.badge} data-tone={status === true || ['confirmed', 'received', 'available'].includes(String(status)) ? 'good' : status === false || ['voided', 'out_of_stock', 'invalid'].includes(String(status)) ? 'bad' : 'warning'}>{text}</span> }
export function DataState({ result, empty = false, children }: { result: { error?: unknown } | null; empty?: boolean; children: ReactNode }) {
  if (!result) return <p role="status" className={styles.empty}>Cargando información…</p>
  if (result.error !== undefined) return <Message>{getErrorMessage(result.error, 'No se pudo cargar la información. Intenta recargar.')}</Message>
  if (empty) return <p className={styles.empty}>Todavía no hay registros para estos filtros.</p>
  return children
}
export function Pager({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) { return <nav className={styles.pager} aria-label="Paginación"><span>{total} registros · Página {page} de {Math.max(1, Math.ceil(total / 20))}</span><button type="button" className="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button><button type="button" className="secondary" disabled={page * 20 >= total} onClick={() => onChange(page + 1)}>Siguiente</button></nav> }
export function Table({ label, children }: { label: string; children: ReactNode }) { return <div className={styles.table} role="region" aria-label={label} tabIndex={0}><table>{children}</table></div> }
