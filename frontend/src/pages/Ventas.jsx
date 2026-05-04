import { useEffect, useState } from 'react'
import {
  obtenerClientesVentas,
  obtenerEmpleadosVentas,
  obtenerVentas,
} from '../services/ventasService'
import './Ventas.css'

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
  const [clientes, setClientes] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fechaFiltro, setFechaFiltro] = useState('')

  useEffect(() => {
    async function cargarVentas() {
      try {
        const [ventasData, clientesData, empleadosData] = await Promise.all([
          obtenerVentas(),
          obtenerClientesVentas(),
          obtenerEmpleadosVentas(),
        ])

        setVentas(obtenerLista(ventasData))
        setClientes(obtenerLista(clientesData))
        setEmpleados(obtenerLista(empleadosData))
      } catch (error) {
        console.error(error)
        setError('No se pudieron cargar las ventas')
      } finally {
        setCargando(false)
      }
    }

    cargarVentas()
  }, [])

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

  if (cargando) {
    return (
      <div className="ventas-page">
        <div className="ventas-estado">Cargando ventas...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ventas-page">
        <div className="ventas-estado error">{error}</div>
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
          <table>
            <thead>
              <tr>
                <th>ID venta</th>
                <th>Fecha de venta</th>
                <th>Cliente</th>
                <th>Empleado/Cajero</th>
                <th>Total</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Ventas
