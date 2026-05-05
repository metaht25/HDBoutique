const PROVEEDORES_URL = '/api/proveedores/proveedores/'

export async function obtenerProveedores() {
  const respuesta = await fetch(PROVEEDORES_URL)

  if (!respuesta.ok) {
    throw new Error('Error al obtener proveedores')
  }

  return respuesta.json()
}
