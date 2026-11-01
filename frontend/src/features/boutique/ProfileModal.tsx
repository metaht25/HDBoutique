import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiClient } from '../../shared/api/client'
import { getErrorMessage } from '../../shared/api/errors'
import { TextField } from '../../shared/ui/TextField'
import { Message } from '../../shared/ui/Feedback'
import { useQuery } from './api'
import type { Profile } from './contracts'
import { DataState, Modal } from './ui'
import styles from './Boutique.module.css'

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [name, setName] = useState(profile.name ?? ''), [phone, setPhone] = useState(profile.phone_number ?? ''), [address, setAddress] = useState(profile.address_line ?? ''), [logo, setLogo] = useState<string | null>(null), [remove, setRemove] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), sending = useRef(false)
  async function upload(file: File | undefined) {
    setError('')
    if (!file) return
    if (file.size > 2 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Usa una imagen PNG, JPEG o WebP de hasta 2 MB.'); return }
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''; bytes.forEach(value => { binary += String.fromCharCode(value) })
    setLogo(btoa(binary)); setRemove(false)
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (sending.current) return
    sending.current = true; setBusy(true); setError('')
    try { await apiClient.request('/api/v1/boutique-profile', { method: 'PUT', body: { name: name.trim(), phone_number: phone.trim(), address_line: address.trim(), logo_base64: logo, remove_logo: remove } }); onSaved() }
    catch (error) { setError(getErrorMessage(error, 'No se pudieron guardar los datos de la boutique.')) }
    finally { sending.current = false; setBusy(false) }
  }
  return <form className={styles.form} onSubmit={event => void save(event)}>
    {!profile.ready && <Message variant="info">Completa estos datos para preparar los recibos de la boutique.</Message>}
    <TextField label="Nombre de la boutique" required maxLength={100} value={name} onChange={e => setName(e.target.value)} />
    <TextField label="Teléfono" required maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} />
    <TextField label="Dirección" required maxLength={250} value={address} onChange={e => setAddress(e.target.value)} />
    <TextField label="Logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void upload(e.target.files?.[0])} />
    <p className={styles.hint}>PNG, JPEG o WebP. Máximo 2 MB y 3000 píxeles por lado.</p>
    {profile.logo_base64 && <label><input type="checkbox" checked={remove} onChange={e => setRemove(e.target.checked)} />Quitar logo actual</label>}
    {error && <Message>{error}</Message>}<button disabled={busy}>{busy ? 'Guardando…' : 'Guardar datos de la boutique'}</button>
  </form>
}
export function ProfileModal({ onClose }: { onClose: () => void }) {
  const result = useQuery<Profile>('boutique-profile')
  return <Modal title="Datos de la boutique" onClose={onClose}><DataState result={result}>{result?.data && <ProfileForm profile={result.data} onSaved={onClose} />}</DataState></Modal>
}
