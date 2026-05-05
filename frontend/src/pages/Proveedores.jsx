import { useEffect, useState } from 'react'
import { obtenerProveedores } from '../services/proveedoresService'
import './Proveedores.css'

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

function obtenerNombreEmpresa(proveedor) {
  return proveedor.nombreempresa ?? proveedor.nombre_empresa ?? 'Sin empresa'
}

function obtenerContacto(proveedor) {
  const nombre = proveedor.nombrecontacto ?? proveedor.nombre_contacto ?? ''
  const apellido = proveedor.apellidocontacto ?? proveedor.apellido_contacto ?? ''
  const contacto = `${nombre} ${apellido}`.trim()

  return contacto || 'Sin contacto'
}

function obtenerTelefono(proveedor) {
  return proveedor.numerotelefono ?? proveedor.telefono ?? proveedor.numero_telefono ?? ''
}

function obtenerCorreo(proveedor) {
  return proveedor.correoprofesional ?? proveedor.correo_profesional ?? proveedor.email ?? ''
}

function obtenerDireccion(proveedor) {
  return proveedor.id_direccion ?? proveedor.direccion ?? ''
}

function Proveedores() {
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function cargarProveedores() {
      try {
        const proveedoresData = await obtenerProveedores()

        setProveedores(obtenerLista(proveedoresData))
      } catch (error) {
        console.error(error)
        setError('No se pudieron cargar los proveedores')
      } finally {
        setCargando(false)
      }
    }

    cargarProveedores()
  }, [])

  const totalProveedores = proveedores.length
  const proveedoresConCorreo = proveedores.filter((proveedor) => {
    return Boolean(obtenerCorreo(proveedor).trim())
  }).length
  const proveedoresSinCorreo = totalProveedores - proveedoresConCorreo

  const terminoBusqueda = busqueda.trim().toLowerCase()
  const proveedoresFiltrados = proveedores.filter((proveedor) => {
    const datosBusqueda = [
      obtenerNombreEmpresa(proveedor),
      obtenerContacto(proveedor),
      obtenerTelefono(proveedor),
    ].join(' ').toLowerCase()

    return terminoBusqueda ? datosBusqueda.includes(terminoBusqueda) : true
  })

  if (cargando) {
    return (
      <div className="proveedores-page">
        <div className="proveedores-estado">Cargando proveedores...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="proveedores-page">
        <div className="proveedores-estado error">{error}</div>
      </div>
    )
  }

  return (
    <div className="proveedores-page">
      <div className="proveedores-header">
        <div>
          <h2>Proveedores</h2>
          <p>Listado general de proveedores registrados.</p>
        </div>
      </div>

      <div className="proveedores-resumen">
        <div className="resumen-card">
          <span>Total proveedores</span>
          <strong>{totalProveedores}</strong>
        </div>

        <div className="resumen-card">
          <span>Con correo registrado</span>
          <strong>{proveedoresConCorreo}</strong>
        </div>

        <div className="resumen-card alerta">
          <span>Sin correo registrado</span>
          <strong>{proveedoresSinCorreo}</strong>
        </div>
      </div>

      <div className="proveedores-toolbar">
        <label className="buscador-proveedores" htmlFor="buscar-proveedores">
          <span>Buscar proveedor</span>
          <input
            id="buscar-proveedores"
            type="search"
            placeholder="Empresa, contacto o telefono"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </label>
      </div>

      <div className="proveedores-table-container">
        {proveedoresFiltrados.length === 0 ? (
          <div className="proveedores-estado">
            {proveedores.length === 0
              ? 'No hay proveedores registrados.'
              : 'No se encontraron proveedores con esa busqueda.'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID proveedor</th>
                <th>Nombre de empresa</th>
                <th>Contacto</th>
                <th>Telefono</th>
                <th>Correo profesional</th>
                <th>Direccion</th>
              </tr>
            </thead>

            <tbody>
              {proveedoresFiltrados.map((proveedor) => (
                <tr key={obtenerIdProveedor(proveedor)}>
                  <td>{obtenerIdProveedor(proveedor)}</td>
                  <td className="proveedor-empresa">{obtenerNombreEmpresa(proveedor)}</td>
                  <td>{obtenerContacto(proveedor)}</td>
                  <td>{obtenerTelefono(proveedor) || 'Sin telefono'}</td>
                  <td>{obtenerCorreo(proveedor) || 'Sin correo'}</td>
                  <td>{obtenerDireccion(proveedor) || 'No registrada'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Proveedores
