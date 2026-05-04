const API_URL = '/api/productos/productos/'

export async function obtenerProductos() {
  const respuesta = await fetch(API_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener productos')
  }

  return respuesta.json()
}