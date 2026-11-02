import { apiClient } from '../../shared/api/client'
import { allOptions, parseList, positiveId, record, requiredText } from '../../shared/api/validation'
export interface EmployeeOption { employee_id: number; first_names: string; last_names: string }
export function parseEmployeeOption(value: unknown): EmployeeOption {
  const row = record(value)
  return { employee_id: positiveId(row.employee_id), first_names: requiredText(row.first_names), last_names: requiredText(row.last_names) }
}
export function employeeOptions(signal: AbortSignal): Promise<EmployeeOption[]> {
  return allOptions(offset => apiClient.request(`/api/v1/employee-options?offset=${offset}&limit=100`, { signal })
    .then(body => parseList(body, parseEmployeeOption)), row => row.employee_id)
}
