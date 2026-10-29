import { apiClient } from '../../shared/api/client'
import { invalidResponse, parseList, positiveId, record, requiredText } from '../../shared/api/validation'
import { money } from '../reports/api'

export interface Shift {
  shift_id: number; employee_id: number; opened_by_user_id: number; opened_at: string; status: 'open' | 'closed';
  opening_amount: string; cash_collected: string; transfers_collected: string; cash_refunded: string; transfers_refunded: string;
  deposits: string; withdrawals: string; expected_amount: string; counted_amount: string | null; difference: string | null;
  closing_reason: string | null; closed_at: string | null; closed_by_user_id: number | null;
  movements: { movement_id: number; kind: 'deposit' | 'withdrawal'; amount: string; reason: string; performed_by_user_id: number; created_at: string }[];
}
export interface PaymentInput { shift_id: number; method: 'cash' | 'transfer'; received_amount?: string; reference?: string; transfer_confirmed?: boolean }
export interface Payment { shift_id: number; method: 'cash' | 'transfer'; amount: string; received_amount: string; change_amount: string; reference: string | null }
export function parsePayment(value: unknown): Payment {
  const row = record(value)
  if (row.method !== 'cash' && row.method !== 'transfer') return invalidResponse()
  return { shift_id: positiveId(row.shift_id), method: row.method, amount: money(row.amount), received_amount: money(row.received_amount),
    change_amount: money(row.change_amount), reference: row.reference === null ? null : requiredText(row.reference) }
}
export function parseShift(value: unknown): Shift {
  const row = record(value)
  if (row.register_code !== 'main' || (row.status !== 'open' && row.status !== 'closed')) return invalidResponse()
  return { shift_id: positiveId(row.shift_id), employee_id: positiveId(row.employee_id), opened_by_user_id: positiveId(row.opened_by_user_id),
    opened_at: requiredText(row.opened_at), status: row.status,
    opening_amount: money(row.opening_amount), cash_collected: money(row.cash_collected), transfers_collected: money(row.transfers_collected),
    cash_refunded: money(row.cash_refunded), transfers_refunded: money(row.transfers_refunded), deposits: money(row.deposits), withdrawals: money(row.withdrawals),
    expected_amount: money(row.expected_amount), counted_amount: row.counted_amount === null ? null : money(row.counted_amount),
    difference: row.difference === null ? null : money(row.difference), closing_reason: row.closing_reason === null ? null : requiredText(row.closing_reason),
    closed_at: row.closed_at === null ? null : requiredText(row.closed_at), closed_by_user_id: row.closed_by_user_id === null ? null : positiveId(row.closed_by_user_id),
    movements: parseList(row.movements, value => { const entry = record(value); if (entry.kind !== 'deposit' && entry.kind !== 'withdrawal') return invalidResponse()
      return { movement_id: positiveId(entry.movement_id), kind: entry.kind, amount: money(entry.amount), reason: requiredText(entry.reason),
        performed_by_user_id: positiveId(entry.performed_by_user_id), created_at: requiredText(entry.created_at) } }),
  }
}
export async function listShifts(signal?: AbortSignal, page = 1): Promise<Shift[]> {
  return parseList(await apiClient.request(`/api/v1/cash/shifts?offset=${(page - 1) * 20}&limit=21`, { signal }), parseShift)
}
