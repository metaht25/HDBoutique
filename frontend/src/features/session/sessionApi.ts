import { apiClient } from '../../shared/api/client'
import { ApiError } from '../../shared/api/errors'
import { isAccount } from '../../shared/api/types'
import type { Account } from '../../shared/api/types'

async function readSession(): Promise<Account | null> {
  try {
    const account = await apiClient.request('/api/v1/auth/me')
    if (!isAccount(account) || !account.is_active) {
      throw new ApiError(502, 'invalid_response', 'Respuesta de sesión no válida.')
    }
    await apiClient.prepareCsrf()
    return account
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

let pendingRestore: Promise<Account | null> | null = null
export function restoreSession(force = false): Promise<Account | null> {
  if (force || !pendingRestore) {
    const pending = readSession().finally(() => { if (pendingRestore === pending) pendingRestore = null })
    pendingRestore = pending
  }
  return pendingRestore
}

export async function loginSession(username: string, password: string): Promise<Account> {
  const account = await apiClient.request('/api/v1/auth/login', {
    method: 'POST', body: { username, password },
  })
  if (!isAccount(account) || !account.is_active) {
    apiClient.clearCsrf()
    throw new ApiError(502, 'invalid_response', 'Respuesta de sesión no válida.')
  }
  return account
}

export async function logoutSession(): Promise<void> {
  await apiClient.request('/api/v1/auth/logout', { method: 'POST' })
  apiClient.clearCsrf()
}
