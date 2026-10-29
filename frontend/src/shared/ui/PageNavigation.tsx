import styles from './Shared.module.css'

export function PageNavigation({ page, hasNext, onPageChange }: {
  page: number; hasNext: boolean; onPageChange: (page: number) => void
}) {
  return <nav className={styles.pagination} aria-label="Paginación">
    <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</button>
    <span aria-live="polite">Página {page}</span>
    <button type="button" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>Siguiente</button>
  </nav>
}
