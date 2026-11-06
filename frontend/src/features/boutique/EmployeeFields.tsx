import type { ReactNode } from 'react'
import { Icon } from '../../shared/ui/Icon'
import { CommerceSection } from './CommerceUI'
import ui from './Commerce.module.css'

export function EmployeeFields({ field, phone, address, jobTitle, username, password, existing, replacingPassword }: { field: (name: string, label: string, required?: boolean, maxLength?: number, type?: string) => ReactNode; phone: ReactNode; address: ReactNode; jobTitle: ReactNode; username: ReactNode; password: ReactNode; existing: boolean; replacingPassword: boolean }) {
  return <>
    <div className={ui.formIntro}><span className={ui.icon}><Icon name="employees" /></span><p><strong>{existing ? 'Información y acceso del empleado' : 'Una nueva persona en tu equipo'}</strong>{existing ? 'Revisa sus datos y administra su contraseña cuando sea necesario.' : 'El empleado y su cuenta se crean juntos al guardar.'}</p></div>
    <CommerceSection number="01" title="Información personal"><div className={ui.formGrid}>{field('first_names', 'Nombres')}{field('last_names', 'Apellidos')}{phone}</div></CommerceSection>
    <CommerceSection number="02" title="Domicilio" description="Selecciona primero el departamento y después el municipio."><div className={ui.formGrid}>{address}</div></CommerceSection>
    <CommerceSection number="03" title="Información laboral" description="El cargo es informativo y no determina los permisos de la cuenta."><div className={ui.formGrid}>{jobTitle}{field('start_date', 'Fecha de ingreso', false, 10, 'date')}</div></CommerceSection>
    <CommerceSection number="04" title={existing ? 'Cuenta y contraseña' : 'Cuenta de acceso'} description={existing ? 'Deja la contraseña vacía para conservar la actual. Nunca se muestra la contraseña guardada.' : 'La cuenta tendrá acceso como Colaborador. Usa una contraseña de 6 a 128 caracteres.'}>
      <div className={ui.formGrid}>{username}{password}</div>
    </CommerceSection>
    <div className={ui.note} role={replacingPassword ? 'status' : undefined}><Icon name="lock" size={20} /><p><strong>{existing ? 'Los permisos actuales se conservan' : 'Acceso como Colaborador'}</strong>{existing ? replacingPassword ? 'Al guardar la nueva contraseña se invalidarán las sesiones del empleado. Solo Dueña puede reemplazarla. Usa de 6 a 128 caracteres.' : 'Solo Dueña puede reemplazar la contraseña. Si la cambias, sus sesiones se invalidarán. Usa de 6 a 128 caracteres.' : 'El cargo Vendedor y los permisos de Colaborador son independientes. La contraseña se guarda protegida.'}</p></div>
  </>
}
