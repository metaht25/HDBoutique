// Legacy public names and payloads stay stable until the feature migration.
import { apiClient } from '../../shared/api/client.ts'

export function obtenerProductos() {
  return apiClient.request('/api/productos/productos/', { fallback: 'Error al obtener productos' })
}

export function crearProducto(payload) {
  return apiClient.request('/api/productos/productos/', { method: 'POST', body: payload, fallback: 'Error al crear producto' })
}

export function actualizarProducto(id, payload) {
  return apiClient.request(`/api/productos/productos/${id}/`, { method: 'PATCH', body: payload, fallback: 'Error al actualizar producto' })
}

export function obtenerCategorias() {
  return apiClient.request('/api/productos/categorias/', { fallback: 'Error al obtener categorias' })
}

export function obtenerTallas() {
  return apiClient.request('/api/productos/tallas/', { fallback: 'Error al obtener tallas' })
}
