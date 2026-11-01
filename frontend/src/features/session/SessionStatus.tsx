import { useState } from 'react'
import { getErrorMessage } from '../../shared/api/errors'
import { Message } from '../../shared/ui/Feedback'
import { useSession } from './sessionContext'
import styles from './SessionStatus.module.css'

const roleLabels = { Administrator: 'Dueña', Cashier: 'Colaborador' }

export function SessionStatus() {
  const { state, refresh, logout } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function closeSession() {
    setBusy(true)
    setError('')
    try { await logout() } catch (error) {
      setError(getErrorMessage(error, 'No se pudo cerrar la sesión.'))
    } finally { setBusy(false) }
  }
  return <div className={styles.session}>
    {state.status === 'loading' && <span role="status">Consultando sesión…</span>}
    {state.status === 'authenticated' && <>
      <span>{state.account.username} · {roleLabels[state.account.role]}</span>
      <button type="button" disabled={busy} onClick={() => void closeSession()}>
        {busy ? 'Cerrando…' : 'Cerrar sesión'}
      </button>
    </>}
    {state.status === 'anonymous' && <span>Sin sesión</span>}
    {state.status === 'error' && <span role="status">Sesión no disponible</span>}
    {(state.status === 'anonymous' || state.status === 'error') &&
      <button type="button" onClick={() => void refresh()}>Reintentar sesión</button>}
    {state.status === 'error' && <span className={styles.error}>{state.error}</span>}
    {error && <Message>{error}</Message>}
  </div>
}
