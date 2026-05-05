const PRODUCTOS_URL = '/api/productos/productos/'
const CLIENTES_URL = '/api/personas/clientes/'
const TIPOS_CLIENTES_URL = '/api/personas/tipos-clientes/'
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

export function obtenerProductosReportes() {
  return obtenerDatos(PRODUCTOS_URL, 'Error al obtener productos')
}

export function obtenerClientesReportes() {
  return obtenerDatos(CLIENTES_URL, 'Error al obtener clientes')
}

export function obtenerTiposClientesReportes() {
  return obtenerDatos(TIPOS_CLIENTES_URL, 'Error al obtener tipos de cliente')
}

export function obtenerVentasReportes() {
  return obtenerDatos(VENTAS_URL, 'Error al obtener ventas')
}

export function obtenerComprasReportes() {
  return obtenerDatos(COMPRAS_URL, 'Error al obtener compras')
}

export function obtenerProveedoresReportes() {
  return obtenerDatos(PROVEEDORES_URL, 'Error al obtener proveedores')
}
