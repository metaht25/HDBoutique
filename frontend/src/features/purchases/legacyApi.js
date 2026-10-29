// Legacy public names and payloads stay stable until the feature migration.
import { apiClient } from '../../shared/api/client.ts'

export function obtenerCompras() {
  return apiClient.request('/api/compras/compras/', { fallback: 'Error al obtener compras' })
}

export function obtenerDetallesCompras() {
  return apiClient.request('/api/compras/detalles-compras/', { fallback: 'Error al obtener detalles de compra' })
}

export function obtenerProveedoresCompras() {
  return apiClient.request('/api/proveedores/proveedores/', { fallback: 'Error al obtener proveedores' })
}

export function obtenerEmpleadosCompras() {
  return apiClient.request('/api/personas/empleados/', { fallback: 'Error al obtener empleados' })
}

export function obtenerProductosProveedoresCompras() {
  return apiClient.request('/api/proveedores/productos-proveedores/', { fallback: 'Error al obtener productos de proveedores' })
}

export function obtenerProductosCompras() {
  return apiClient.request('/api/productos/productos/', { fallback: 'Error al obtener productos' })
}
