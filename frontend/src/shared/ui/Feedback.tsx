import type { ReactNode } from 'react'
import styles from './Shared.module.css'

export function LoadingState({ children = 'Cargando…' }: { children?: ReactNode }) {
  return <div className={styles.loading} role="status" aria-live="polite">{children}</div>
}

export function Message({ children, variant = 'error' }: {
  children: ReactNode; variant?: 'error' | 'info' | 'success'
}) {
  return <div className={`${styles.message} ${styles[variant]}`}
    role={variant === 'error' ? 'alert' : 'status'}>{children}</div>
}
