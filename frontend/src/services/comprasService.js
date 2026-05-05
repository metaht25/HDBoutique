const COMPRAS_URL = '/api/compras/compras/'
const DETALLES_COMPRAS_URL = '/api/compras/detalles-compras/'
const PROVEEDORES_URL = '/api/proveedores/proveedores/'
const PRODUCTOS_PROVEEDORES_URL = '/api/proveedores/productos-proveedores/'
const PRODUCTOS_URL = '/api/productos/productos/'
const EMPLEADOS_URL = '/api/personas/empleados/'

export async function obtenerCompras() {
  const respuesta = await fetch(COMPRAS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener compras')
  }

  return respuesta.json()
}

export async function obtenerDetallesCompras() {
  const respuesta = await fetch(DETALLES_COMPRAS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener detalles de compra')
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

export async function obtenerProductosProveedoresCompras() {
  const respuesta = await fetch(PRODUCTOS_PROVEEDORES_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener productos de proveedores')
  }

  return respuesta.json()
}

export async function obtenerProductosCompras() {
  const respuesta = await fetch(PRODUCTOS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener productos')
  }

  return respuesta.json()
}
