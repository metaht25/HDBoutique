import { useCallback } from 'react'
import { apiClient } from '../../shared/api/client'
import { allOptions, parseList, positiveId, record } from '../../shared/api/validation'
import { useResource } from '../../shared/hooks/useResource'
import { exactMoney } from '../../shared/forms/fields'
import type { Choice } from './contracts'

export const methodLabels: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia', mixed: 'Mixto' }
export const statusLabels: Record<string, string> = { confirmed: 'Confirmada', voided: 'Anulada', legacy: 'Histórica', registered: 'Pendiente', received: 'Recibida', low_stock: 'Stock bajo', out_of_stock: 'Agotado', available: 'En stock', unknown: 'Pendiente de conteo', invalid: 'Stock inválido' }
export function money(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 'No registrado'
  const raw = String(value)
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) return 'No registrado'
  const [integer, fraction = ''] = raw.split('.')
  const normalized = `${integer}.${fraction.padEnd(2, '0')}`
  const [whole = '0', cents = '00'] = normalized.split('.')
  return `C$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`
}
export function cents(value: string | null | undefined): bigint { return BigInt((exactMoney(value ?? '') ?? '0.00').replace('.', '')) }
export function amount(value: bigint): string { return `${value < 0n ? '-' : ''}${(value < 0n ? -value : value) / 100n}.${String((value < 0n ? -value : value) % 100n).padStart(2, '0')}` }
export function commercialDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
export function dateText(value: string | null) { return value ? value.slice(0, 10).split('-').reverse().join('/') : 'No registrada' }
export function timeText(value: string | null) { return value ? new Intl.DateTimeFormat('es-NI', { timeZone: 'America/Managua', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—' }
export function query(values: Record<string, string | number | boolean | undefined>) { return new URLSearchParams(Object.entries(values).filter(([, value]) => value !== '' && value !== undefined).map(([key, value]) => [key, String(value)])).toString() }
export function useQuery<T>(path: string, revision = 0) {
  const load = useCallback((signal: AbortSignal) => apiClient.request<T>(`/api/v1/${path}`, { signal }), [path])
  return useResource(`${path}:${revision}`, load)
}
export async function choices(resource: string, signal: AbortSignal): Promise<Choice[]> {
  const ids: Record<string, string> = { categories: 'category_id', sizes: 'size_id', departments: 'department_id', municipalities: 'municipality_id', 'employee-options': 'employee_id' }
  const rows = await allOptions(offset => apiClient.request(`/api/v1/${resource}?offset=${offset}&limit=100`, { signal }).then(data => parseList(data, value => {
    const row = record(value)
    return { id: positiveId(row[ids[resource]!]), label: String(row.name ?? (row.first_names ? `${row.first_names} ${row.last_names}` : 'Nombre histórico no registrado')), ...(row.department_id ? { department_id: positiveId(row.department_id) } : {}) }
  })), row => row.id)
  return resource === 'sizes' ? rows.filter(row => ['S', 'M', 'L', 'XL', 'XXL'].includes(row.label)) : rows
}
export function useChoices(resource: string, revision = 0) {
  const load = useCallback((signal: AbortSignal) => choices(resource, signal), [resource])
  return useResource(`${resource}:${revision}`, load)
}
