// Legacy public names and payloads stay stable until the feature migration.
import { apiClient } from '../../shared/api/client.ts'

export function obtenerVentas() {
  return apiClient.request('/api/ventas/ventas/', { fallback: 'Error al obtener ventas' })
}

export function obtenerDetallesVentas() {
  return apiClient.request('/api/ventas/detalles-ventas/', { fallback: 'Error al obtener detalles de venta' })
}

export function obtenerClientesVentas() {
  return apiClient.request('/api/personas/clientes/', { fallback: 'Error al obtener clientes' })
}

export function obtenerEmpleadosVentas() {
  return apiClient.request('/api/personas/empleados/', { fallback: 'Error al obtener empleados' })
}

export function obtenerProductosVentas() {
  return apiClient.request('/api/productos/productos/', { fallback: 'Error al obtener productos' })
}

export function crearVenta(payload) {
  return apiClient.request('/api/ventas/ventas/', { method: 'POST', body: payload, fallback: 'Error al crear la venta' })
}

export function crearDetalleVenta(payload) {
  return apiClient.request('/api/ventas/detalles-ventas/', { method: 'POST', body: payload, fallback: 'Error al crear el detalle de venta' })
}
