import type { ReactNode } from 'react'
import { Icon } from '../../shared/ui/Icon'
import { CommerceSection } from './CommerceUI'
import ui from './Commerce.module.css'

export function CustomerFields({ field, delivery, existing, phone, address }: { field: (name: string, label: string) => ReactNode; delivery: boolean; existing: boolean; phone: ReactNode; address: ReactNode }) {
  return <>
    <div className={ui.formIntro}><span className={ui.icon}><Icon name="people" /></span><p><strong>{existing ? 'Completa los datos de tu cliente' : 'Un cliente, una sola identidad'}</strong>{delivery ? 'Prepara la información necesaria para la entrega.' : 'Registra los nombres para identificar al cliente en sus próximas compras.'}</p></div>
    <CommerceSection number="01" title="Información personal" description={existing ? 'Los nombres identifican al cliente existente y se conservan.' : 'Escribe los nombres y apellidos del cliente.'}><div className={ui.formGrid}>{field('first_names', 'Nombres')}{field('last_names', 'Apellidos')}</div></CommerceSection>
    {delivery && <CommerceSection number="02" title="Datos de Delivery" description="Teléfono y dirección completos para coordinar la entrega."><div className={ui.formGrid}>{phone}{address}</div></CommerceSection>}
    <div className={ui.note}><Icon name="people" size={20} /><p><strong>{existing ? 'Conserva el mismo registro' : 'Disponible al confirmar la venta'}</strong>{existing ? 'Los datos de entrega se actualizarán en este cliente al confirmar la operación.' : 'Esta información se usará en la venta actual. Puedes revisar el resumen antes de confirmarla.'}</p></div>
  </>
}
