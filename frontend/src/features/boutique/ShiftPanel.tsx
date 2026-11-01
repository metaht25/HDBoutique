import { useCallback, useState } from 'react'
import { useSession } from '../session/sessionContext'
import { CashWorkspace } from '../cash-register/CashRegisterPage'
import { listShifts } from '../cash-register/api'
import { useResource } from '../../shared/hooks/useResource'
import { money } from './api'
import { DataState, Modal } from './ui'
import styles from './Boutique.module.css'

export function ShiftPanel({ onChange }: { onChange?: () => void }) {
  const { state } = useSession(), [open, setOpen] = useState(false), [revision, setRevision] = useState(0)
  const load = useCallback((signal: AbortSignal) => listShifts(signal), [])
  const result = useResource(`compact-shift:${revision}`, load), shift = result?.data?.find(row => row.status === 'open')
  if (state.status !== 'authenticated') return null
  function close() { setOpen(false); setRevision(value => value + 1); onChange?.() }
  return <><section className={styles.shift}><DataState result={result}><div><b>{shift ? `Turno #${shift.shift_id} abierto` : 'Turno cerrado'}</b><small>{shift ? `Efectivo esperado: ${money(shift.expected_amount)}` : 'Abre tu turno para registrar ventas.'}</small></div></DataState><button className="secondary" onClick={() => setOpen(true)}>{shift ? 'Gestionar turno' : 'Abrir turno'}</button></section>
    {open && <Modal title="Turnos y movimientos de caja" wide onClose={close}><CashWorkspace /></Modal>}
  </>
}
