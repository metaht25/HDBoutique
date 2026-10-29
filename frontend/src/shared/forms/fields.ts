import { ApiError } from '../api/errors'

export type FieldErrors = Record<string, string>
export function serverFields(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) return {}
  return Object.fromEntries(error.fields.flatMap(field => {
    const name = field.location.at(-1)
    return typeof name === 'string' ? [[name, 'Revisa este campo.']] : []
  }))
}
export function inputId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null
}
export function exactMoney(value: string): string | null {
  const match = /^(-?)(\d{1,8})(?:\.(\d{1,2}))?$/.exec(value.trim())
  if (!match) return null
  const integer = BigInt(match[2] ?? '0').toString()
  const cents = (match[3] ?? '').padEnd(2, '0')
  const sign = integer === '0' && cents === '00' ? '' : match[1]
  return `${sign}${integer}.${cents}`
}
export function displayMoney(value: string | null): string {
  if (value === null) return 'Sin precio'
  const normalized = exactMoney(value)
  return normalized === null ? 'Precio no válido' : `C$${normalized}`
}
