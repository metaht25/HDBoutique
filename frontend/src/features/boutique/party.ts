import type { Customer, Employee, Supplier } from './contracts'

export type Party = Customer | Employee | Supplier
export type PartyKind = 'customers' | 'suppliers' | 'employees'
export const partyId = (row: Party) => 'customer_id' in row ? row.customer_id : 'supplier_id' in row ? row.supplier_id : row.employee_id
export const partyName = (row: Party) => 'company_name' in row ? row.company_name : `${row.first_names} ${row.last_names}`
export const partyLabels = { customers: 'cliente', suppliers: 'proveedor', employees: 'empleado' }

