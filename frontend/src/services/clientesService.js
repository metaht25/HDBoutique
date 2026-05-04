const CLIENTES_URL = '/api/personas/clientes/'
const TIPOS_CLIENTES_URL = '/api/personas/tipos-clientes/'
const DEUDAS_CLIENTES_URL = '/api/personas/deudas-clientes/'

export async function obtenerClientes() {
  const respuesta = await fetch(CLIENTES_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener clientes')
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

export { DEUDAS_CLIENTES_URL }
