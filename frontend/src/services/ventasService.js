const VENTAS_URL = '/api/ventas/ventas/'
const DETALLES_VENTAS_URL = '/api/ventas/detalles-ventas/'
const CLIENTES_URL = '/api/personas/clientes/'
const EMPLEADOS_URL = '/api/personas/empleados/'
const PRODUCTOS_URL = '/api/productos/productos/'

async function enviarDatos(url, datos, mensajeError) {
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(datos),
  })

  if (!respuesta.ok) {
    throw new Error(mensajeError)
  }

  return respuesta.json()
}

export async function obtenerVentas() {
  const respuesta = await fetch(VENTAS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener ventas')
  }

  return respuesta.json()
}

export async function obtenerDetallesVentas() {
  const respuesta = await fetch(DETALLES_VENTAS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener detalles de venta')
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

export async function obtenerProductosVentas() {
  const respuesta = await fetch(PRODUCTOS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener productos')
  }

  return respuesta.json()
}

export function crearVenta(datosVenta) {
  return enviarDatos(VENTAS_URL, datosVenta, 'Error al crear la venta')
}

export function crearDetalleVenta(datosDetalle) {
  return enviarDatos(DETALLES_VENTAS_URL, datosDetalle, 'Error al crear el detalle de venta')
}
