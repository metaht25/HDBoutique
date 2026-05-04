import { useEffect, useState } from 'react'
import {
  actualizarCliente,
  crearCliente,
  crearDireccion,
  obtenerDepartamentos,
  obtenerClientes,
  obtenerMunicipios,
  obtenerTiposClientes,
} from '../services/clientesService'
import './Clientes.css'

const CLIENTE_INICIAL = {
  nombres: '',
  apellidos: '',
  numerotelefono: '',
  id_tipo_cliente: '',
  id_direccion: '',
}
const DIRECCION_INICIAL = {
  id_departamento: '',
  id_municipio: '',
  direccionexacta: '',
}
const ERRORES_INICIALES = {}

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
  return cliente.id_direccion ?? cliente.direccion ?? cliente.direccionexacta ?? cliente.direccion_exacta ?? ''
}

function obtenerIdTipoCliente(tipoCliente) {
  return tipoCliente.id_tipo_cliente ?? tipoCliente.id_tipocliente ?? tipoCliente.id ?? ''
}

function obtenerNombreTipoCliente(tipoCliente) {
  return tipoCliente.nombre ?? tipoCliente.tipo ?? tipoCliente.descripcion ?? 'Sin tipo'
}

function obtenerIdDepartamento(departamento) {
  return departamento.id_departamento ?? departamento.id ?? ''
}

function obtenerNombreDepartamento(departamento) {
  return departamento.nombre ?? departamento.departamento ?? departamento.descripcion ?? 'Sin nombre'
}

function obtenerIdMunicipio(municipio) {
  return municipio.id_municipio ?? municipio.id ?? ''
}

function obtenerNombreMunicipio(municipio) {
  return municipio.nombre ?? municipio.municipio ?? municipio.descripcion ?? 'Sin nombre'
}

function obtenerDepartamentoMunicipioId(municipio) {
  if (typeof municipio.id_departamento === 'object') {
    return obtenerIdDepartamento(municipio.id_departamento)
  }

  if (typeof municipio.departamento === 'object') {
    return obtenerIdDepartamento(municipio.departamento)
  }

  return municipio.id_departamento ?? municipio.departamento ?? ''
}

