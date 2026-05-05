const COMPRAS_URL = '/api/compras/compras/'
const PROVEEDORES_URL = '/api/proveedores/proveedores/'
const EMPLEADOS_URL = '/api/personas/empleados/'

export async function obtenerCompras() {
  const respuesta = await fetch(COMPRAS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener compras')
  }

  return respuesta.json()
}

export async function obtenerProveedoresCompras() {
  const respuesta = await fetch(PROVEEDORES_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener proveedores')
  }

  return respuesta.json()
}

export async function obtenerEmpleadosCompras() {
  const respuesta = await fetch(EMPLEADOS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener empleados')
  }

  return respuesta.json()
}
