import { TableContainer } from '../../shared/ui/TableContainer'
import { Pagination } from '../../shared/ui/Pagination'
import { LoadingState, Message } from '../../shared/ui/Feedback'
import { getErrorMessage } from '../../shared/api/errors'
import { useEffect, useState } from 'react'
import { obtenerProveedores } from './legacyApi.js'
import styles from './SuppliersPage.module.css'

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
  const [page, setPage] = useState(1)

  useEffect(() => {
    async function cargarProveedores() {
      try {
        const proveedoresData = await obtenerProveedores()

        setProveedores(obtenerLista(proveedoresData))
      } catch (error) {

        setError(getErrorMessage(error, 'No se pudieron cargar los proveedores'))
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

  const pageCount = Math.max(1, Math.ceil(proveedoresFiltrados.length / 20))
  const currentPage = Math.min(page, pageCount)
  const visibleSuppliers = proveedoresFiltrados.slice((currentPage - 1) * 20, currentPage * 20)

  if (cargando) {
    return (
      <div className="proveedores-page">
        <LoadingState>Cargando proveedores...</LoadingState>
      </div>
    )
  }

  if (error) {
    return (
      <div className="proveedores-page">
        <Message>{error}</Message>
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
            onChange={(event) => { setBusqueda(event.target.value); setPage(1) }}
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
          <TableContainer><table>
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
              {visibleSuppliers.map((proveedor) => (
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
          </table></TableContainer>
        )}
      </div>
      {pageCount > 1 && <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />}
    </div>
  )
}

export default function SuppliersPage() {
  return <div className={styles.scope}><Proveedores /></div>
}
