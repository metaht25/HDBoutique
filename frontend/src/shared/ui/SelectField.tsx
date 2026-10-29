import { useId } from 'react'
import type { ReactNode, SelectHTMLAttributes } from 'react'
import styles from './Shared.module.css'

export function SelectField({ label, error, children, id, ...props }: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string; error?: string; children: ReactNode
}) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return <div className={styles.field}><label htmlFor={fieldId}>{label}</label>
    <select {...props} id={fieldId} aria-invalid={!!error}
      aria-describedby={error ? `${fieldId}-error` : undefined}>{children}</select>
    {error && <small id={`${fieldId}-error`} className={styles.fieldError}>{error}</small>}
  </div>
}
