import type { ReactNode } from 'react'
import styles from './Shared.module.css'

export function Card({ label, children, attention = false }: {
  label: string; children: ReactNode; attention?: boolean
}) {
  return <div className={`${styles.card} ${attention ? styles.attention : ''}`}>
    <span>{label}</span><strong>{children}</strong>
  </div>
}
