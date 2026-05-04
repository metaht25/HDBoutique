import { useEffect, useState } from 'react'
import { obtenerProductos } from '../services/productosService'
import './Productos.css'

const STOCK_BAJO_LIMITE = 10

function obtenerListaProductos(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.results)) {
    return data.results
  }

  return []
}

function obtenerStock(producto) {
  return Number(producto.cantidadstock ?? producto.stock ?? 0)
}

function formatearPrecio(precio) {
  const valor = Number(precio ?? 0)

  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 2,
  }).format(Number.isNaN(valor) ? 0 : valor)
}

function Productos() {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  useEffect(() => {
    async function cargarProductos() {
      try {
        const data = await obtenerProductos()
        setProductos(obtenerListaProductos(data))
      } catch (error) {
        console.error(error)
        setError('No se pudieron cargar los productos')
      } finally {
        setCargando(false)
      }
    }

    cargarProductos()
  }, [])

  const totalProductos = productos.length

  const totalStock = productos.reduce((acumulador, producto) => {
    return acumulador + obtenerStock(producto)
  }, 0)

  const productosBajoStock = productos.filter((producto) => {
    const stock = obtenerStock(producto)

    return stock > 0 && stock <= STOCK_BAJO_LIMITE
  }).length

  const terminoBusqueda = busqueda.trim().toLowerCase()
  const productosFiltrados = productos.filter((producto) => {
    const nombreCoincide = terminoBusqueda
      ? String(producto.nombre ?? '').toLowerCase().includes(terminoBusqueda)
      : true
    const stock = obtenerStock(producto)
    const bajoStock = stock > 0 && stock <= STOCK_BAJO_LIMITE
    const disponible = stock > STOCK_BAJO_LIMITE
    const estadoCoincide =
      filtroEstado === 'todos' ||
      (filtroEstado === 'disponibles' && disponible) ||
      (filtroEstado === 'bajo-stock' && bajoStock)

    return nombreCoincide && estadoCoincide
  })

  if (cargando) {
    return (
      <div className="productos-page">
        <div className="productos-estado">Cargando productos...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="productos-page">
        <div className="productos-estado error">{error}</div>
      </div>
    )
  }

  return (
    <div className="productos-page">
      <div className="productos-header">
        <div>
          <h2>Productos e inventario</h2>
          <p>Listado general de productos registrados en inventario.</p>
        </div>
      </div>

      <div className="productos-toolbar">
        <label className="buscador-productos" htmlFor="buscar-productos">
          <span>Buscar producto</span>
          <input
            id="buscar-productos"
            type="search"
            placeholder="Nombre del producto"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </label>

        <div className="filtro-productos" aria-label="Filtrar productos por estado">
          <button
            className={filtroEstado === 'todos' ? 'activo' : ''}
            type="button"
            onClick={() => setFiltroEstado('todos')}
          >
            Todos
          </button>

          <button
            className={filtroEstado === 'disponibles' ? 'activo' : ''}
            type="button"
            onClick={() => setFiltroEstado('disponibles')}
          >
            Disponibles
          </button>

          <button
            className={filtroEstado === 'bajo-stock' ? 'activo' : ''}
            type="button"
            onClick={() => setFiltroEstado('bajo-stock')}
          >
            Bajo stock
          </button>
        </div>
      </div>

      <div className="productos-resumen">
        <div className="resumen-card">
          <span>Total productos</span>
          <strong>{totalProductos}</strong>
        </div>

        <div className="resumen-card">
          <span>Stock total</span>
          <strong>{totalStock}</strong>
        </div>

        <div className="resumen-card alerta">
          <span>Productos bajo stock</span>
          <strong>{productosBajoStock}</strong>
        </div>
      </div>

      <div className="table-container">
        {productosFiltrados.length === 0 ? (
          <div className="productos-estado">
            {productos.length === 0
              ? 'No hay productos registrados.'
              : 'No se encontraron productos con esos filtros.'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Producto</th>
                <th>Precio unitario</th>
                <th>Stock</th>
                <th>Estado</th>
              </tr>
            </thead>

            <tbody>
              {productosFiltrados.map((producto) => {
                const stock = obtenerStock(producto)
                const agotado = stock <= 0
                const bajoStock = stock > 0 && stock <= STOCK_BAJO_LIMITE
                const estadoClase = agotado ? 'danger' : bajoStock ? 'warning' : 'success'
                const estadoTexto = agotado
                  ? 'Agotado'
                  : bajoStock
                    ? 'Bajo stock'
                    : 'Disponible'

                return (
                  <tr key={producto.id_producto}>
                    <td>{producto.id_producto}</td>
                    <td className="producto-nombre">{producto.nombre || 'Sin nombre'}</td>
                    <td>{formatearPrecio(producto.preciounitario)}</td>
                    <td>{stock}</td>
                    <td>
                      <span className={`badge ${estadoClase}`}>
                        {estadoTexto}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Productos
