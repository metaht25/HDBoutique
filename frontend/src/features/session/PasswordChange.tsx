import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiClient } from '../../shared/api/client'
import { getErrorMessage } from '../../shared/api/errors'
import { TextField } from '../../shared/ui/TextField'
import { Message } from '../../shared/ui/Feedback'
import { useSession } from './sessionContext'
import styles from '../boutique/Boutique.module.css'

export function PasswordChange() {
  const { refresh } = useSession(), [current, setCurrent] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), sending = useRef(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending.current) return
    if (password !== confirmation) { setError('Las contraseñas nuevas no coinciden.'); return }
    sending.current = true; setBusy(true); setError('')
    try { await apiClient.request('/api/v1/auth/password', { method: 'POST', body: { current_password: current, new_password: password } }); apiClient.clearCsrf(); await refresh() }
    catch (error) { setError(getErrorMessage(error, 'No se pudo cambiar la contraseña.')) }
    finally { sending.current = false; setBusy(false); setCurrent(''); setPassword(''); setConfirmation('') }
  }
  return <section className={styles.panel}><h2>Cambia tu contraseña temporal</h2><p>Elige una contraseña personal antes de comenzar a trabajar. Después vuelve a iniciar sesión.</p><form className={styles.form} onSubmit={event => void submit(event)}>
    <TextField label="Contraseña temporal" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} />
    <TextField label="Nueva contraseña" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} />
    <TextField label="Repetir nueva contraseña" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
    {error && <Message>{error}</Message>}<button disabled={busy}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</button>
  </form></section>
}
