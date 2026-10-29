import { describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../../src/shared/api/client'
import { ApiError, getErrorMessage, responseError } from '../../src/shared/api/errors'

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers })
}

describe('shared API client', () => {
  it('preserves response envelopes, nulls and decimal text with same-origin credentials', async () => {
    const body = { results: [{ unit_price: '199.50', stock: null }], next: null }
    const fetchMock = vi.fn().mockResolvedValue(json(body))
    vi.stubGlobal('fetch', fetchMock)
    const result = await new ApiClient().request('/api/productos/productos/')
    expect(result).toEqual(body)
    expect(fetchMock).toHaveBeenCalledWith('/api/productos/productos/', expect.objectContaining({
      credentials: 'same-origin', cache: 'no-store', method: 'GET',
    }))
  })

  it('bootstraps CSRF once for concurrent writes, rotates it and keeps it off legacy calls', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ csrf_token: 'synthetic-csrf' }))
      .mockResolvedValueOnce(json({ id: 1 }, 201, { 'X-CSRF-Token': 'rotated-csrf' }))
      .mockResolvedValueOnce(json({ id: 2 }, 201))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({}))
    vi.stubGlobal('fetch', fetchMock)
    const client = new ApiClient()
    await Promise.all([
      client.request('/api/v1/sales', { method: 'POST', body: { items: [] }, idempotencyKey: 'synthetic-sale' }),
      client.request('/api/v1/customers', { method: 'POST', body: {} }),
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/auth/csrf')
    expect(fetchMock.mock.calls[1]?.[1].headers).toMatchObject({
      'X-CSRF-Token': 'synthetic-csrf', 'Idempotency-Key': 'synthetic-sale',
      'Content-Type': 'application/json',
    })
    await client.request('/api/v1/customers', { method: 'POST', body: {} })
    expect(fetchMock.mock.calls[3]?.[1].headers['X-CSRF-Token']).toBe('rotated-csrf')
    await client.request('/api/personas/clientes/', { method: 'POST', body: {} })
    expect(fetchMock.mock.calls[4]?.[1].headers['X-CSRF-Token']).toBeUndefined()
  })

  it('handles logout 204 without JSON and preserves abort signals', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ csrf_token: 'test-csrf' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal
    await expect(new ApiClient().request('/api/v1/auth/logout', { method: 'POST', signal }))
      .resolves.toBeUndefined()
    expect(fetchMock.mock.calls[1]?.[1].signal).toBe(signal)
  })

  it('notifies on expired versioned sessions and drops the previous CSRF token', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ csrf_token: 'old-token' }))
      .mockResolvedValueOnce(json({ error: { code: 'authentication_required', message: 'Session expired' } }, 401))
      .mockResolvedValueOnce(json({ csrf_token: 'new-token' }))
      .mockResolvedValueOnce(json({}))
    vi.stubGlobal('fetch', fetchMock)
    const client = new ApiClient()
    const expired = vi.fn()
    const unsubscribe = client.subscribeUnauthorized(expired)
    await client.prepareCsrf()
    await expect(client.request('/api/v1/auth/me')).rejects.toMatchObject({ status: 401 })
    expect(expired).toHaveBeenCalledOnce()
    unsubscribe()
    await client.request('/api/v1/customers', { method: 'POST', body: {} })
    expect(fetchMock.mock.calls[3]?.[1].headers['X-CSRF-Token']).toBe('new-token')
  })

  it('does not retry writes after conflicts or CSRF failures', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ csrf_token: 'token' }))
      .mockResolvedValueOnce(json({ error: { code: 'insufficient_stock', message: 'Stock insuficiente' } }, 409))
      .mockResolvedValueOnce(json({ error: { code: 'csrf_rejected', message: 'CSRF rechazado' } }, 403))
    vi.stubGlobal('fetch', fetchMock)
    const client = new ApiClient()
    await expect(client.request('/api/v1/sales', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ status: 409, code: 'insufficient_stock', message: 'Stock insuficiente' })
    await expect(client.request('/api/v1/sales', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ status: 403 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('uses a safe fallback for HTML errors and rejects invalid success JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('<html>Private debug data</html>', { status: 502 }))
      .mockResolvedValueOnce(new Response('not json'))
    vi.stubGlobal('fetch', fetchMock)
    const client = new ApiClient()
    await expect(client.request('/api/v1/products', { fallback: 'Servicio no disponible' }))
      .rejects.toMatchObject({ message: 'Servicio no disponible', status: 502 })
    await expect(client.request('/api/v1/products')).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('rejects malformed CSRF data before writing, and permits a later retry', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ csrf_token: null }))
      .mockResolvedValueOnce(json({ csrf_token: 'valid-token' }))
      .mockResolvedValueOnce(json({}))
    vi.stubGlobal('fetch', fetchMock)
    const client = new ApiClient()
    await expect(client.request('/api/v1/customers', { method: 'POST' }))
      .rejects.toMatchObject({ code: 'invalid_response' })
    expect(fetchMock).toHaveBeenCalledOnce()
    await client.request('/api/v1/customers', { method: 'POST' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it.each([
    'https://invalid.example/api/v1/sales', '//invalid.example/api/v1/sales',
    '/api/../../outside', '/api/\\invalid',
  ])('rejects non-local API target %s before sending credentials', async path => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      await expect(new ApiClient().request(path, { method: 'POST' })).rejects.toThrow()
      expect(fetchMock).not.toHaveBeenCalled()
    })

  it('retains abort/network errors and maps their visible message to a fallback', async () => {
    const failure = new DOMException('Synthetic abort', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure))
    await expect(new ApiClient().request('/api/v1/products')).rejects.toBe(failure)
    expect(getErrorMessage(failure, 'No se pudo conectar')).toBe('No se pudo conectar')
  })
})

describe('typed errors', () => {
  it('preserves safe backend messages and validated field locations', () => {
    const error = responseError(422, { error: { code: 'validation_error', message: 'Datos inválidos', fields: [
      { location: ['body', 'items', 0, 'quantity'], type: 'greater_than' }, { type: 'invalid' },
    ] } }, 'Fallback')
    expect(error).toBeInstanceOf(ApiError)
    expect(error.fields).toEqual([{ location: ['body', 'items', 0, 'quantity'], type: 'greater_than' }])
    expect(getErrorMessage(error, 'Fallback')).toBe('Datos inválidos')
  })
  it('accepts DRF field errors without flattening successful paginated data', () => {
    expect(responseError(400, { nombre: ['Obligatorio'], nested: { price: ['Inválido'] } }, 'Fallback').message)
      .toBe('nombre: Obligatorio · nested.price: Inválido')
    expect(responseError(503, null, 'No disponible').message).toBe('No disponible')
  })
})
