import { useEffect, useState } from 'react'
import {
  obtenerClientesReportes,
  obtenerComprasReportes,
  obtenerProductosReportes,
  obtenerProveedoresReportes,
  obtenerTiposClientesReportes,
  obtenerVentasReportes,
} from '../services/reportesService'
import './Reportes.css'

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

function obtenerPrecioUnitario(producto) {
  const precio = Number(producto.preciounitario ?? producto.precio_unitario ?? 0)

  return Number.isNaN(precio) ? 0 : precio
}

function obtenerTotalVenta(venta) {
  const total = Number(venta.total ?? 0)

  return Number.isNaN(total) ? 0 : total
}

function obtenerCostoEnvio(compra) {
  const costo = Number(compra.costodeenvio ?? 0)

  return Number.isNaN(costo) ? 0 : costo
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 2,
  }).format(valor)
}

function formatearFecha(fecha, textoVacio = 'Sin fecha') {
  return fecha || textoVacio
}

function estaEnRango(fecha, fechaInicio, fechaFin) {
  if (!fecha) {
    return false
  }

  if (fechaInicio && fecha < fechaInicio) {
    return false
  }

  if (fechaFin && fecha > fechaFin) {
    return false
  }

  return true
}

function obtenerIdCliente(cliente) {
  return cliente.id_cliente ?? cliente.id
}

function obtenerNombreCliente(idCliente, clientes) {
  const cliente = clientes.find((item) => {
    return String(obtenerIdCliente(item)) === String(idCliente)
  })

  if (!cliente) {
    return idCliente ? `Cliente #${idCliente}` : 'Sin cliente'
  }

  const nombres = cliente.nombres ?? cliente.nombre ?? ''
  const apellidos = cliente.apellidos ?? cliente.apellido ?? ''
  const nombreCompleto = `${nombres} ${apellidos}`.trim()

  return nombreCompleto || `Cliente #${idCliente}`
}

function obtenerIdProveedor(proveedor) {
  return proveedor.id_proveedor ?? proveedor.id
}

function obtenerNombreProveedor(idProveedor, proveedores) {
  const proveedor = proveedores.find((item) => {
    return String(obtenerIdProveedor(item)) === String(idProveedor)
  })

  if (!proveedor) {
    return idProveedor ? `Proveedor #${idProveedor}` : 'Sin proveedor'
  }

  return proveedor.nombreempresa ?? proveedor.nombre_empresa ?? `Proveedor #${idProveedor}`
}

function obtenerIdTipoCliente(tipoCliente) {
  return tipoCliente.id_tipo_cliente ?? tipoCliente.id_tipocliente ?? tipoCliente.id
}

function obtenerNombreTipoCliente(tipoCliente) {
  return (
    tipoCliente.nombre ??
    tipoCliente.nombre_tipo_cliente ??
    tipoCliente.tipo ??
    tipoCliente.descripcion ??
    `Tipo #${obtenerIdTipoCliente(tipoCliente)}`
  )
}

function obtenerNombreTipoPorId(idTipoCliente, tiposClientes) {
  const tipoCliente = tiposClientes.find((item) => {
    return String(obtenerIdTipoCliente(item)) === String(idTipoCliente)
  })

  return tipoCliente ? obtenerNombreTipoCliente(tipoCliente) : `Tipo #${idTipoCliente}`
}

function contarClientesPorTipo(clientes, tiposClientes) {
  const grupos = clientes.reduce((acumulador, cliente) => {
    const idTipoCliente = cliente.id_tipo_cliente ?? cliente.id_tipocliente ?? 'sin-tipo'
    const nombreTipo = idTipoCliente === 'sin-tipo'
      ? 'Sin tipo'
      : obtenerNombreTipoPorId(idTipoCliente, tiposClientes)

    acumulador[nombreTipo] = (acumulador[nombreTipo] ?? 0) + 1

    return acumulador
  }, {})

  return Object.entries(grupos).map(([tipo, total]) => ({ tipo, total }))
}

