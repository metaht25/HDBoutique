import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { collaboratorOrder, navigation } from '../app/navigation'
import { useSession } from '../features/session/sessionContext'
import { ModuleAccess } from '../features/session/ModuleAccess'
import { getErrorMessage } from '../shared/api/errors'
import { Message } from '../shared/ui/Feedback'
import styles from './MainLayout.module.css'

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
      <div className={styles.brand}><strong>H&D Boutique</strong><small>{account ? owner ? 'Panel de dueña' : 'Panel de colaborador' : 'Gestión de tu boutique'}</small></div>
      {account && <><button className={styles.menuToggle} type="button" aria-expanded={menuOpen} aria-controls="main-menu" onClick={() => setMenuOpen(!menuOpen)}>Menú</button>
        <nav id="main-menu" className={styles.menu} data-open={menuOpen} aria-label="Navegación principal">{items.map(item => <NavLink key={item.path} to={item.path} className={({ isActive }) => isActive ? styles.active : undefined} onClick={() => setMenuOpen(false)}>{item.label}</NavLink>)}</nav>
        <div className={styles.logout} data-open={menuOpen}><button className="secondary" disabled={busy} onClick={() => void signOut()}>Cerrar sesión</button></div></>}
    </aside>
    <main id="main-content" className={styles.main} tabIndex={-1}>
      <header className={styles.topbar}>{account && (owner ? <div className={styles.identity}>Dueña<small>{account.display_name ?? account.username}</small></div> : <div className={styles.identity}>{account.display_name ?? account.username}<small>Colaborador</small></div>)}</header>
      <div className={styles.content}><h1 ref={heading} tabIndex={-1}>{title}</h1>{error && <Message>{error}</Message>}
        <ModuleAccess>{<div key={account?.user_id}><Outlet /></div>}</ModuleAccess>
      </div>
    </main>
  </div>
}
