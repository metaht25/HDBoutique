import { useEffect, useState } from 'react'
import {
  obtenerCompras,
  obtenerEmpleadosCompras,
  obtenerProveedoresCompras,
} from '../services/comprasService'
import './Compras.css'

function obtenerLista(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.results)) {
    return data.results
  }

  return []
}

function obtenerIdProveedor(proveedor) {
  return proveedor.id_proveedor ?? proveedor.id
}

function obtenerNombreProveedor(idProveedor, proveedores) {
  const proveedor = proveedores.find((item) => {
    return String(obtenerIdProveedor(item)) === String(idProveedor)
  })

  return proveedor ? proveedor.nombreempresa ?? `Proveedor #${idProveedor}` : `Proveedor #${idProveedor}`
}

function obtenerIdEmpleado(empleado) {
  return empleado.id_empleado ?? empleado.id_persona ?? empleado.id
}

function obtenerNombreEmpleado(idEmpleado, empleados) {
  const empleado = empleados.find((item) => {
    return String(obtenerIdEmpleado(item)) === String(idEmpleado)
  })

  if (!empleado) {
    return `Empleado #${idEmpleado}`
  }

  const nombres = empleado.nombres ?? empleado.nombre ?? empleado.primer_nombre ?? ''
  const apellidos = empleado.apellidos ?? empleado.apellido ?? empleado.primer_apellido ?? ''
  const nombreCompleto = `${nombres} ${apellidos}`.trim()

  return nombreCompleto || `Empleado #${idEmpleado}`
}

function obtenerFechaCompra(compra) {
  return compra.fechacompra ?? compra.fecha_compra ?? ''
}

function obtenerFechaRevision(compra) {
  return compra.fecharevision ?? compra.fecha_revision ?? ''
}

function obtenerFechaRelleno(compra) {
  return compra.fecharelleno ?? compra.fecha_relleno ?? ''
}

function obtenerCostoEnvio(compra) {
  const costo = Number(compra.costodeenvio ?? 0)

  return Number.isNaN(costo) ? 0 : costo
}

function formatearFecha(fecha) {
  return fecha || 'Pendiente'
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 2,
  }).format(valor)
}

function esMismoMes(fechaCompra, fechaReferencia) {
  if (!fechaCompra || !fechaReferencia) {
    return false
  }

  return fechaCompra.slice(0, 7) === fechaReferencia.slice(0, 7)
}

function compraPendienteRevision(compra) {
  return !obtenerFechaRevision(compra)
}

function Compras() {
  const [compras, setCompras] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function cargarCompras() {
      try {
        const [comprasData, proveedoresData, empleadosData] = await Promise.all([
          obtenerCompras(),
          obtenerProveedoresCompras(),
          obtenerEmpleadosCompras(),
        ])

        setCompras(obtenerLista(comprasData))
        setProveedores(obtenerLista(proveedoresData))
        setEmpleados(obtenerLista(empleadosData))
      } catch (error) {
        console.error(error)
        setError('No se pudieron cargar las compras')
      } finally {
        setCargando(false)
      }
    }

    cargarCompras()
  }, [])

  const fechaActual = new Date().toISOString().slice(0, 10)
  const totalCompras = compras.length
  const comprasDelMes = compras.filter((compra) => {
    return esMismoMes(obtenerFechaCompra(compra), fechaActual)
  }).length
  const costoTotalEnvio = compras.reduce((acumulador, compra) => {
    return acumulador + obtenerCostoEnvio(compra)
  }, 0)
  const comprasPendientesRevision = compras.filter(compraPendienteRevision).length

  const terminoBusqueda = busqueda.trim().toLowerCase()
  const comprasFiltradas = compras.filter((compra) => {
    const proveedor = obtenerNombreProveedor(compra.id_proveedor, proveedores).toLowerCase()
    const idCompra = String(compra.id_compra ?? '')

    return terminoBusqueda
      ? proveedor.includes(terminoBusqueda) || idCompra.includes(terminoBusqueda)
      : true
  })

  if (cargando) {
    return (
      <div className="compras-page">
        <div className="compras-estado">Cargando compras...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="compras-page">
        <div className="compras-estado error">{error}</div>
      </div>
    )
  }

  return (
    <div className="compras-page">
      <div className="compras-header">
        <div>
          <h2>Compras</h2>
          <p>Listado general de compras registradas.</p>
        </div>
      </div>

      <div className="compras-resumen">
        <div className="resumen-card">
          <span>Total de compras</span>
          <strong>{totalCompras}</strong>
        </div>

        <div className="resumen-card">
          <span>Compras del mes</span>
          <strong>{comprasDelMes}</strong>
        </div>

        <div className="resumen-card">
          <span>Costo total de envio</span>
          <strong>{formatearMoneda(costoTotalEnvio)}</strong>
        </div>

        <div className="resumen-card alerta">
          <span>Pendientes de revision</span>
          <strong>{comprasPendientesRevision}</strong>
        </div>
      </div>

      <div className="compras-toolbar">
        <label className="buscador-compras" htmlFor="buscar-compras">
          <span>Buscar compra</span>
          <input
            id="buscar-compras"
            type="search"
            placeholder="Proveedor o ID compra"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </label>
      </div>

      <div className="compras-table-container">
        {comprasFiltradas.length === 0 ? (
          <div className="compras-estado">
            {compras.length === 0
              ? 'No hay compras registradas.'
              : 'No se encontraron compras con esa busqueda.'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID compra</th>
                <th>Proveedor</th>
                <th>Empleado</th>
                <th>Fecha de revision</th>
                <th>Fecha de compra</th>
                <th>Costo de envio</th>
                <th>Fecha de relleno</th>
              </tr>
            </thead>

            <tbody>
              {comprasFiltradas.map((compra) => {
                const pendienteRevision = compraPendienteRevision(compra)

                return (
                  <tr className={pendienteRevision ? 'compra-pendiente' : ''} key={compra.id_compra}>
                    <td>{compra.id_compra}</td>
                    <td className="compra-proveedor">
                      {obtenerNombreProveedor(compra.id_proveedor, proveedores)}
                    </td>
                    <td>{obtenerNombreEmpleado(compra.id_empleado, empleados)}</td>
                    <td>
                      <span className={`badge ${pendienteRevision ? 'warning' : 'success'}`}>
                        {formatearFecha(obtenerFechaRevision(compra))}
                      </span>
                    </td>
                    <td>{formatearFecha(obtenerFechaCompra(compra))}</td>
                    <td>{formatearMoneda(obtenerCostoEnvio(compra))}</td>
                    <td>{formatearFecha(obtenerFechaRelleno(compra))}</td>
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

export default Compras