function Reportes() {
  const [productos, setProductos] = useState([])
  const [clientes, setClientes] = useState([])
  const [tiposClientes, setTiposClientes] = useState([])
  const [ventas, setVentas] = useState([])
  const [compras, setCompras] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [tipoReporte, setTipoReporte] = useState('ventas')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargarReportes() {
      try {
        const [
          productosData,
          clientesData,
          tiposClientesData,
          ventasData,
          comprasData,
          proveedoresData,
        ] = await Promise.all([
          obtenerProductosReportes(),
          obtenerClientesReportes(),
          obtenerTiposClientesReportes(),
          obtenerVentasReportes(),
          obtenerComprasReportes(),
          obtenerProveedoresReportes(),
        ])

        setProductos(obtenerLista(productosData))
        setClientes(obtenerLista(clientesData))
        setTiposClientes(obtenerLista(tiposClientesData))
        setVentas(obtenerLista(ventasData))
        setCompras(obtenerLista(comprasData))
        setProveedores(obtenerLista(proveedoresData))
      } catch (error) {
        console.error(error)
        setError('No se pudieron cargar los reportes')
      } finally {
        setCargando(false)
      }
    }

    cargarReportes()
  }, [])

  const ventasFiltradas = ventas
    .filter((venta) => estaEnRango(venta.fechaventa, fechaInicio, fechaFin))
    .sort((ventaA, ventaB) => {
      return String(ventaB.fechaventa ?? '').localeCompare(String(ventaA.fechaventa ?? ''))
    })
  const comprasFiltradas = compras
    .filter((compra) => estaEnRango(compra.fechacompra, fechaInicio, fechaFin))
    .sort((compraA, compraB) => {
      return String(compraB.fechacompra ?? '').localeCompare(String(compraA.fechacompra ?? ''))
    })
  const productosBajoStock = productos.filter((producto) => {
    return obtenerStock(producto) <= STOCK_BAJO_LIMITE
  })
  const clientesPorTipo = contarClientesPorTipo(clientes, tiposClientes)
  const totalVendidoFiltrado = ventasFiltradas.reduce((acumulador, venta) => {
    return acumulador + obtenerTotalVenta(venta)
  }, 0)
  const totalEnvioFiltrado = comprasFiltradas.reduce((acumulador, compra) => {
    return acumulador + obtenerCostoEnvio(compra)
  }, 0)

  if (cargando) {
    return (
      <div className="reportes-page">
        <div className="reportes-estado">Cargando reportes...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="reportes-page">
        <div className="reportes-estado error">{error}</div>
      </div>
    )
  }

  return (
    <div className="reportes-page">
      <div className="reportes-header">
        <div>
          <h2>Reportes</h2>
          <p>Analisis tabular por area, con filtros listos para graficos futuros.</p>
        </div>
      </div>

      <section className="reportes-filtros">
        <label htmlFor="tipo-reporte">
          <span>Tipo de reporte</span>
          <select
            id="tipo-reporte"
            value={tipoReporte}
            onChange={(event) => setTipoReporte(event.target.value)}
          >
            <option value="ventas">Ventas</option>
            <option value="compras">Compras</option>
            <option value="inventario">Inventario</option>
            <option value="clientes">Clientes</option>
          </select>
        </label>

        <label htmlFor="fecha-inicio">
          <span>Desde</span>
          <input
            id="fecha-inicio"
            type="date"
            value={fechaInicio}
            onChange={(event) => setFechaInicio(event.target.value)}
          />
        </label>

        <label htmlFor="fecha-fin">
          <span>Hasta</span>
          <input
            id="fecha-fin"
            type="date"
            value={fechaFin}
            onChange={(event) => setFechaFin(event.target.value)}
          />
        </label>

        <button
          className="reportes-boton-secundario"
          type="button"
          onClick={() => {
            setFechaInicio('')
            setFechaFin('')
          }}
        >
          Limpiar fechas
        </button>
      </section>

      <div className="reportes-kpis">
        <div className="reportes-kpi principal">
          <span>Ventas filtradas</span>
          <strong>{formatearMoneda(totalVendidoFiltrado)}</strong>
        </div>

        <div className="reportes-kpi">
          <span>Compras filtradas</span>
          <strong>{comprasFiltradas.length}</strong>
        </div>

        <div className="reportes-kpi">
          <span>Productos bajo stock</span>
          <strong>{productosBajoStock.length}</strong>
        </div>

        <div className="reportes-kpi">
          <span>Clientes registrados</span>
          <strong>{clientes.length}</strong>
        </div>
      </div>

      <section className="reportes-analisis">
        <aside className="reportes-insight">
          <span>Resumen del filtro</span>
          <strong>
            {tipoReporte === 'ventas' && `${ventasFiltradas.length} ventas`}
            {tipoReporte === 'compras' && `${comprasFiltradas.length} compras`}
            {tipoReporte === 'inventario' && `${productosBajoStock.length} alertas`}
            {tipoReporte === 'clientes' && `${clientesPorTipo.length} tipos`}
          </strong>
          <p>
            {tipoReporte === 'ventas' &&
              `Total vendido en el rango: ${formatearMoneda(totalVendidoFiltrado)}.`}
            {tipoReporte === 'compras' &&
              `Costo de envio acumulado: ${formatearMoneda(totalEnvioFiltrado)}.`}
            {tipoReporte === 'inventario' &&
              `Productos con stock menor o igual a ${STOCK_BAJO_LIMITE}.`}
            {tipoReporte === 'clientes' &&
              'Distribucion de clientes segun el tipo registrado en el sistema.'}
          </p>
          <div className="reportes-chart-slot">
            <span>Area para grafico</span>
          </div>
        </aside>

        <div className="reportes-panel">
          {tipoReporte === 'ventas' && (
            <>
              <div className="reportes-panel-header">
                <div>
                  <h3>Reporte de ventas</h3>
                  <span>Filtrado por fecha de venta</span>
                </div>
              </div>

              {ventasFiltradas.length === 0 ? (
                <div className="reportes-estado">No hay ventas en el rango seleccionado.</div>
              ) : (
                <div className="reportes-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID venta</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ventasFiltradas.map((venta) => (
                        <tr key={venta.id_venta}>
                          <td>{venta.id_venta}</td>
                          <td>{formatearFecha(venta.fechaventa)}</td>
                          <td>{obtenerNombreCliente(venta.id_cliente, clientes)}</td>
                          <td>{formatearMoneda(obtenerTotalVenta(venta))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tipoReporte === 'compras' && (
            <>
              <div className="reportes-panel-header">
                <div>
                  <h3>Reporte de compras</h3>
                  <span>Filtrado por fecha de compra</span>
                </div>
              </div>

              {comprasFiltradas.length === 0 ? (
                <div className="reportes-estado">No hay compras en el rango seleccionado.</div>
              ) : (
                <div className="reportes-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID compra</th>
                        <th>Fecha compra</th>
                        <th>Proveedor</th>
                        <th>Costo de envio</th>
                      </tr>
                    </thead>

                    <tbody>
                      {comprasFiltradas.map((compra) => (
                        <tr key={compra.id_compra}>
                          <td>{compra.id_compra}</td>
                          <td>{formatearFecha(compra.fechacompra)}</td>
                          <td>{obtenerNombreProveedor(compra.id_proveedor, proveedores)}</td>
                          <td>{formatearMoneda(obtenerCostoEnvio(compra))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tipoReporte === 'inventario' && (
            <>
              <div className="reportes-panel-header">
                <div>
                  <h3>Reporte de inventario</h3>
                  <span>Productos bajo stock y precio actual</span>
                </div>
              </div>

              {productosBajoStock.length === 0 ? (
                <div className="reportes-estado">No hay productos bajo stock.</div>
              ) : (
                <div className="reportes-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID producto</th>
                        <th>Producto</th>
                        <th>Stock actual</th>
                        <th>Precio unitario</th>
                      </tr>
                    </thead>

                    <tbody>
                      {productosBajoStock.map((producto) => (
                        <tr key={producto.id_producto}>
                          <td>{producto.id_producto}</td>
                          <td className="reportes-texto-fuerte">
                            {producto.nombre || 'Sin nombre'}
                          </td>
                          <td>
                            <span className="reportes-badge warning">
                              {obtenerStock(producto)}
                            </span>
                          </td>
                          <td>{formatearMoneda(obtenerPrecioUnitario(producto))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tipoReporte === 'clientes' && (
            <>
              <div className="reportes-panel-header">
                <div>
                  <h3>Reporte de clientes</h3>
                  <span>Total y distribucion por tipo</span>
                </div>
              </div>

              <div className="reportes-clientes-resumen">
                <div>
                  <span>Total clientes</span>
                  <strong>{clientes.length}</strong>
                </div>
              </div>

              {clientesPorTipo.length === 0 ? (
                <div className="reportes-estado">No hay clientes registrados.</div>
              ) : (
                <div className="reportes-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Tipo de cliente</th>
                        <th>Total clientes</th>
                        <th>Participacion</th>
                      </tr>
                    </thead>

                    <tbody>
                      {clientesPorTipo.map((item) => {
                        const porcentaje = clientes.length > 0
                          ? (item.total / clientes.length) * 100
                          : 0

                        return (
                          <tr key={item.tipo}>
                            <td className="reportes-texto-fuerte">{item.tipo}</td>
                            <td>{item.total}</td>
                            <td>{porcentaje.toFixed(1)}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}

export default Reportes
