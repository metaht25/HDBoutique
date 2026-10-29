import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { navigation } from '../app/navigation'
import { SessionStatus } from '../features/session/SessionStatus'
import styles from './MainLayout.module.css'

export function MainLayout() {
  const location = useLocation()
  const title = navigation.find(item => item.path === location.pathname)?.label ?? 'Página no encontrada'
  const heading = useRef<HTMLHeadingElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    document.title = `${title} | H&D Boutique`
    heading.current?.focus()
    window.scrollTo(0, 0)
  }, [title, location.pathname])

  return <div className={styles.layout}>
    <a className={styles.skipLink} href="#main-content">Saltar al contenido</a>
    <aside className={styles.sidebar}>
      <div className={styles.brand}>H&D Boutique</div>
      <button className={styles.menuToggle} type="button" aria-expanded={menuOpen}
        aria-controls="main-menu" onClick={() => setMenuOpen(!menuOpen)}>Menú</button>
      <nav id="main-menu" className={styles.menu} data-open={menuOpen} aria-label="Navegación principal">
        {navigation.map(item => <NavLink key={item.path} to={item.path}
          className={({ isActive }) => isActive ? styles.active : undefined}
          onClick={() => setMenuOpen(false)}>{item.label}</NavLink>)}
      </nav>
    </aside>
    <main id="main-content" className={styles.main} tabIndex={-1}>
      <header className={styles.topbar}>
        <h1 ref={heading} tabIndex={-1}>{title}</h1>
        <SessionStatus />
      </header>
      <div className={styles.content}><Outlet /></div>
    </main>
  </div>
}
