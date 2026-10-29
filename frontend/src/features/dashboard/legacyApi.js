// Legacy public names and payloads stay stable until the feature migration.
import { apiClient } from '../../shared/api/client.ts'

export function obtenerProductosDashboard() {
  return apiClient.request('/api/productos/productos/', { fallback: 'Error al obtener productos' })
}

export function obtenerClientesDashboard() {
  return apiClient.request('/api/personas/clientes/', { fallback: 'Error al obtener clientes' })
}

export function obtenerVentasDashboard() {
  return apiClient.request('/api/ventas/ventas/', { fallback: 'Error al obtener ventas' })
}

export function obtenerComprasDashboard() {
  return apiClient.request('/api/compras/compras/', { fallback: 'Error al obtener compras' })
}

export function obtenerProveedoresDashboard() {
  return apiClient.request('/api/proveedores/proveedores/', { fallback: 'Error al obtener proveedores' })
}
