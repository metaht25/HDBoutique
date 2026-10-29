import { expect, it, vi } from 'vitest'
import { parseProduct, saveProduct } from '../../src/features/products/api'
import { apiClient } from '../../src/shared/api/client'
import { displayMoney, exactMoney } from '../../src/shared/forms/fields'
import { allOptions } from '../../src/shared/api/validation'

const product = { product_id: 1, category_id: 2, size_id: 3, name: null,
  unit_price: '199.50', legacy_stock: null, legacy_stock_quantity: 12 }

it('preserves null stock, separate history and decimal text', () => {
  expect(parseProduct(product)).toEqual(product)
  expect(displayMoney('199.50')).toBe('C$199.50')
  expect(displayMoney(null)).toBe('Sin precio')
  expect(exactMoney('0.10')).toBe('0.10')
  expect(exactMoney('99999999.99')).toBe('99999999.99')
  expect(exactMoney('-0.00')).toBe('0.00')
})
it.each(['1e2', '0.001', '100000000.00', 'NaN', '199,50'])('rejects inexact price %s', value => {
  expect(exactMoney(value)).toBeNull()
})
it.each([{ ...product, unit_price: 199.5 }, { ...product, legacy_stock: '0' },
  { ...product, product_id: 0 }, { ...product, name: undefined }])('rejects invalid API data', value => {
  expect(() => parseProduct(value)).toThrow()
})
it('uses only approved metadata fields and a decimal string on writes', async () => {
  const request = vi.spyOn(apiClient, 'request').mockResolvedValue(product)
  await saveProduct({ name: null, category_id: 2, size_id: 3, unit_price: '199.50' }, 1)
  expect(request).toHaveBeenCalledWith('/api/v1/products/1', {
    method: 'PATCH', body: { name: null, category_id: 2, size_id: 3, unit_price: '199.50' },
  })
})
it('loads lookup options beyond their first page and rejects a repeated page', async () => {
  const first = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }))
  const load = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce([{ id: 101 }])
  expect(await allOptions<{ id: number }>(load, row => row.id)).toHaveLength(101)
  expect(load).toHaveBeenNthCalledWith(2, 100)
  await expect(allOptions(async () => first, row => row.id)).rejects.toThrow()
})
