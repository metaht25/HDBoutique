// Legacy public names and payloads stay stable until the feature migration.
import { apiClient } from '../../shared/api/client.ts'

export function obtenerClientes() {
  return apiClient.request('/api/personas/clientes/', { fallback: 'Error al obtener clientes' })
}

export function crearCliente(payload) {
  return apiClient.request('/api/personas/clientes/', { method: 'POST', body: payload, fallback: 'Error al crear cliente' })
}

export function actualizarCliente(id, payload) {
  return apiClient.request(`/api/personas/clientes/${id}/`, { method: 'PATCH', body: payload, fallback: 'Error al actualizar cliente' })
}

export function obtenerTiposClientes() {
  return apiClient.request('/api/personas/tipos-clientes/', { fallback: 'Error al obtener tipos de cliente' })
}

export function obtenerDepartamentos() {
  return apiClient.request('/api/departamentos/', { fallback: 'Error al obtener departamentos' })
}

export function obtenerMunicipios() {
  return apiClient.request('/api/municipios/', { fallback: 'Error al obtener municipios' })
}

export function crearDireccion(payload) {
  return apiClient.request('/api/direcciones/', { method: 'POST', body: payload, fallback: 'Error al crear direccion' })
}

export const DEUDAS_CLIENTES_URL = '/api/personas/deudas-clientes/'
