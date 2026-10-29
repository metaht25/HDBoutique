import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useResource } from '../../shared/hooks/useResource'
import { getErrorMessage } from '../../shared/api/errors'
import { LoadingState, Message } from '../../shared/ui/Feedback'
import { SelectField } from '../../shared/ui/SelectField'
import { ModuleAccess } from '../session/ModuleAccess'
import { useSession } from '../session/sessionContext'
import { CatalogPanel } from './CatalogPanel'
import { AccountsPanel } from './AccountsPanel'
import { catalogs, preparationStatus, preparationSteps } from './api'
import type { Catalog } from './api'
import styles from '../../shared/ui/Management.module.css'

function Preparation({ administrator }: { administrator: boolean }) {
  const { state } = useSession()
  const [revision, setRevision] = useState(0)
  const result = useResource(`preparation:${revision}`, preparationStatus)
  return <section className={styles.panel}><div className={styles.header}><h2>Preparación del negocio</h2>
    <button type="button" onClick={() => setRevision(value => value + 1)}>Revisar preparación</button></div>
    <p>Completa las referencias en este orden con los datos reales de la boutique. Cada paso indica si ya hay registros; revisa que correspondan a lo que vas a operar.</p>
    {!result ? <LoadingState>Revisando referencias…</LoadingState> : result.error !== undefined ? <Message>{getErrorMessage(result.error, 'No se pudo revisar la preparación.')}</Message>
      : <ol>{preparationSteps.map((step, index) => <li key={step.resource}><p><Link to={step.to}>{step.label}</Link> — <strong>{result.data?.[index] ? 'Con registros' : 'Pendiente de registrar'}</strong><br />{step.help}</p></li>)}</ol>}
    <h3>Cuentas del personal</h3>
    <p>{state.account?.employee_id ? 'Tu cuenta tiene un empleado vinculado.' : 'Tu cuenta no tiene empleado vinculado. Puedes seleccionar uno existente al operar o solicitar que se vincule tu cuenta.'}</p>
    {administrator ? <Link to="/settings?section=accounts">Administrar cuentas y vincular empleados</Link> : <p>Administrator crea las cuentas y asigna sus roles y empleados.</p>}
    <h3>Primeras operaciones</h3>
    <ol><li><p><Link to="/purchases">Registrar una compra y recibirla</Link> para incorporar la mercancía realmente recibida al inventario.</p></li>
      <li><p><Link to="/cash-register">Abrir caja</Link> con el empleado responsable y el efectivo inicial contado.</p></li>
      <li><p><Link to="/sales">Registrar la venta</Link> con stock disponible, cliente y pago completo en efectivo o transferencia.</p></li></ol>
    <p className={styles.note}>Los registros de referencia no garantizan stock, precios válidos ni un turno abierto. Cada operación verifica sus requisitos al confirmarse.</p>
  </section>
}

function Workspace({ administrator }: { administrator: boolean }) {
  const [params, setParams] = useSearchParams()
  const section = params.get('section') ?? 'preparation'
  const valid = section === 'preparation' || section === 'accounts' || Object.hasOwn(catalogs, section)
  return <div className={styles.page}><div className={styles.header}><div><h2>Configuración inicial</h2><p>Catálogos, ubicaciones y accesos del personal.</p></div></div>
    <SelectField label="Sección de configuración" value={valid ? section : ''} onChange={event => setParams({ section: event.target.value })}>
      {!valid && <option value="">Sección desconocida</option>}<option value="preparation">Preparación del negocio</option>
      {(Object.keys(catalogs) as Catalog[]).map(kind => <option key={kind} value={kind}>{catalogs[kind].label}</option>)}
      {administrator && <option value="accounts">Cuentas y accesos</option>}
    </SelectField>
    {!valid ? <Message>Esta sección no existe. Selecciona una sección para continuar.</Message>
      : section === 'preparation' ? <Preparation administrator={administrator} />
        : section === 'accounts' ? administrator ? <AccountsPanel /> : <Message>Solo Administrator puede administrar las cuentas.</Message>
          : <CatalogPanel key={section} kind={section as Catalog} />}
  </div>
}

function Access() {
  const { state } = useSession()
  if (state.status !== 'authenticated') return null
  if (state.account.role === 'Cashier') return <Message>No tienes permiso para acceder a configuración inicial.</Message>
  return <Workspace key={state.account.user_id} administrator={state.account.role === 'Administrator'} />
}
export default function SettingsPage() { return <ModuleAccess><Access /></ModuleAccess> }
