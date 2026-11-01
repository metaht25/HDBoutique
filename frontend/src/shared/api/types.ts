/** New API contracts preserve decimal money as text and unknown external data. */
export type DecimalMoney = string
export type Role = 'Administrator' | 'Cashier'

export interface Account {
  user_id: number
  username: string
  role: Role
  is_active: boolean
  employee_id: number | null
  must_change_password?: boolean
  display_name?: string | null
}

export interface ValidationField {
  location: (string | number)[]
  type: string
}

export interface ErrorEnvelope {
  error: { code: string; message: string; fields?: ValidationField[] }
}

export function isAccount(value: unknown): value is Account {
  if (typeof value !== 'object' || value === null) return false
  const account = value as Record<string, unknown>
  return Number.isInteger(account.user_id) && Number(account.user_id) > 0
    && typeof account.username === 'string' && typeof account.is_active === 'boolean'
    && ['Administrator', 'Cashier'].includes(String(account.role))
    && (account.employee_id === null
      || (Number.isInteger(account.employee_id) && Number(account.employee_id) > 0))
}
