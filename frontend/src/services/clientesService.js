const CLIENTES_URL = '/api/personas/clientes/'
const TIPOS_CLIENTES_URL = '/api/personas/tipos-clientes/'
const DEUDAS_CLIENTES_URL = '/api/personas/deudas-clientes/'
const DEPARTAMENTOS_URL = '/api/departamentos/'
const MUNICIPIOS_URL = '/api/municipios/'
const DIRECCIONES_URL = '/api/direcciones/'

export async function obtenerClientes() {
  const respuesta = await fetch(CLIENTES_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener clientes')
  }

  return respuesta.json()
}

export async function crearCliente(cliente) {
  const respuesta = await fetch(CLIENTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cliente),
  })

  if (!respuesta.ok) {
    throw new Error('Error al crear cliente')
  }

  return respuesta.json()
}

export async function actualizarCliente(idCliente, cliente) {
  const respuesta = await fetch(`${CLIENTES_URL}${idCliente}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cliente),
  })

  if (!respuesta.ok) {
    throw new Error('Error al actualizar cliente')
  }

  return respuesta.json()
}

export async function obtenerTiposClientes() {
  const respuesta = await fetch(TIPOS_CLIENTES_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener tipos de cliente')
  }

  return respuesta.json()
}

export async function obtenerDepartamentos() {
  const respuesta = await fetch(DEPARTAMENTOS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener departamentos')
  }

  return respuesta.json()
}

export async function obtenerMunicipios() {
  const respuesta = await fetch(MUNICIPIOS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener municipios')
  }

  return respuesta.json()
}

export async function crearDireccion(direccion) {
  const respuesta = await fetch(DIRECCIONES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(direccion),
  })

  if (!respuesta.ok) {
    throw new Error('Error al crear direccion')
  }

  return respuesta.json()
}

export { DEUDAS_CLIENTES_URL }
