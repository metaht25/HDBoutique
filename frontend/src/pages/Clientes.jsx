import { useEffect, useState } from 'react'
import { obtenerClientes, obtenerTiposClientes } from '../services/clientesService'
import './Clientes.css'

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

function obtenerNombre(cliente) {
  return cliente.nombre ?? cliente.nombres ?? cliente.primer_nombre ?? ''
}

function obtenerApellido(cliente) {
  return cliente.apellido ?? cliente.apellidos ?? cliente.primer_apellido ?? ''
}

function obtenerTelefono(cliente) {
  return cliente.numerotelefono ?? cliente.telefono ?? cliente.celular ?? cliente.numero_telefono ?? ''
}

function obtenerDireccion(cliente) {
  return cliente.direccion ?? cliente.direccionexacta ?? cliente.direccion_exacta ?? 'No registrada'
}

function obtenerIdTipoCliente(tipoCliente) {
  return tipoCliente.id_tipo_cliente ?? tipoCliente.id_tipocliente ?? tipoCliente.id ?? ''
}

function obtenerNombreTipoCliente(tipoCliente) {
  return tipoCliente.nombre ?? tipoCliente.tipo ?? tipoCliente.descripcion ?? 'Sin tipo'
}

function obtenerTipoClienteId(cliente) {
  if (typeof cliente.id_tipo_cliente === 'object') {
    return obtenerIdTipoCliente(cliente.id_tipo_cliente)
  }

  if (typeof cliente.tipo_cliente === 'object') {
    return obtenerIdTipoCliente(cliente.tipo_cliente)
  }

  return cliente.id_tipo_cliente ?? cliente.id_tipocliente ?? cliente.tipo_cliente ?? ''
}

function obtenerTipoClienteNombre(cliente, tiposClientes) {
  if (typeof cliente.id_tipo_cliente === 'object') {
    return obtenerNombreTipoCliente(cliente.id_tipo_cliente)
  }

  if (typeof cliente.tipo_cliente === 'object') {
    return obtenerNombreTipoCliente(cliente.tipo_cliente)
  }

  const idTipoCliente = obtenerTipoClienteId(cliente)
  const tipoCliente = tiposClientes.find((tipo) => {
    return String(obtenerIdTipoCliente(tipo)) === String(idTipoCliente)
  })

  return tipoCliente ? obtenerNombreTipoCliente(tipoCliente) : 'Sin tipo'
}

function esTipoCliente(cliente, tiposClientes, tipoBuscado) {
  const nombreTipo = obtenerTipoClienteNombre(cliente, tiposClientes).toLowerCase()

  return nombreTipo.includes(tipoBuscado)
}

function Clientes() {
  const [clientes, setClientes] = useState([])
  const [tiposClientes, setTiposClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function cargarClientes() {
      try {
        const [clientesData, tiposClientesData] = await Promise.all([
          obtenerClientes(),
          obtenerTiposClientes(),
        ])

        setClientes(obtenerLista(clientesData))
        setTiposClientes(obtenerLista(tiposClientesData))
      } catch (error) {
        console.error(error)
        setError('No se pudieron cargar los clientes')
      } finally {
        setCargando(false)
      }
    }

    cargarClientes()
  }, [])

  const totalClientes = clientes.length
  const clientesFrecuentes = clientes.filter((cliente) => {
    return esTipoCliente(cliente, tiposClientes, 'frecuente')
  }).length
  const clientesCasuales = clientes.filter((cliente) => {
    return esTipoCliente(cliente, tiposClientes, 'casual')
  }).length

  const terminoBusqueda = busqueda.trim().toLowerCase()
  const clientesFiltrados = clientes.filter((cliente) => {
    const datosBusqueda = [
      obtenerNombre(cliente),
      obtenerApellido(cliente),
      obtenerTelefono(cliente),
    ].join(' ').toLowerCase()

    return terminoBusqueda ? datosBusqueda.includes(terminoBusqueda) : true
  })

  if (cargando) {
    return (
      <div className="clientes-page">
        <div className="clientes-estado">Cargando clientes...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="clientes-page">
        <div className="clientes-estado error">{error}</div>
      </div>
    )
  }

  return (
    <div className="clientes-page">
      <div className="clientes-header">
        <div>
          <h2>Clientes</h2>
          <p>Listado general de clientes registrados.</p>
        </div>
      </div>

      <div className="clientes-resumen">
        <div className="resumen-card">
          <span>Total clientes</span>
          <strong>{totalClientes}</strong>
        </div>

        <div className="resumen-card">
          <span>Clientes frecuentes</span>
          <strong>{clientesFrecuentes}</strong>
        </div>

        <div className="resumen-card">
          <span>Clientes casuales</span>
          <strong>{clientesCasuales}</strong>
        </div>
      </div>

      <div className="clientes-toolbar">
        <label className="buscador-clientes" htmlFor="buscar-clientes">
          <span>Buscar cliente</span>
          <input
            id="buscar-clientes"
            type="search"
            placeholder="Nombre, apellido o telefono"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </label>
      </div>

      <div className="clientes-table-container">
        {clientesFiltrados.length === 0 ? (
          <div className="clientes-estado">
            {clientes.length === 0
              ? 'No hay clientes registrados.'
              : 'No se encontraron clientes con esa busqueda.'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Apellido</th>
                <th>Telefono</th>
                <th>Tipo de cliente</th>
                <th>Direccion</th>
              </tr>
            </thead>

            <tbody>
              {clientesFiltrados.map((cliente) => {
                const idCliente = obtenerIdCliente(cliente)

                return (
                  <tr key={idCliente}>
                    <td>{idCliente}</td>
                    <td className="cliente-nombre">{obtenerNombre(cliente) || 'Sin nombre'}</td>
                    <td>{obtenerApellido(cliente) || 'Sin apellido'}</td>
                    <td>{obtenerTelefono(cliente) || 'Sin teléfono'}</td>
                    <td>
                      <span className="badge neutral">
                        {obtenerTipoClienteNombre(cliente, tiposClientes)}
                      </span>
                    </td>
                    <td>{obtenerDireccion(cliente)}</td>
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

export default Clientes
