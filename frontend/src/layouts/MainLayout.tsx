import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { collaboratorOrder, navigation } from '../app/navigation'
import { useSession } from '../features/session/sessionContext'
import { ModuleAccess } from '../features/session/ModuleAccess'
import { getErrorMessage } from '../shared/api/errors'
import { Message } from '../shared/ui/Feedback'
import { Icon } from '../shared/ui/Icon'
import type { IconName } from '../shared/ui/Icon'
import styles from './MainLayout.module.css'

const navigationIcons: Record<string, IconName> = {
  '/dashboard': 'dashboard', '/new-sale': 'plus', '/sales': 'sales', '/sales-history': 'history',
  '/receipts': 'receipt', '/products': 'products', '/purchases': 'purchases', '/suppliers': 'suppliers',
  '/customers': 'people', '/employees': 'employees',
}

export function MainLayout() {
  const location = useLocation(), { state, logout } = useSession(), account = state.account
  const owner = account?.role === 'Administrator', [menuOpen, setMenuOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const items = owner ? navigation.map(item => ({ path: item.path, label: item.label })) : collaboratorOrder.map(path => navigation.find(item => item.path === path)!).map(item => ({ path: item.path, label: 'collaborator' in item ? item.collaborator : item.label }))
  const title = account ? items.find(item => item.path === location.pathname)?.label ?? 'Página no encontrada' : 'Bienvenida a H&D Boutique'
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { document.title = title + ' | H&D Boutique'; heading.current?.focus(); window.scrollTo(0, 0) }, [title, location.pathname])
  useEffect(() => { document.body.dataset.role = account?.role ?? ''; return () => { delete document.body.dataset.role } }, [account?.role])
  async function signOut() { setBusy(true); setError(''); try { await logout() } catch (error) { setError(getErrorMessage(error, 'No se pudo cerrar la sesión.')) } finally { setBusy(false) } }
  return <div className={styles.layout} data-authenticated={!!account}>
    <a className={styles.skipLink} href="#main-content">Saltar al contenido</a>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><span className={styles.brandMark} aria-hidden="true">h&d</span><div><strong>H&D Boutique</strong><small>{account ? owner ? 'Panel de dueña' : 'Panel de colaborador' : 'Gestión de tu boutique'}</small></div></div>
      {account && <><button className={styles.menuToggle} type="button" aria-expanded={menuOpen} aria-controls="main-menu" onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" />Menú</button>
        <nav id="main-menu" className={styles.menu} data-open={menuOpen} aria-label="Navegación principal">{items.map(item => <NavLink key={item.path} to={item.path} className={({ isActive }) => isActive ? styles.active : undefined} onClick={() => setMenuOpen(false)}><Icon name={navigationIcons[item.path] ?? 'dashboard'} /><span>{item.label}</span></NavLink>)}</nav>
        <div className={styles.logout} data-open={menuOpen}><span className={styles.workspaceLabel}>H&D · Espacio de trabajo</span><button className="secondary" disabled={busy} onClick={() => void signOut()}><Icon name="logout" />Cerrar sesión</button></div></>}
    </aside>
    <main id="main-content" className={styles.main} tabIndex={-1}>
      <header className={styles.topbar}>{account && <><div className={styles.breadcrumb}><span>Mi boutique</span><span aria-hidden="true">/</span><b>{title}</b></div><div className={styles.identity}><span className={styles.avatar} aria-hidden="true">{(account.display_name ?? account.username).slice(0, 1).toLocaleUpperCase()}</span><div>{account.display_name ?? account.username}<small>{owner ? 'Dueña' : 'Colaborador'}</small></div></div></>}</header>
      <div className={styles.content}><div className={styles.pageHeading}><div><p className={styles.sectionLabel}>{owner ? 'ADMINISTRACIÓN' : 'MI ESPACIO'}</p><h1 ref={heading} tabIndex={-1}>{title}</h1></div>{account && <span className={styles.roleBadge}>{owner ? 'Panel de dueña' : 'Panel de colaborador'}</span>}</div>{error && <Message>{error}</Message>}
        <ModuleAccess>{<div key={account?.user_id}><Outlet /></div>}</ModuleAccess>
      </div>
    </main>
  </div>
}
