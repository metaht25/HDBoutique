import { TextField } from '../../shared/ui/TextField'
import { useState } from 'react'

import { canonicalPhone, formatPhone, validPhone } from './phone'

export function PhoneField({ value, onChange, required = false }: { value: string; onChange: (value: string) => void; required?: boolean }) {
  const [touched, setTouched] = useState(false)
  return <TextField label="Teléfono" required={required} type="tel" inputMode="numeric" placeholder="8000-0000" pattern="[78][0-9]{3}-[0-9]{4}" maxLength={9} onBlur={() => setTouched(true)} error={touched && (value || required) && !validPhone(value) ? 'Usa ocho dígitos y un número que comience con 7 u 8.' : undefined} value={formatPhone(canonicalPhone(value))} onChange={event => {
    const input = event.target, digits = canonicalPhone(input.value), position = input.selectionStart ?? input.value.length
    if (!/^[0-9]*$/.test(digits) || digits.length > 8) return
    const before = canonicalPhone(input.value.slice(0, position)).length
    onChange(formatPhone(digits))
    requestAnimationFrame(() => { const caret = before + (before > 4 ? 1 : 0); input.setSelectionRange(caret, caret) })
  }} onKeyDown={event => {
    const input = event.currentTarget, position = input.selectionStart
    if (position !== input.selectionEnd || input.value[4] !== '-') return
    const index = event.key === 'Backspace' && position === 5 ? 3 : event.key === 'Delete' && position === 4 ? 4 : -1
    if (index < 0) return
    event.preventDefault()
    const digits = canonicalPhone(input.value)
    onChange(formatPhone(digits.slice(0, index) + digits.slice(index + 1)))
    requestAnimationFrame(() => input.setSelectionRange(index, index))
  }} />
}
