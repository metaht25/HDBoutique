import { useEffect, useState } from 'react'
import {
  obtenerClientesDashboard,
  obtenerComprasDashboard,
  obtenerProductosDashboard,
  obtenerProveedoresDashboard,
  obtenerVentasDashboard,
} from '../services/dashboardService'
import './Dashboard.css'

const STOCK_BAJO_LIMITE = 10

function obtenerLista(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.results)) {
    return data.results
  }

  return []
}

function obtenerStock(producto) {
  const stock = Number(producto.stock ?? producto.cantidadstock ?? 0)

  return Number.isNaN(stock) ? 0 : stock
}

function obtenerTotalVenta(venta) {
  const total = Number(venta.total ?? 0)

  return Number.isNaN(total) ? 0 : total
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 2,
  }).format(valor)
}

function formatearFecha(fecha) {
  return fecha || 'Sin fecha'
}

function Dashboard() {
  const [productos, setProductos] = useState([])
  const [clientes, setClientes] = useState([])
  const [ventas, setVentas] = useState([])
  const [compras, setCompras] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargarDashboard() {
      try {
        const [
          productosData,
          clientesData,
          ventasData,
          comprasData,
          proveedoresData,
        ] = await Promise.all([
          obtenerProductosDashboard(),
          obtenerClientesDashboard(),
          obtenerVentasDashboard(),
          obtenerComprasDashboard(),
          obtenerProveedoresDashboard(),
        ])

        setProductos(obtenerLista(productosData))
        setClientes(obtenerLista(clientesData))
        setVentas(obtenerLista(ventasData))
        setCompras(obtenerLista(comprasData))
        setProveedores(obtenerLista(proveedoresData))
      } catch (error) {
        console.error(error)
        setError('No se pudieron cargar los datos del dashboard')
      } finally {
        setCargando(false)
      }
    }

    cargarDashboard()
  }, [])

  const productosBajoStock = productos.filter((producto) => {
    return obtenerStock(producto) <= STOCK_BAJO_LIMITE
  })
  const totalVendido = ventas.reduce((acumulador, venta) => {
    return acumulador + obtenerTotalVenta(venta)
  }, 0)
  const ultimasVentas = [...ventas]
    .sort((ventaA, ventaB) => {
      return String(ventaB.fechaventa ?? '').localeCompare(String(ventaA.fechaventa ?? ''))
    })
    .slice(0, 5)
  const productosBajoStockTabla = productosBajoStock.slice(0, 5)

  if (cargando) {
    return (
      <div className="dashboard">
        <div className="dashboard-estado">Cargando dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="dashboard-estado error">{error}</div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h2>Resumen general</h2>
          <p>Indicadores principales de inventario, clientes y operaciones.</p>
        </div>
      </div>

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <span>Total productos</span>
          <strong>{productos.length}</strong>
        </div>

        <div className="dashboard-card">
          <span>Total clientes</span>
          <strong>{clientes.length}</strong>
        </div>

        <div className="dashboard-card">
          <span>Total ventas</span>
          <strong>{ventas.length}</strong>
        </div>

        <div className="dashboard-card">
          <span>Total proveedores</span>
          <strong>{proveedores.length}</strong>
        </div>

        <div className="dashboard-card">
          <span>Total vendido</span>
          <strong>{formatearMoneda(totalVendido)}</strong>
        </div>

        <div className="dashboard-card alerta">
          <span>Productos bajo stock</span>
          <strong>{productosBajoStock.length}</strong>
        </div>
      </div>

      <div className="dashboard-secondary-cards">
        <div className="dashboard-secondary-card">
          <span>Compras registradas</span>
          <strong>{compras.length}</strong>
        </div>
      </div>

      <div className="dashboard-tables">
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Últimas ventas</h3>
            <span>{ventas.length} ventas registradas</span>
          </div>

          {ultimasVentas.length === 0 ? (
            <div className="dashboard-estado">No hay ventas registradas.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID venta</th>
                  <th>Fecha</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {ultimasVentas.map((venta) => (
                  <tr key={venta.id_venta}>
                    <td>{venta.id_venta}</td>
                    <td>{formatearFecha(venta.fechaventa)}</td>
                    <td>{formatearMoneda(obtenerTotalVenta(venta))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Productos bajo stock</h3>
            <span>Stock menor o igual a {STOCK_BAJO_LIMITE}</span>
          </div>

          {productosBajoStockTabla.length === 0 ? (
            <div className="dashboard-estado">No hay productos bajo stock.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Producto</th>
                  <th>Stock</th>
                </tr>
              </thead>

              <tbody>
                {productosBajoStockTabla.map((producto) => (
                  <tr key={producto.id_producto}>
                    <td>{producto.id_producto}</td>
                    <td className="dashboard-producto">{producto.nombre || 'Sin nombre'}</td>
                    <td>
                      <span className="dashboard-badge warning">
                        {obtenerStock(producto)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

    </div>
  )
}

export default Dashboard
