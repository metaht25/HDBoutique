import type { ReactNode } from 'react'
import styles from './Shared.module.css'

export function TableContainer({ children, label = 'Tabla de datos' }: {
  children: ReactNode; label?: string
}) {
  return <div className={styles.tableScroll} role="region" aria-label={label} tabIndex={0}>
    {children}
  </div>
}
