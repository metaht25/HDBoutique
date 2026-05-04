const API_URL = '/api/productos/productos/'
const CATEGORIAS_URL = '/api/productos/categorias/'
const TALLAS_URL = '/api/productos/tallas/'

export async function obtenerProductos() {
  const respuesta = await fetch(API_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener productos')
  }

  return respuesta.json()
}

export async function crearProducto(producto) {
  const respuesta = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(producto),
  })

  if (!respuesta.ok) {
    throw new Error('Error al crear producto')
  }

  return respuesta.json()
}

export async function obtenerCategorias() {
  const respuesta = await fetch(CATEGORIAS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener categorias')
  }

  return respuesta.json()
}

export async function obtenerTallas() {
  const respuesta = await fetch(TALLAS_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener tallas')
  }

  return respuesta.json()
}
