import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import styles from './Shared.module.css'

export function TextField({ label, error, id, ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; error?: string
}) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`
  const numericPattern = props.type === 'tel' ? undefined : props.inputMode === 'numeric' ? '[0-9]*' : props.inputMode === 'decimal' ? '[0-9]{0,8}(\\.[0-9]{0,2})?' : undefined
  return <div className={styles.field}>
    <label htmlFor={fieldId}>{label}</label>
    <input {...props} pattern={props.pattern ?? numericPattern} onChange={event => {
      if (numericPattern && !new RegExp('^' + numericPattern + '$').test(event.target.value)) return
      props.onChange?.(event)
    }} id={fieldId} aria-invalid={!!error}
      aria-describedby={[props['aria-describedby'], error ? errorId : ''].filter(Boolean).join(' ') || undefined} />
    {error && <small id={errorId} className={styles.fieldError}>{error}</small>}
  </div>
}
