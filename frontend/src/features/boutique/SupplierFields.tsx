import type { ReactNode } from 'react'
import { Icon } from '../../shared/ui/Icon'
import { CommerceSection } from './CommerceUI'
import ui from './Commerce.module.css'

export function SupplierFields({ field, phone }: { field: (name: string, label: string, required?: boolean, maxLength?: number, type?: string) => ReactNode; phone: ReactNode }) {
  return <>
    <CommerceSection number="01" title="Información comercial">{field('company_name', 'Empresa', true, 50)}</CommerceSection>
    <CommerceSection number="02" title="Persona de contacto" description="Datos para identificar y contactar al proveedor."><div className={ui.formGrid}>
      {field('contact_first_names', 'Nombres del contacto')}{field('contact_last_names', 'Apellidos del contacto')}
      {phone}{field('work_email', 'Correo', false, 40, 'email')}
    </div></CommerceSection>
    <CommerceSection number="03" title="Ubicación" description="Añade una referencia de dirección si está disponible.">{field('address_line', 'Dirección exacta (opcional)', false, 100)}</CommerceSection>
    <div className={ui.note}><Icon name="suppliers" size={20} /><p><strong>Un contacto para próximas compras</strong>El proveedor se guarda de forma independiente. Seguirá disponible aunque cierres o canceles la compra actual.</p></div>
  </>
}
