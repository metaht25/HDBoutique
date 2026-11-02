import { useRef, useState } from 'react'
import { apiClient } from '../../shared/api/client'
import { getErrorMessage } from '../../shared/api/errors'
import { record, requiredText } from '../../shared/api/validation'
import { isDefinitiveRejection } from '../transactions/pending'

interface Intent { path: string; body: object; key: string }
// One protected intent per account, tab and operation. Never retry with edited data.
export function useCashCommand<T = unknown>(userId: number, operation: string, onSaved: (result: T) => void) {
  const storageKey = `hdb.cash.v1.${userId}.${operation}`
  const [restored] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (!saved) return { intent: null, error: '' }
      const row = record(JSON.parse(saved)), path = requiredText(row.path), key = requiredText(row.key)
      if (!/^\/api\/v1\/(sales(\/\d+\/void)?|purchases(\/\d+\/receive)?)$/.test(path) || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new Error('Invalid intent')
      return { intent: { path, key, body: record(row.body) } as Intent, error: '' }
    } catch { return { intent: null, error: 'No se pudo recuperar la operación pendiente. Revisa el historial antes de registrar otra.' } }
  })
  const [pending, setPending] = useState<Intent | null>(restored.intent), [error, setError] = useState(restored.error), [busy, setBusy] = useState(false)
  const lock = useRef(false)
  async function send(path: string, body: object) {
    if (lock.current || restored.error) return
    const intent = pending ?? { path, body, key: crypto.randomUUID() }
    try { sessionStorage.setItem(storageKey, JSON.stringify(intent)) } catch { setError('Permite el almacenamiento de sesión para proteger los reintentos.'); return }
    lock.current = true; setBusy(true); setPending(intent); setError('')
    try {
      const result = await apiClient.request<T>(intent.path, { method: 'POST', body: intent.body, idempotencyKey: intent.key })
      sessionStorage.removeItem(storageKey); setPending(null); onSaved(result)
    } catch (error) {
      setError(getErrorMessage(error, 'No se pudo confirmar el resultado. Reintenta la misma operación.'))
      if (isDefinitiveRejection(error)) { sessionStorage.removeItem(storageKey); setPending(null) }
    } finally { lock.current = false; setBusy(false) }
  }
  return { send, error, setError, busy, pending, locked: busy || pending !== null || !!restored.error, blocked: !!restored.error }
}
