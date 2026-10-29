import styles from './Shared.module.css'

export function Pagination({ page, pageCount, onPageChange }: {
  page: number; pageCount: number; onPageChange: (page: number) => void
}) {
  return <nav className={styles.pagination} aria-label="Paginación">
    <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</button>
    <span aria-live="polite">Página {page} de {Math.max(1, pageCount)}</span>
    <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Siguiente</button>
  </nav>
}
