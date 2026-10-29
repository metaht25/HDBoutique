import { apiClient } from '../../shared/api/client'
import { allOptions, invalidResponse, nullableText, parseList, positiveId, record } from '../../shared/api/validation'
import type { DecimalMoney } from '../../shared/api/types'

export interface Product {
  product_id: number; category_id: number; size_id: number; name: string | null
  unit_price: DecimalMoney | null; legacy_stock: number | null; legacy_stock_quantity: number | null
}
export interface ProductInput {
  category_id: number; size_id: number; name: string | null; unit_price: DecimalMoney | null
}
export interface Category { category_id: number; name: string | null }
export interface Size { size_id: number; name: string }

function stock(value: unknown): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < -2147483648 || value > 2147483647) return invalidResponse()
  return value
}
export function parseProduct(value: unknown): Product {
  const row = record(value)
  const price = nullableText(row.unit_price)
  if (price !== null && !/^-?\d{1,8}\.\d{2}$/.test(price)) return invalidResponse()
  return { product_id: positiveId(row.product_id), category_id: positiveId(row.category_id),
    size_id: positiveId(row.size_id), name: nullableText(row.name), unit_price: price,
    legacy_stock: stock(row.legacy_stock), legacy_stock_quantity: stock(row.legacy_stock_quantity) }
}
export async function listProducts(page: number, query: string, signal?: AbortSignal): Promise<Product[]> {
  const params = new URLSearchParams({ offset: String((page - 1) * 20), limit: '21' })
  if (query) params.set('q', query)
  return parseList(await apiClient.request(`/api/v1/products?${params}`, { signal }), parseProduct)
}
export async function productOptions(signal: AbortSignal) {
  const [categories, sizes] = await Promise.all([
    allOptions(offset => apiClient.request(`/api/v1/categories?offset=${offset}&limit=100`, { signal })
      .then(body => parseList(body, value => {
        const row = record(value)
        return { category_id: positiveId(row.category_id), name: nullableText(row.name) }
      })), row => row.category_id),
    allOptions(offset => apiClient.request(`/api/v1/sizes?offset=${offset}&limit=100`, { signal })
      .then(body => parseList(body, value => {
        const row = record(value)
        if (typeof row.name !== 'string') return invalidResponse()
        return { size_id: positiveId(row.size_id), name: row.name }
      })), row => row.size_id),
  ])
  return { categories, sizes }
}
export async function saveProduct(input: ProductInput, id?: number): Promise<Product> {
  return parseProduct(await apiClient.request(id ? `/api/v1/products/${id}` : '/api/v1/products', {
    method: id ? 'PATCH' : 'POST', body: input,
  }))
}
