import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import styles from './Shared.module.css'

export function TextField({ label, error, id, ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; error?: string
}) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`
  return <div className={styles.field}>
    <label htmlFor={fieldId}>{label}</label>
    <input {...props} id={fieldId} aria-invalid={!!error}
      aria-describedby={[props['aria-describedby'], error ? errorId : ''].filter(Boolean).join(' ') || undefined} />
    {error && <small id={errorId} className={styles.fieldError}>{error}</small>}
  </div>
}
