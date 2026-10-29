import { createContext, useContext } from 'react'
import type { Account } from '../../shared/api/types'

export type SessionState =
  | { status: 'loading' | 'anonymous'; account: null; error: null }
  | { status: 'authenticated'; account: Account; error: null }
  | { status: 'error'; account: null; error: string }

export interface SessionContextValue {
  state: SessionState
  refresh: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession requires SessionProvider')
  return context
}
