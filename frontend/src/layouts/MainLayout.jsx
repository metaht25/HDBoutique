import { useState } from 'react'
import Clientes from '../pages/Clientes'
import Compras from '../pages/Compras'
import Dashboard from '../pages/Dashboard'
import Productos from '../pages/Productos'
import Proveedores from '../pages/Proveedores'
import Ventas from '../pages/Ventas'
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

    if (paginaActual === 'clientes') {
      return <Clientes />
    }

    if (paginaActual === 'ventas') {
      return <Ventas />
    }

    if (paginaActual === 'compras') {
      return <Compras />
    }

    if (paginaActual === 'proveedores') {
      return <Proveedores />
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

    if (paginaActual === 'clientes') {
      return 'Clientes'
    }

    if (paginaActual === 'ventas') {
      return 'Ventas'
    }

    if (paginaActual === 'compras') {
      return 'Compras'
    }

    if (paginaActual === 'proveedores') {
      return 'Proveedores'
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

          <button onClick={() => setPaginaActual('clientes')}>
            Clientes
          </button>
          <button onClick={() => setPaginaActual('ventas')}>
            Ventas
          </button>
          <button onClick={() => setPaginaActual('compras')}>
            Compras
          </button>
          <button onClick={() => setPaginaActual('proveedores')}>
            Proveedores
          </button>
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
