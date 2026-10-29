// Legacy public names and payloads stay stable until the feature migration.
import { apiClient } from '../../shared/api/client.ts'

export function obtenerProductosReportes() {
  return apiClient.request('/api/productos/productos/', { fallback: 'Error al obtener productos' })
}

export function obtenerClientesReportes() {
  return apiClient.request('/api/personas/clientes/', { fallback: 'Error al obtener clientes' })
}

export function obtenerTiposClientesReportes() {
  return apiClient.request('/api/personas/tipos-clientes/', { fallback: 'Error al obtener tipos de cliente' })
}

export function obtenerVentasReportes() {
  return apiClient.request('/api/ventas/ventas/', { fallback: 'Error al obtener ventas' })
}

export function obtenerComprasReportes() {
  return apiClient.request('/api/compras/compras/', { fallback: 'Error al obtener compras' })
}

export function obtenerProveedoresReportes() {
  return apiClient.request('/api/proveedores/proveedores/', { fallback: 'Error al obtener proveedores' })
}
