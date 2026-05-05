const PRODUCTOS_URL = '/api/productos/productos/'
const CLIENTES_URL = '/api/personas/clientes/'
const VENTAS_URL = '/api/ventas/ventas/'
const COMPRAS_URL = '/api/compras/compras/'
const PROVEEDORES_URL = '/api/proveedores/proveedores/'

async function obtenerDatos(url, mensajeError) {
  const respuesta = await fetch(url)

  if (!respuesta.ok) {
    throw new Error(mensajeError)
  }

  return respuesta.json()
}

export function obtenerProductosDashboard() {
  return obtenerDatos(PRODUCTOS_URL, 'Error al obtener productos')
}

export function obtenerClientesDashboard() {
  return obtenerDatos(CLIENTES_URL, 'Error al obtener clientes')
}

export function obtenerVentasDashboard() {
  return obtenerDatos(VENTAS_URL, 'Error al obtener ventas')
}

export function obtenerComprasDashboard() {
  return obtenerDatos(COMPRAS_URL, 'Error al obtener compras')
}

export function obtenerProveedoresDashboard() {
  return obtenerDatos(PROVEEDORES_URL, 'Error al obtener proveedores')
}
