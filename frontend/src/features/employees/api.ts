import { apiClient } from '../../shared/api/client'
import { allOptions, invalidResponse, nullableText, parseList, positiveId, record, requiredText } from '../../shared/api/validation'
import type { CustomerOptions } from '../customers/api'
export type EmployeeLocations = Pick<CustomerOptions, 'addresses' | 'departments'>
export type { Address } from '../customers/api'
export interface EmployeeInput {
  first_names: string; last_names: string; phone_number: string; address_id: number;
  work_email: string | null; job_title: string | null; start_date: string | null; end_date: string | null
}
export interface Employee extends EmployeeInput { employee_id: number }
export interface EmployeeOption { employee_id: number; first_names: string; last_names: string }
function nullableDate(value: unknown): string | null {
  if (value === null) return null
  const text = requiredText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return invalidResponse()
  return text
}
export function parseEmployeeOption(value: unknown): EmployeeOption {
  const row = record(value)
  return { employee_id: positiveId(row.employee_id), first_names: requiredText(row.first_names), last_names: requiredText(row.last_names) }
}
export function parseEmployee(value: unknown): Employee {
  const row = record(value)
  return { ...parseEmployeeOption(row), address_id: positiveId(row.address_id), phone_number: requiredText(row.phone_number),
    work_email: nullableText(row.work_email), job_title: nullableText(row.job_title), start_date: nullableDate(row.start_date), end_date: nullableDate(row.end_date) }
}
export async function listEmployees(page: number, query: string, signal?: AbortSignal): Promise<Employee[]> {
  const params = new URLSearchParams({ offset: String((page - 1) * 20), limit: '21', q: query })
  return parseList(await apiClient.request(`/api/v1/employees?${params}`, { signal }), parseEmployee)
}
export async function employeeLocations(signal: AbortSignal): Promise<EmployeeLocations> {
  const [addresses, departments] = await Promise.all([
    allOptions(offset => apiClient.request(`/api/v1/addresses?offset=${offset}&limit=100`, { signal }).then(body => parseList(body, value => {
      const row = record(value); return { address_id: positiveId(row.address_id), department_id: positiveId(row.department_id), address_line: nullableText(row.address_line) }
    })), row => row.address_id),
    allOptions(offset => apiClient.request(`/api/v1/departments?offset=${offset}&limit=100`, { signal }).then(body => parseList(body, value => {
      const row = record(value); return { department_id: positiveId(row.department_id), name: requiredText(row.name) }
    })), row => row.department_id),
  ])
  return { addresses, departments }
}
export function employeeOptions(signal: AbortSignal): Promise<EmployeeOption[]> {
  return allOptions(offset => apiClient.request(`/api/v1/employee-options?offset=${offset}&limit=100`, { signal })
    .then(body => parseList(body, parseEmployeeOption)), row => row.employee_id)
}
export async function saveEmployee(input: EmployeeInput, id?: number): Promise<Employee> {
  return parseEmployee(await apiClient.request(id ? `/api/v1/employees/${id}` : '/api/v1/employees', { method: id ? 'PATCH' : 'POST', body: input }))
}
