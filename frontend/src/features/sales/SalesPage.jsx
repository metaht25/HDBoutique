import { TableContainer } from '../../shared/ui/TableContainer'
import { LoadingState, Message } from '../../shared/ui/Feedback'
import { ApiError, getErrorMessage } from '../../shared/api/errors'
import { useEffect, useState } from 'react'
import {
  crearDetalleVenta,
  crearVenta,
  obtenerClientesVentas,
  obtenerDetallesVentas,
  obtenerEmpleadosVentas,
  obtenerProductosVentas,
  obtenerVentas,
} from './legacyApi.js'
import styles from './SalesPage.module.css'

function obtenerLista(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.results)) {
    return data.results
  }

  return []
}

function obtenerIdCliente(cliente) {
  return cliente.id_cliente ?? cliente.id_persona ?? cliente.id
}

function obtenerNombrePersona(persona) {
  const nombres = persona.nombres ?? persona.nombre ?? persona.primer_nombre ?? ''
  const apellidos = persona.apellidos ?? persona.apellido ?? persona.primer_apellido ?? ''
  const nombreCompleto = `${nombres} ${apellidos}`.trim()

  return nombreCompleto || 'Sin nombre'
}

function obtenerIdEmpleado(empleado) {
  return empleado.id_empleado ?? empleado.id_persona ?? empleado.id
}

function obtenerNombreCliente(idCliente, clientes) {
  const cliente = clientes.find((item) => {
    return String(obtenerIdCliente(item)) === String(idCliente)
  })

  return cliente ? obtenerNombrePersona(cliente) : `Cliente #${idCliente}`
}

function obtenerNombreEmpleado(idEmpleado, empleados) {
  const empleado = empleados.find((item) => {
    return String(obtenerIdEmpleado(item)) === String(idEmpleado)
  })

  return empleado ? obtenerNombrePersona(empleado) : `Empleado #${idEmpleado}`
}

function obtenerFechaVenta(venta) {
  return venta.fechaventa ?? venta.fecha_venta ?? venta.fecha ?? ''
}

function obtenerTotalVenta(venta) {
  const total = Number(venta.total ?? 0)

  return Number.isNaN(total) ? 0 : total
}

function obtenerIdProducto(producto) {
  return producto.id_producto ?? producto.id
}

function obtenerNombreProducto(idProducto, productos) {
  const producto = productos.find((item) => {
    return String(obtenerIdProducto(item)) === String(idProducto)
  })

  return producto ? producto.nombre ?? `Producto #${idProducto}` : `Producto #${idProducto}`
}

function obtenerCantidadDetalle(detalle) {
  const cantidad = Number(detalle.cantidad ?? 0)

  return Number.isNaN(cantidad) ? 0 : cantidad
}

function obtenerPrecioDetalle(detalle) {
  const precio = Number(detalle.preciounitario ?? 0)

  return Number.isNaN(precio) ? 0 : precio
}

function obtenerPrecioProducto(producto) {
  const precio = Number(producto.preciounitario ?? 0)

  return Number.isNaN(precio) ? 0 : precio
}

function obtenerStock(producto) {
  const stock = Number(producto.stock ?? producto.cantidadstock ?? 0)

  return Number.isNaN(stock) ? 0 : stock
}

function formatearFecha(fecha) {
  if (!fecha) {
    return 'Sin fecha'
  }

  return fecha
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 2,
  }).format(valor)
}

function esMismaFecha(fechaVenta, fechaReferencia) {
  if (!fechaVenta || !fechaReferencia) {
    return false
  }

  return fechaVenta.slice(0, 10) === fechaReferencia
}

function esMismoMes(fechaVenta, fechaReferencia) {
  if (!fechaVenta || !fechaReferencia) {
    return false
  }

  return fechaVenta.slice(0, 7) === fechaReferencia.slice(0, 7)
}

