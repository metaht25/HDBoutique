import { ApiError } from '../../shared/api/errors'
import { record, positiveId, requiredText } from '../../shared/api/validation'
import type { TransactionInput, TransactionKind } from './api'

export interface PendingIntent { key: string; body: TransactionInput }
const storageKey = (userId: number, kind: TransactionKind) => `hdb.pending.v1.${userId}.${kind}`
export function readIntent(userId: number, kind: TransactionKind): PendingIntent | null {
  try {
    const text = sessionStorage.getItem(storageKey(userId, kind))
    if (!text) return null
    const row = record(JSON.parse(text)), body = record(row.body), sales = kind === 'sales'
    const key = requiredText(row.key)
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new Error('Invalid key')
    const partyId = positiveId(body[sales ? 'customer_id' : 'supplier_id'])
    const date = requiredText(body[sales ? 'sale_date' : 'purchase_date'])
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new Error('Invalid draft')
    const items = body.items.map(value => { const item = record(value); return {
      [sales ? 'product_id' : 'supplier_product_id']: positiveId(item[sales ? 'product_id' : 'supplier_product_id']), quantity: positiveId(item.quantity),
    } })
    if (new Set(items.map(item => item[sales ? 'product_id' : 'supplier_product_id'])).size !== items.length) throw new Error('Duplicate draft')
    const shipping = sales ? undefined : requiredText(body.shipping_cost)
    if (shipping !== undefined && !/^\d{1,8}\.\d{2}$/.test(shipping)) throw new Error('Invalid amount')
    return { key, body: { [sales ? 'customer_id' : 'supplier_id']: partyId, [sales ? 'sale_date' : 'purchase_date']: date,
      ...(body.employee_id !== undefined ? { employee_id: positiveId(body.employee_id) } : {}),
      ...(!sales ? { shipping_cost: shipping } : {}), items } }
  } catch {
    throw new ApiError(409, 'pending_unavailable', 'No se puede recuperar la solicitud pendiente. Revisa el historial antes de volver a registrar.')
  }
}
export function storeIntent(userId: number, kind: TransactionKind, intent: PendingIntent): void {
  try { sessionStorage.setItem(storageKey(userId, kind), JSON.stringify(intent)) } catch {
    throw new ApiError(409, 'pending_unavailable', 'Permite el almacenamiento de sesión para proteger esta operación frente a reintentos.')
  }
}
export function clearIntent(userId: number, kind: TransactionKind): void { sessionStorage.removeItem(storageKey(userId, kind)) }
export function isDefinitiveRejection(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500
    && !['session_changed', 'pending_unavailable'].includes(error.code) && error.status !== 408
}
