import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { apiClient } from '../../shared/api/client'
import { getErrorMessage } from '../../shared/api/errors'
import { loginSession, logoutSession, restoreSession } from './sessionApi'
import { SessionContext } from './sessionContext'
import type { SessionState } from './sessionContext'

const anonymous: SessionState = { status: 'anonymous', account: null, error: null }

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', account: null, error: null })
  const revision = useRef(0)

  const refresh = useCallback(async () => {
    const current = ++revision.current
    setState({ status: 'loading', account: null, error: null })
    try {
      const account = await restoreSession()
      if (current === revision.current) setState(account
        ? { status: 'authenticated', account, error: null } : anonymous)
    } catch (error) {
      if (current === revision.current) setState({ status: 'error', account: null,
        error: getErrorMessage(error, 'No se pudo consultar la sesión.') })
    }
  }, [])

  useEffect(() => {
    let active = true
    const current = ++revision.current
    const unsubscribe = apiClient.subscribeUnauthorized(() => {
      revision.current += 1
      setState(anonymous)
    })
    void restoreSession().then(account => {
      if (active && current === revision.current) setState(account
        ? { status: 'authenticated', account, error: null } : anonymous)
    }).catch(error => {
      if (active && current === revision.current) setState({ status: 'error', account: null,
        error: getErrorMessage(error, 'No se pudo consultar la sesión.') })
    })
    return () => { active = false; unsubscribe(); revision.current += 1 }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const current = ++revision.current
    const account = await loginSession(username, password)
    if (current === revision.current) setState({ status: 'authenticated', account, error: null })
  }, [])

  const logout = useCallback(async () => {
    const current = ++revision.current
    await logoutSession()
    if (current === revision.current) setState(anonymous)
  }, [])

  const value = useMemo(() => ({ state, refresh, login, logout }), [state, refresh, login, logout])
  return <SessionContext value={value}>{children}</SessionContext>
}