function Ventas() {
  const [ventas, setVentas] = useState([])
  const [detallesVentas, setDetallesVentas] = useState([])
  const [clientes, setClientes] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fechaFiltro, setFechaFiltro] = useState('')
  const [ventaSeleccionadaId, setVentaSeleccionadaId] = useState(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [formularioVenta, setFormularioVenta] = useState({
    fechaventa: new Date().toISOString().slice(0, 10),
    id_cliente: '',
    id_empleado: '',
    id_producto: '',
    cantidad: '',
  })
  const [productosVenta, setProductosVenta] = useState([])
  const [erroresFormulario, setErroresFormulario] = useState([])
  const [guardandoVenta, setGuardandoVenta] = useState(false)

  useEffect(() => {
    async function cargarVentas() {
      try {
        const [
          ventasData,
          clientesData,
          empleadosData,
          detallesVentasData,
          productosData,
        ] = await Promise.all([
          obtenerVentas(),
          obtenerClientesVentas(),
          obtenerEmpleadosVentas(),
          obtenerDetallesVentas(),
          obtenerProductosVentas(),
        ])

        setVentas(obtenerLista(ventasData))
        setClientes(obtenerLista(clientesData))
        setEmpleados(obtenerLista(empleadosData))
        setDetallesVentas(obtenerLista(detallesVentasData))
        setProductos(obtenerLista(productosData))
      } catch (error) {

        setError(getErrorMessage(error, 'No se pudieron cargar las ventas'))
      } finally {
        setCargando(false)
      }
    }

    cargarVentas()
  }, [])

  async function cargarDatosVentas() {
    const [
      ventasData,
      clientesData,
      empleadosData,
      detallesVentasData,
      productosData,
    ] = await Promise.all([
      obtenerVentas(),
      obtenerClientesVentas(),
      obtenerEmpleadosVentas(),
      obtenerDetallesVentas(),
      obtenerProductosVentas(),
    ])

    setVentas(obtenerLista(ventasData))
    setClientes(obtenerLista(clientesData))
    setEmpleados(obtenerLista(empleadosData))
    setDetallesVentas(obtenerLista(detallesVentasData))
    setProductos(obtenerLista(productosData))
  }

  const fechaActual = new Date().toISOString().slice(0, 10)
  const totalVentas = ventas.length
  const ventasDelDia = ventas.filter((venta) => {
    return esMismaFecha(obtenerFechaVenta(venta), fechaActual)
  }).length
  const ventasDelMes = ventas.filter((venta) => {
    return esMismoMes(obtenerFechaVenta(venta), fechaActual)
  }).length
  const totalVendido = ventas.reduce((acumulador, venta) => {
    return acumulador + obtenerTotalVenta(venta)
  }, 0)

  const terminoBusqueda = busqueda.trim().toLowerCase()
  const ventasFiltradas = ventas.filter((venta) => {
    const nombreCliente = obtenerNombreCliente(venta.id_cliente, clientes).toLowerCase()
    const idVenta = String(venta.id_venta ?? '')
    const coincideBusqueda = terminoBusqueda
      ? nombreCliente.includes(terminoBusqueda) || idVenta.includes(terminoBusqueda)
      : true
    const coincideFecha = fechaFiltro
      ? esMismaFecha(obtenerFechaVenta(venta), fechaFiltro)
      : true

    return coincideBusqueda && coincideFecha
  })

  const ventaSeleccionada = ventas.find((venta) => {
    return String(venta.id_venta) === String(ventaSeleccionadaId)
  })
  const detallesVentaSeleccionada = ventaSeleccionadaId
    ? detallesVentas.filter((detalle) => {
        return String(detalle.id_venta) === String(ventaSeleccionadaId)
      })
    : []
  const totalDetalleSeleccionado = detallesVentaSeleccionada.reduce((acumulador, detalle) => {
    return acumulador + obtenerCantidadDetalle(detalle) * obtenerPrecioDetalle(detalle)
  }, 0)
  const productoSeleccionado = productos.find((producto) => {
    return String(obtenerIdProducto(producto)) === String(formularioVenta.id_producto)
  })
  const totalNuevaVenta = productosVenta.reduce((acumulador, producto) => {
    return acumulador + producto.subtotal
  }, 0)

  function alternarDetalleVenta(idVenta) {
    setVentaSeleccionadaId((idActual) => {
      return String(idActual) === String(idVenta) ? null : idVenta
    })
  }

  function actualizarFormulario(campo, valor) {
    setFormularioVenta((formularioActual) => ({
      ...formularioActual,
      [campo]: valor,
    }))
    setErroresFormulario([])
  }

  function cambiarClienteVenta(idCliente) {
    if (productosVenta.length > 0 && idCliente !== formularioVenta.id_cliente) {
      const confirmarCambio = window.confirm(
        'Cambiar el cliente limpiara los productos agregados a esta venta. Desea continuar?',
      )

      if (!confirmarCambio) {
        return
      }

      setProductosVenta([])
    }

    actualizarFormulario('id_cliente', idCliente)
  }

  function agregarProductoVenta() {
    const errores = []
    const producto = productoSeleccionado
    const cantidad = Number(formularioVenta.cantidad)

    if (!producto) {
      errores.push('Seleccione un producto.')
    }

    if (!formularioVenta.cantidad || Number.isNaN(cantidad) || cantidad <= 0) {
      errores.push('La cantidad debe ser mayor que 0.')
    }

    if (producto && cantidad > obtenerStock(producto)) {
      errores.push('La cantidad no puede ser mayor que el stock disponible.')
    }

    const productoYaAgregado = productosVenta.some((item) => {
      return String(item.id_producto) === String(obtenerIdProducto(producto ?? {}))
    })

    if (productoYaAgregado) {
      errores.push('Este producto ya fue agregado a la venta.')
    }

    if (errores.length > 0) {
      setErroresFormulario(errores)
      return
    }

    const precioUnitario = obtenerPrecioProducto(producto)
    const productoVenta = {
      id_producto: obtenerIdProducto(producto),
      nombre: producto.nombre ?? `Producto #${obtenerIdProducto(producto)}`,
      stock: obtenerStock(producto),
      cantidad,
      preciounitario: precioUnitario,
      subtotal: cantidad * precioUnitario,
    }

    setProductosVenta((productosActuales) => [...productosActuales, productoVenta])
    setFormularioVenta((formularioActual) => ({
      ...formularioActual,
      id_producto: '',
      cantidad: '',
    }))
    setErroresFormulario([])
  }

  function quitarProductoVenta(idProducto) {
    setProductosVenta((productosActuales) => {
      return productosActuales.filter((producto) => {
        return String(producto.id_producto) !== String(idProducto)
      })
    })
  }

  function validarVenta() {
    const errores = []

    if (!formularioVenta.fechaventa) {
      errores.push('La fecha de venta es obligatoria.')
    }

    if (!formularioVenta.id_cliente) {
      errores.push('Seleccione un cliente.')
    }

    if (!formularioVenta.id_empleado) {
      errores.push('Seleccione un empleado o cajero.')
    }

    if (productosVenta.length === 0) {
      errores.push('Agregue al menos un producto a la venta.')
    }

    return errores
  }

  function obtenerIdVentaCreada(ventaCreada) {
    return ventaCreada.id_venta ?? ventaCreada.id
  }

  async function guardarNuevaVenta(event) {
    event.preventDefault()

    const errores = validarVenta()

    if (errores.length > 0) {
      setErroresFormulario(errores)
      return
    }

    setGuardandoVenta(true)
    setErroresFormulario([])

    try {
      const ventaCreada = await crearVenta({
        fechaventa: formularioVenta.fechaventa,
        total: totalNuevaVenta,
        id_cliente: formularioVenta.id_cliente,
        id_empleado: formularioVenta.id_empleado,
      })
      const idVentaCreada = obtenerIdVentaCreada(ventaCreada)

      if (!idVentaCreada) {
        throw new ApiError(502, 'invalid_response', 'La venta se creo, pero no se recibio el ID de venta.')
      }

      for (const producto of productosVenta) {
        await crearDetalleVenta({
          cantidad: producto.cantidad,
          preciounitario: producto.preciounitario,
          id_venta: idVentaCreada,
          id_producto: producto.id_producto,
        })
      }

      await cargarDatosVentas()
      setFormularioVenta({
        fechaventa: new Date().toISOString().slice(0, 10),
        id_cliente: '',
        id_empleado: '',
        id_producto: '',
        cantidad: '',
      })
      setProductosVenta([])
      setMostrarFormulario(false)
      setVentaSeleccionadaId(idVentaCreada)
    } catch (error) {

      setErroresFormulario([
        getErrorMessage(error, 'No se pudo guardar la venta. Revise los datos e intente nuevamente.'),
      ])
    } finally {
      setGuardandoVenta(false)
    }
  }

  if (cargando) {
    return (
      <div className="ventas-page">
        <LoadingState>Cargando ventas...</LoadingState>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ventas-page">
        <Message>{error}</Message>
      </div>
    )
  }

  return (
    <div className="ventas-page">
      <div className="ventas-header">
        <div>
          <h2>Ventas</h2>
          <p>Listado general de ventas registradas.</p>
        </div>

        <button
          className="nueva-venta-button"
          type="button"
          onClick={() => setMostrarFormulario((valorActual) => !valorActual)}
        >
          {mostrarFormulario ? 'Ocultar formulario' : 'Nueva venta'}
        </button>
      </div>

      <div className="ventas-resumen">
        <div className="resumen-card">
          <span>Total ventas registradas</span>
          <strong>{totalVentas}</strong>
        </div>

        <div className="resumen-card">
          <span>Ventas del dia</span>
          <strong>{ventasDelDia}</strong>
        </div>

        <div className="resumen-card">
          <span>Ventas del mes</span>
          <strong>{ventasDelMes}</strong>
        </div>

        <div className="resumen-card">
          <span>Total vendido</span>
          <strong>{formatearMoneda(totalVendido)}</strong>
        </div>
      </div>

      {mostrarFormulario && (
        <section className="nueva-venta-panel">
          <div className="nueva-venta-header">
            <div>
              <h3>Nueva venta</h3>
              <span>Seleccione cliente, cajero y productos para registrar la venta.</span>
            </div>

            <strong>{formatearMoneda(totalNuevaVenta)}</strong>
          </div>

          <form className="nueva-venta-form" onSubmit={guardarNuevaVenta}>
            {erroresFormulario.length > 0 && (
              <div className="ventas-form-errors">
                {erroresFormulario.map((mensaje) => (
                  <p key={mensaje}>{mensaje}</p>
                ))}
              </div>
            )}

            <div className="venta-form-grid">
              <label htmlFor="venta-fecha">
                <span>Fecha de venta</span>
                <input
                  id="venta-fecha"
                  type="date"
                  value={formularioVenta.fechaventa}
                  onChange={(event) => actualizarFormulario('fechaventa', event.target.value)}
                />
              </label>

              <label htmlFor="venta-cliente">
                <span>Cliente</span>
                <select
                  id="venta-cliente"
                  value={formularioVenta.id_cliente}
                  onChange={(event) => cambiarClienteVenta(event.target.value)}
                >
                  <option value="">Seleccione un cliente</option>
                  {clientes.map((cliente) => (
                    <option key={obtenerIdCliente(cliente)} value={obtenerIdCliente(cliente)}>
                      {obtenerNombrePersona(cliente)}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="venta-empleado">
                <span>Empleado/Cajero</span>
                <select
                  id="venta-empleado"
                  value={formularioVenta.id_empleado}
                  onChange={(event) => actualizarFormulario('id_empleado', event.target.value)}
                >
                  <option value="">Seleccione un empleado</option>
                  {empleados.map((empleado) => (
                    <option key={obtenerIdEmpleado(empleado)} value={obtenerIdEmpleado(empleado)}>
                      {obtenerNombrePersona(empleado)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="venta-producto-grid">
              <label htmlFor="venta-producto">
                <span>Producto</span>
                <select
                  id="venta-producto"
                  value={formularioVenta.id_producto}
                  onChange={(event) => actualizarFormulario('id_producto', event.target.value)}
                >
                  <option value="">Seleccione un producto</option>
                  {productos.map((producto) => (
                    <option key={obtenerIdProducto(producto)} value={obtenerIdProducto(producto)}>
                      {producto.nombre ?? `Producto #${obtenerIdProducto(producto)}`}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="venta-cantidad">
                <span>Cantidad</span>
                <input
                  id="venta-cantidad"
                  type="number"
                  min="1"
                  value={formularioVenta.cantidad}
                  onChange={(event) => actualizarFormulario('cantidad', event.target.value)}
                />
              </label>

              <div className="producto-seleccionado-info">
                <span>Precio</span>
                <strong>
                  {productoSeleccionado
                    ? formatearMoneda(obtenerPrecioProducto(productoSeleccionado))
                    : formatearMoneda(0)}
                </strong>
              </div>

              <div className="producto-seleccionado-info">
                <span>Stock disponible</span>
                <strong>{productoSeleccionado ? obtenerStock(productoSeleccionado) : 0}</strong>
              </div>

              <button
                className="agregar-producto-button"
                type="button"
                onClick={agregarProductoVenta}
              >
                Agregar producto
              </button>
            </div>

            <div className="productos-venta-table">
              {productosVenta.length === 0 ? (
                <div className="ventas-estado">Agregue productos para calcular el total.</div>
              ) : (
                <TableContainer><table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Precio unitario</th>
                      <th>Subtotal</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {productosVenta.map((producto) => (
                      <tr key={producto.id_producto}>
                        <td className="detalle-producto">{producto.nombre}</td>
                        <td>{producto.cantidad}</td>
                        <td>{formatearMoneda(producto.preciounitario)}</td>
                        <td>{formatearMoneda(producto.subtotal)}</td>
                        <td>
                          <button
                            className="quitar-producto-button"
                            type="button"
                            onClick={() => quitarProductoVenta(producto.id_producto)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></TableContainer>
              )}
            </div>

            <div className="nueva-venta-footer">
              <div>
                <span>Total general</span>
                <strong>{formatearMoneda(totalNuevaVenta)}</strong>
              </div>

              <button className="guardar-venta-button" type="submit" disabled={guardandoVenta}>
                {guardandoVenta ? 'Guardando...' : 'Guardar venta'}
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="ventas-toolbar">
        <label className="buscador-ventas" htmlFor="buscar-ventas">
          <span>Buscar venta</span>
          <input
            id="buscar-ventas"
            type="search"
            placeholder="Cliente o ID de venta"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </label>

        <label className="filtro-fecha-ventas" htmlFor="filtrar-fecha-ventas">
          <span>Fecha</span>
          <input
            id="filtrar-fecha-ventas"
            type="date"
            value={fechaFiltro}
            onChange={(event) => setFechaFiltro(event.target.value)}
          />
        </label>

        {fechaFiltro && (
          <button className="limpiar-fecha-button" type="button" onClick={() => setFechaFiltro('')}>
            Limpiar fecha
          </button>
        )}
      </div>

      <div className="ventas-table-container">
        {ventasFiltradas.length === 0 ? (
          <div className="ventas-estado">
            {ventas.length === 0
              ? 'No hay ventas registradas.'
              : 'No se encontraron ventas con esos filtros.'}
          </div>
        ) : (
          <TableContainer><table>
            <thead>
              <tr>
                <th>ID venta</th>
                <th>Fecha de venta</th>
                <th>Cliente</th>
                <th>Empleado/Cajero</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {ventasFiltradas.map((venta) => (
                <tr key={venta.id_venta}>
                  <td>{venta.id_venta}</td>
                  <td>{formatearFecha(obtenerFechaVenta(venta))}</td>
                  <td className="venta-cliente">
                    {obtenerNombreCliente(venta.id_cliente, clientes)}
                  </td>
                  <td>{obtenerNombreEmpleado(venta.id_empleado, empleados)}</td>
                  <td>{formatearMoneda(obtenerTotalVenta(venta))}</td>
                  <td>
                    <button
                      className="detalle-venta-button"
                      type="button"
                      onClick={() => alternarDetalleVenta(venta.id_venta)}
                    >
                      {String(ventaSeleccionadaId) === String(venta.id_venta)
                        ? 'Ocultar detalle'
                        : 'Ver detalle'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></TableContainer>
        )}
      </div>

      {ventaSeleccionadaId && (
        <section className="detalle-venta-panel">
          <div className="detalle-venta-header">
            <div>
              <h3>Detalle de venta #{ventaSeleccionadaId}</h3>
              <span>
                {ventaSeleccionada
                  ? `${formatearFecha(obtenerFechaVenta(ventaSeleccionada))} · ${obtenerNombreCliente(ventaSeleccionada.id_cliente, clientes)}`
                  : 'Venta seleccionada'}
              </span>
            </div>

            <strong>{formatearMoneda(totalDetalleSeleccionado)}</strong>
          </div>

          {detallesVentaSeleccionada.length === 0 ? (
            <div className="ventas-estado">No hay detalles registrados para esta venta.</div>
          ) : (
            <div className="detalle-venta-table-container">
              <TableContainer><table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio unitario</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>

                <tbody>
                  {detallesVentaSeleccionada.map((detalle) => {
                    const cantidad = obtenerCantidadDetalle(detalle)
                    const precio = obtenerPrecioDetalle(detalle)
                    const subtotal = cantidad * precio

                    return (
                      <tr key={detalle.id_detalleventa}>
                        <td className="detalle-producto">
                          {obtenerNombreProducto(detalle.id_producto, productos)}
                        </td>
                        <td>{cantidad}</td>
                        <td>{formatearMoneda(precio)}</td>
                        <td>{formatearMoneda(subtotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table></TableContainer>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default function SalesPage() {
  return <div className={styles.scope}><Ventas /></div>
}
