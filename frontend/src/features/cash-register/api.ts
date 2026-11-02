import { invalidResponse, positiveId, record, requiredText } from '../../shared/api/validation'
import { money } from '../reports/api'

// shift_id only preserves the exact body of an uncertain pre-phase command.
export interface PaymentInput { shift_id?: number; method: 'cash' | 'transfer' | 'mixed'; received_amount?: string; transfer_amount?: string; reference?: string; transfer_confirmed?: boolean }
export interface Payment { shift_id: number | null; method: 'cash' | 'transfer' | 'mixed'; amount: string; cash_amount?: string | null; transfer_amount?: string | null; received_amount: string; change_amount: string; reference: string | null }
export function parsePayment(value: unknown): Payment {
  const row = record(value)
  if (row.method !== 'cash' && row.method !== 'transfer' && row.method !== 'mixed') return invalidResponse()
  return { shift_id: row.shift_id == null ? null : positiveId(row.shift_id), method: row.method, amount: money(row.amount), cash_amount: row.cash_amount == null ? null : money(row.cash_amount), transfer_amount: row.transfer_amount == null ? null : money(row.transfer_amount), received_amount: money(row.received_amount),
    change_amount: money(row.change_amount), reference: row.reference === null ? null : requiredText(row.reference) }
}
