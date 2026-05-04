import { useState } from 'react'
import Dashboard from '../pages/Dashboard'
import Productos from '../pages/Productos'
import './MainLayout.css'

function MainLayout() {
  const [paginaActual, setPaginaActual] = useState('dashboard')

  function mostrarPagina() {
    if (paginaActual === 'dashboard') {
      return <Dashboard />
    }

    if (paginaActual === 'productos') {
      return <Productos />
    }

    return <Dashboard />
  }

  function obtenerTitulo() {
    if (paginaActual === 'dashboard') {
      return 'Dashboard'
    }

    if (paginaActual === 'productos') {
      return 'Productos'
    }

    return 'Dashboard'
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>H&D Boutique</h2>

        <nav className="menu">
          <button onClick={() => setPaginaActual('dashboard')}>
            Dashboard
          </button>

          <button onClick={() => setPaginaActual('productos')}>
            Productos
          </button>

          <button>Clientes</button>
          <button>Ventas</button>
          <button>Compras</button>
          <button>Proveedores</button>
          <button>Caja</button>
          <button>Reportes</button>
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <h1>{obtenerTitulo()}</h1>
          <span>Usuario administrador</span>
        </header>

        <section className="content">
          {mostrarPagina()}
        </section>
      </main>
    </div>
  )
}

export default MainLayout