function obtenerIdDireccion(direccion) {
  return direccion.id_direccion ?? direccion.id ?? ''
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

function obtenerValorFormulario(valor) {
  return valor === null || valor === undefined ? '' : String(valor)
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

function validarCliente(cliente, direccion, esEdicion) {
  const errores = {}

  if (!cliente.nombres.trim()) {
    errores.nombres = 'Los nombres son obligatorios.'
  }

  if (!cliente.apellidos.trim()) {
    errores.apellidos = 'Los apellidos son obligatorios.'
  }

  if (!cliente.numerotelefono.trim()) {
    errores.numerotelefono = 'El telefono es obligatorio.'
  } else if (!/^\d+$/.test(cliente.numerotelefono)) {
    errores.numerotelefono = 'El telefono debe contener solo numeros.'
  } else if (cliente.numerotelefono.length !== 8) {
    errores.numerotelefono = 'El telefono debe tener exactamente 8 digitos.'
  }

  if (!cliente.id_tipo_cliente) {
    errores.id_tipo_cliente = 'Selecciona un tipo de cliente.'
  }

  if (!esEdicion) {
    if (!direccion.id_departamento) {
      errores.id_departamento = 'Selecciona un departamento.'
    }

    if (!direccion.id_municipio) {
      errores.id_municipio = 'Selecciona un municipio.'
    }

    if (!direccion.direccionexacta.trim()) {
      errores.direccionexacta = 'La direccion exacta es obligatoria.'
    }
  }

  return errores
}

function Clientes() {
  const [clientes, setClientes] = useState([])
  const [tiposClientes, setTiposClientes] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [municipios, setMunicipios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [clienteFormulario, setClienteFormulario] = useState(CLIENTE_INICIAL)
  const [direccionFormulario, setDireccionFormulario] = useState(DIRECCION_INICIAL)
  const [clienteEditandoId, setClienteEditandoId] = useState(null)
  const [erroresFormulario, setErroresFormulario] = useState(ERRORES_INICIALES)
  const [mensajeFormulario, setMensajeFormulario] = useState('')
  const [errorFormulario, setErrorFormulario] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function refrescarClientes() {
    const clientesData = await obtenerClientes()

    setClientes(obtenerLista(clientesData))
    setError('')
  }

  useEffect(() => {
    async function cargarClientes() {
      try {
        const [
          clientesData,
          tiposClientesData,
          departamentosData,
          municipiosData,
        ] = await Promise.all([
          obtenerClientes(),
          obtenerTiposClientes(),
          obtenerDepartamentos(),
          obtenerMunicipios(),
        ])

        setClientes(obtenerLista(clientesData))
        setTiposClientes(obtenerLista(tiposClientesData))
        setDepartamentos(obtenerLista(departamentosData))
        setMunicipios(obtenerLista(municipiosData))
      } catch (error) {
        console.error(error)
        setError('No se pudieron cargar los clientes')
      } finally {
        setCargando(false)
      }
    }

    cargarClientes()
  }, [])

  function abrirNuevoCliente() {
    setMostrarFormulario(true)
    setClienteEditandoId(null)
    setClienteFormulario(CLIENTE_INICIAL)
    setDireccionFormulario(DIRECCION_INICIAL)
    setErroresFormulario(ERRORES_INICIALES)
    setMensajeFormulario('')
    setErrorFormulario('')
  }

  function cancelarFormulario() {
    setMostrarFormulario(false)
    setClienteEditandoId(null)
    setClienteFormulario(CLIENTE_INICIAL)
    setDireccionFormulario(DIRECCION_INICIAL)
    setErroresFormulario(ERRORES_INICIALES)
    setMensajeFormulario('')
    setErrorFormulario('')
  }

  function actualizarClienteFormulario(event) {
    const { name, value } = event.target
    const nuevoValor = name === 'numerotelefono' ? value.replace(/\D/g, '').slice(0, 8) : value

    setClienteFormulario((clienteActual) => ({
      ...clienteActual,
      [name]: nuevoValor,
    }))
    setErroresFormulario((erroresActuales) => ({
      ...erroresActuales,
      [name]: '',
    }))
  }

  function actualizarDireccionFormulario(event) {
    const { name, value } = event.target

    setDireccionFormulario((direccionActual) => ({
      ...direccionActual,
      [name]: value,
      ...(name === 'id_departamento' ? { id_municipio: '' } : {}),
    }))
    setErroresFormulario((erroresActuales) => ({
      ...erroresActuales,
      [name]: '',
    }))
  }

  function editarCliente(cliente) {
    setMostrarFormulario(true)
    setClienteEditandoId(obtenerIdCliente(cliente))
    setClienteFormulario({
      nombres: obtenerValorFormulario(cliente.nombres ?? obtenerNombre(cliente)),
      apellidos: obtenerValorFormulario(cliente.apellidos ?? obtenerApellido(cliente)),
      numerotelefono: obtenerValorFormulario(cliente.numerotelefono ?? obtenerTelefono(cliente)),
      id_tipo_cliente: obtenerValorFormulario(obtenerTipoClienteId(cliente)),
      id_direccion: obtenerValorFormulario(obtenerDireccion(cliente)),
    })
    setDireccionFormulario(DIRECCION_INICIAL)
    setErroresFormulario(ERRORES_INICIALES)
    setMensajeFormulario('')
    setErrorFormulario('')
  }

  async function guardarCliente(event) {
    event.preventDefault()
    setMensajeFormulario('')
    setErrorFormulario('')

    const esEdicion = clienteEditandoId !== null
    const errores = validarCliente(clienteFormulario, direccionFormulario, esEdicion)

    if (Object.values(errores).some(Boolean)) {
      setErroresFormulario(errores)
      setErrorFormulario('Revisa los campos marcados antes de guardar.')
      return
    }

    const datosClienteBase = {
      nombres: clienteFormulario.nombres.trim(),
      apellidos: clienteFormulario.apellidos.trim(),
      numerotelefono: clienteFormulario.numerotelefono.trim(),
      id_tipo_cliente: Number(clienteFormulario.id_tipo_cliente),
    }

    setGuardando(true)
    setErroresFormulario(ERRORES_INICIALES)

    try {
      if (esEdicion) {
        await actualizarCliente(clienteEditandoId, {
          ...datosClienteBase,
          id_direccion: Number(clienteFormulario.id_direccion),
        })
      } else {
        let direccionCreada

        try {
          direccionCreada = await crearDireccion({
            direccionexacta: direccionFormulario.direccionexacta.trim(),
            id_departamento: Number(direccionFormulario.id_departamento),
            id_municipio: Number(direccionFormulario.id_municipio),
          })
        } catch (error) {
          console.error(error)
          setErrorFormulario('No se pudo crear la direccion del cliente.')
          return
        }

        const idDireccion = obtenerIdDireccion(direccionCreada)

        if (!idDireccion) {
          setErrorFormulario('La direccion fue creada, pero no se recibio su ID.')
          return
        }

        try {
          await crearCliente({
            ...datosClienteBase,
            id_direccion: Number(idDireccion),
          })
        } catch (error) {
          console.error(error)
          setErrorFormulario('La direccion fue creada, pero no se pudo crear el cliente.')
          return
        }
      }

      setClienteFormulario(CLIENTE_INICIAL)
      setDireccionFormulario(DIRECCION_INICIAL)
      setClienteEditandoId(null)
      setMostrarFormulario(false)
      setMensajeFormulario(
        esEdicion
          ? 'Cliente actualizado correctamente'
          : 'Cliente guardado correctamente',
      )
      await refrescarClientes()
    } catch (error) {
      console.error(error)
      setErrorFormulario(
        esEdicion
          ? 'No se pudo actualizar el cliente'
          : 'No se pudo guardar el cliente',
      )
    } finally {
      setGuardando(false)
    }
  }

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

  const municipiosFiltrados = direccionFormulario.id_departamento
    ? municipios.filter((municipio) => {
        return String(obtenerDepartamentoMunicipioId(municipio)) === String(direccionFormulario.id_departamento)
      })
    : municipios

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

        <button className="nuevo-cliente-button" type="button" onClick={abrirNuevoCliente}>
          Nuevo cliente
        </button>
      </div>

      {mostrarFormulario && (
        <form
          className={`cliente-form ${clienteEditandoId !== null ? 'editando' : ''}`}
          onSubmit={guardarCliente}
          noValidate
        >
          <div className="cliente-form-header">
            <h3>{clienteEditandoId !== null ? 'Editar cliente' : 'Nuevo cliente'}</h3>
            <span>
              {clienteEditandoId !== null
                ? 'Actualiza los datos del cliente seleccionado.'
                : 'Registra un nuevo cliente para ventas y seguimiento.'}
            </span>
          </div>

          <div className="cliente-form-grid">
            <label>
              <span>Nombres</span>
              <input
                className={erroresFormulario.nombres ? 'input-error' : ''}
                name="nombres"
                type="text"
                value={clienteFormulario.nombres}
                onChange={actualizarClienteFormulario}
              />
              {erroresFormulario.nombres && (
                <small className="field-error">{erroresFormulario.nombres}</small>
              )}
            </label>

            <label>
              <span>Apellidos</span>
              <input
                className={erroresFormulario.apellidos ? 'input-error' : ''}
                name="apellidos"
                type="text"
                value={clienteFormulario.apellidos}
                onChange={actualizarClienteFormulario}
              />
              {erroresFormulario.apellidos && (
                <small className="field-error">{erroresFormulario.apellidos}</small>
              )}
            </label>

            <label>
              <span>Telefono</span>
              <input
                className={erroresFormulario.numerotelefono ? 'input-error' : ''}
                inputMode="numeric"
                maxLength="8"
                name="numerotelefono"
                type="tel"
                value={clienteFormulario.numerotelefono}
                onChange={actualizarClienteFormulario}
              />
              {erroresFormulario.numerotelefono && (
                <small className="field-error">{erroresFormulario.numerotelefono}</small>
              )}
            </label>

            <label>
              <span>Tipo de cliente</span>
              <select
                className={erroresFormulario.id_tipo_cliente ? 'input-error' : ''}
                name="id_tipo_cliente"
                value={clienteFormulario.id_tipo_cliente}
                onChange={actualizarClienteFormulario}
              >
                <option value="">Selecciona un tipo</option>
                {tiposClientes.map((tipoCliente) => {
                  const idTipoCliente = obtenerIdTipoCliente(tipoCliente)

                  return (
                    <option key={idTipoCliente} value={idTipoCliente}>
                      {obtenerNombreTipoCliente(tipoCliente)}
                    </option>
                  )
                })}
              </select>
              {erroresFormulario.id_tipo_cliente && (
                <small className="field-error">{erroresFormulario.id_tipo_cliente}</small>
              )}
            </label>

            {clienteEditandoId !== null && (
              <div className="direccion-pendiente">
                La edicion de direccion queda pendiente. Se conservara la direccion actual.
              </div>
            )}
          </div>

          {clienteEditandoId === null && (
            <div className="direccion-section">
              <div className="direccion-section-header">
                <h4>Direccion del cliente</h4>
                <span>Selecciona la ubicacion y escribe la direccion exacta.</span>
              </div>

              <div className="cliente-form-grid">
                <label>
                  <span>Departamento</span>
                  <select
                    className={erroresFormulario.id_departamento ? 'input-error' : ''}
                    name="id_departamento"
                    value={direccionFormulario.id_departamento}
                    onChange={actualizarDireccionFormulario}
                  >
                    <option value="">Selecciona un departamento</option>
                    {departamentos.map((departamento) => {
                      const idDepartamento = obtenerIdDepartamento(departamento)

                      return (
                        <option key={idDepartamento} value={idDepartamento}>
                          {obtenerNombreDepartamento(departamento)}
                        </option>
                      )
                    })}
                  </select>
                  {erroresFormulario.id_departamento && (
                    <small className="field-error">{erroresFormulario.id_departamento}</small>
                  )}
                </label>

                <label>
                  <span>Municipio</span>
                  <select
                    className={erroresFormulario.id_municipio ? 'input-error' : ''}
                    name="id_municipio"
                    value={direccionFormulario.id_municipio}
                    onChange={actualizarDireccionFormulario}
                  >
                    <option value="">Selecciona un municipio</option>
                    {municipiosFiltrados.map((municipio) => {
                      const idMunicipio = obtenerIdMunicipio(municipio)

                      return (
                        <option key={idMunicipio} value={idMunicipio}>
                          {obtenerNombreMunicipio(municipio)}
                        </option>
                      )
                    })}
                  </select>
                  {erroresFormulario.id_municipio && (
                    <small className="field-error">{erroresFormulario.id_municipio}</small>
                  )}
                </label>

                <label className="direccion-exacta-field">
                  <span>Direccion exacta</span>
                  <input
                    className={erroresFormulario.direccionexacta ? 'input-error' : ''}
                    name="direccionexacta"
                    type="text"
                    value={direccionFormulario.direccionexacta}
                    onChange={actualizarDireccionFormulario}
                  />
                  {erroresFormulario.direccionexacta && (
                    <small className="field-error">{erroresFormulario.direccionexacta}</small>
                  )}
                </label>
              </div>
            </div>
          )}

          <div className="cliente-form-actions">
            <div>
              {mensajeFormulario && (
                <span className="form-message success">{mensajeFormulario}</span>
              )}
              {errorFormulario && (
                <span className="form-message error">{errorFormulario}</span>
              )}
            </div>

            <button type="submit" disabled={guardando}>
              {guardando
                ? 'Guardando...'
                : clienteEditandoId !== null
                  ? 'Actualizar cliente'
                  : 'Guardar cliente'}
            </button>

            <button className="button-secundario" type="button" onClick={cancelarFormulario}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!mostrarFormulario && (mensajeFormulario || errorFormulario) && (
        <div className="cliente-form-feedback">
          {mensajeFormulario && (
            <span className="form-message success">{mensajeFormulario}</span>
          )}
          {errorFormulario && (
            <span className="form-message error">{errorFormulario}</span>
          )}
        </div>
      )}

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
                <th>Acciones</th>
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
                    <td>{obtenerTelefono(cliente) || 'Sin telefono'}</td>
                    <td>
                      <span className="badge neutral">
                        {obtenerTipoClienteNombre(cliente, tiposClientes)}
                      </span>
                    </td>
                    <td>{obtenerDireccion(cliente) || 'No registrada'}</td>
                    <td>
                      <div className="acciones-cliente">
                        <button type="button" onClick={() => editarCliente(cliente)}>
                          Editar
                        </button>
                      </div>
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

export default Clientes
