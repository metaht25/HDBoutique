import { apiClient } from '../../shared/api/client'
import { allOptions, invalidResponse, nullableText, parseList, positiveId, record, requiredText } from '../../shared/api/validation'
import { isAccount } from '../../shared/api/types'
import type { Account } from '../../shared/api/types'
import { money } from '../reports/api'

export const catalogs = {
  departments: { label: 'Departamentos', id: 'department_id', field: 'name', fieldLabel: 'Nombre', max: 40, required: true },
  addresses: { label: 'Direcciones', id: 'address_id', field: 'address_line', fieldLabel: 'Detalle de dirección', max: 100, required: false },
  categories: { label: 'Categorías', id: 'category_id', field: 'name', fieldLabel: 'Nombre', max: 20, required: false },
  sizes: { label: 'Tallas', id: 'size_id', field: 'name', fieldLabel: 'Nombre', max: 20, required: true },
  'customer-types': { label: 'Tipos de cliente', id: 'customer_type_id', field: 'name', fieldLabel: 'Nombre', max: 20, required: false },
  'supplier-products': { label: 'Costes de compra', id: 'supplier_product_id', field: 'purchase_price', fieldLabel: 'Costo de compra (NIO)', max: 13, required: true },
  'supplier-offerings': { label: 'Ofertas de proveedores', id: 'offering_id', field: null, fieldLabel: '', max: 0, required: false },
} as const
export type Catalog = keyof typeof catalogs
export interface CatalogRow { id: number; text: string | null; department_id?: number; product_id?: number; supplier_id?: number; supplier_product_id?: number }
export interface Choice { id: number; label: string }
export function parseCatalog(kind: Catalog, value: unknown): CatalogRow {
  const row = record(value), config = catalogs[kind]
  return { id: positiveId(row[config.id]), text: config.field === null ? null : kind === 'supplier-products' ? money(row.purchase_price)
    : config.required ? requiredText(row[config.field]) : nullableText(row[config.field]),
    ...(kind === 'addresses' ? { department_id: positiveId(row.department_id) } : {}),
    ...(kind === 'supplier-products' ? { product_id: positiveId(row.product_id) } : {}),
    ...(kind === 'supplier-offerings' ? { supplier_id: positiveId(row.supplier_id), supplier_product_id: positiveId(row.supplier_product_id) } : {}),
  }
}
export async function listCatalog(kind: Catalog, page: number, signal: AbortSignal): Promise<CatalogRow[]> {
  return parseList(await apiClient.request(`/api/v1/${kind}?offset=${(page - 1) * 20}&limit=21`, { signal }), value => parseCatalog(kind, value))
}
export async function catalogChoices(kind: Catalog, signal: AbortSignal): Promise<Record<string, Choice[]>> {
  const load = (resource: string, parse: (value: unknown) => Choice) => allOptions(offset => apiClient.request(`/api/v1/${resource}?offset=${offset}&limit=100`, { signal })
    .then(body => parseList(body, parse)), row => row.id)
  if (kind === 'addresses') return { department_id: await load('departments', value => {
    const row = record(value); return { id: positiveId(row.department_id), label: requiredText(row.name) }
  }) }
  if (kind === 'supplier-products') return { product_id: await load('products', value => {
    const row = record(value); return { id: positiveId(row.product_id), label: nullableText(row.name) ?? `Producto #${row.product_id}` }
  }) }
  if (kind === 'supplier-offerings') {
    const [suppliers, costs, products] = await Promise.all([
      load('suppliers', value => { const row = record(value); return { id: positiveId(row.supplier_id), label: requiredText(row.company_name) } }),
      load('supplier-products', value => { const row = record(value); return { id: positiveId(row.supplier_product_id), label: `Producto #${positiveId(row.product_id)} · C$${money(row.purchase_price)}` } }),
      load('products', value => { const row = record(value); return { id: positiveId(row.product_id), label: nullableText(row.name) ?? 'Sin nombre' } }),
    ])
    return { supplier_id: suppliers, supplier_product_id: costs.map(cost => ({ ...cost, label: cost.label.replace(/Producto #(\d+)/, (match, id: string) => products.find(row => row.id === Number(id))?.label ?? match) })) }
  }
  return {}
}
export async function saveCatalog(kind: Catalog, body: Record<string, unknown>, id?: number): Promise<CatalogRow> {
  return parseCatalog(kind, await apiClient.request(`/api/v1/${kind}${id ? `/${id}` : ''}`, { method: id ? 'PATCH' : 'POST', body }))
}
export function parseAccount(value: unknown): Account {
  if (!isAccount(value)) return invalidResponse()
  return { user_id: value.user_id, username: value.username, role: value.role, employee_id: value.employee_id, is_active: value.is_active }
}
export async function listAccounts(signal: AbortSignal): Promise<Account[]> {
  return allOptions(offset => apiClient.request(`/api/v1/users?offset=${offset}&limit=100`, { signal }).then(body => parseList(body, parseAccount)), row => row.user_id)
}
export async function saveAccount(body: Record<string, unknown>, id?: number): Promise<Account> {
  return parseAccount(await apiClient.request(id ? `/api/v1/users/${id}` : '/api/v1/users', { method: id ? 'PATCH' : 'POST', body }))
}
export const preparationSteps = [
  { resource: 'departments', label: 'Departamentos', to: '/settings?section=departments', help: 'Registra el departamento antes de crear una dirección.' },
  { resource: 'addresses', label: 'Direcciones', to: '/settings?section=addresses', help: 'Necesarias para empleados, clientes y proveedores.' },
  { resource: 'categories', label: 'Categorías', to: '/settings?section=categories', help: 'Clasificación de los productos.' },
  { resource: 'sizes', label: 'Tallas', to: '/settings?section=sizes', help: 'Necesarias para registrar productos.' },
  { resource: 'customer-types', label: 'Tipos de cliente', to: '/settings?section=customer-types', help: 'Necesarios para registrar clientes; no aplican descuentos.' },
  { resource: 'employee-options', label: 'Empleados', to: '/employees', help: 'Responsables de compras, ventas y caja.' },
  { resource: 'products', label: 'Productos', to: '/products', help: 'Registra precio de venta; el stock nuevo comienza en cero.' },
  { resource: 'customers', label: 'Clientes', to: '/customers', help: 'Cada venta requiere un cliente existente.' },
  { resource: 'suppliers', label: 'Proveedores', to: '/suppliers', help: 'Cada compra requiere un proveedor existente.' },
  { resource: 'supplier-products', label: 'Costes de compra', to: '/settings?section=supplier-products', help: 'Registra producto y costo vigente de compra.' },
  { resource: 'supplier-offerings', label: 'Ofertas de proveedores', to: '/settings?section=supplier-offerings', help: 'Relaciona cada proveedor con los productos y costes que ofrece.' },
] as const
export async function preparationStatus(signal: AbortSignal): Promise<boolean[]> {
  const identifiers: Record<(typeof preparationSteps)[number]['resource'], string> = {
    departments: 'department_id', addresses: 'address_id', categories: 'category_id', sizes: 'size_id',
    'customer-types': 'customer_type_id', 'employee-options': 'employee_id', products: 'product_id',
    customers: 'customer_id', suppliers: 'supplier_id', 'supplier-products': 'supplier_product_id', 'supplier-offerings': 'offering_id',
  }
  return Promise.all(preparationSteps.map(async step => {
    const body = await apiClient.request(`/api/v1/${step.resource}?offset=0&limit=1`, { signal })
    if (!Array.isArray(body) || body.length > 1) return invalidResponse()
    if (body.length) positiveId(record(body[0])[identifiers[step.resource]])
    return body.length > 0
  }))
}
