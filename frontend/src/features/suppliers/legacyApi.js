// Legacy public names and payloads stay stable until the feature migration.
import { apiClient } from '../../shared/api/client.ts'

export function obtenerProveedores() {
  return apiClient.request('/api/proveedores/proveedores/', { fallback: 'Error al obtener proveedores' })
}
