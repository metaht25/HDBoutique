import { useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { getErrorMessage } from '../../shared/api/errors'
import { LoadingState, Message } from '../../shared/ui/Feedback'
import { TextField } from '../../shared/ui/TextField'
import { useSession } from './sessionContext'
import styles from './SignIn.module.css'

function SignIn() {
  const { login } = useSession()
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try { await login(username.trim(), password) } catch (error) {
      setError(getErrorMessage(error, 'No se pudo iniciar sesión.'))
    } finally { setPassword(''); setBusy(false); submitting.current = false }
  }
  return <section className={styles.panel} aria-labelledby="sign-in-title"><p className={styles.eyebrow}>TU BOUTIQUE, EN ORDEN</p><h2 id="sign-in-title">Inicia sesión para continuar</h2><p className={styles.intro}>Accede a tu espacio de trabajo con tu cuenta.</p>
    <form onSubmit={event => void submit(event)} className={styles.form}>
      <TextField label="Usuario" name="username" autoComplete="username" required maxLength={64}
        value={username} disabled={busy} onChange={event => setUsername(event.target.value)} />
      <TextField label="Contraseña" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required maxLength={128}
        value={password} disabled={busy} onChange={event => setPassword(event.target.value)} />
<button className={styles.reveal} type="button" disabled={busy} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</button>
      {error && <Message>{error}</Message>}
      <button disabled={busy} type="submit">{busy ? 'Iniciando sesión…' : 'Iniciar sesión'}</button>
    </form>
  </section>
}

export function ModuleAccess({ children }: { children: ReactNode }) {
  const { state, refresh } = useSession()
  if (state.status === 'loading') return <LoadingState>Consultando acceso…</LoadingState>
  if (state.status === 'anonymous') return <SignIn />
  if (state.status === 'error') return <><Message>{state.error}</Message>
    <button type="button" onClick={() => void refresh()}>Reintentar acceso</button></>
  return children
}
