const VENTAS_URL = '/api/ventas/ventas/'
const CLIENTES_URL = '/api/personas/clientes/'
const EMPLEADOS_URL = '/api/personas/empleados/'

export async function obtenerVentas() {
  const respuesta = await fetch(VENTAS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener ventas')
  }

  return respuesta.json()
}

export async function obtenerClientesVentas() {
  const respuesta = await fetch(CLIENTES_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener clientes')
  }

  return respuesta.json()
}

export async function obtenerEmpleadosVentas() {
  const respuesta = await fetch(EMPLEADOS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener empleados')
  }

  return respuesta.json()
}
