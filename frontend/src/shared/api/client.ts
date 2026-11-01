import { ApiError, responseError } from './errors.ts'

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  idempotencyKey?: string
  fallback?: string
  responseType?: 'json' | 'blob'
}

type UnauthorizedListener = () => void

export class ApiClient {
  private csrfToken: string | null = null
  private csrfRequest: Promise<void> | null = null
  private sessionRevision = 0
  private unauthorizedListeners = new Set<UnauthorizedListener>()

  subscribeUnauthorized(listener: UnauthorizedListener): () => void {
    this.unauthorizedListeners.add(listener)
    return () => { this.unauthorizedListeners.delete(listener) }
  }

  clearCsrf(): void {
    this.sessionRevision += 1
    this.csrfToken = null
    this.csrfRequest = null
  }

  private sessionChanged(): ApiError {
    return new ApiError(409, 'session_changed', 'La sesión cambió. Revisa el acceso antes de continuar.')
  }

  async prepareCsrf(): Promise<void> {
    if (!this.csrfRequest) {
      const revision = this.sessionRevision
      const pending = this.request<unknown>('/api/v1/auth/csrf').then(body => {
        if (revision !== this.sessionRevision) throw this.sessionChanged()
        if (typeof body !== 'object' || body === null || !('csrf_token' in body)
          || typeof body.csrf_token !== 'string' || !body.csrf_token) {
          throw new ApiError(502, 'invalid_response', 'Respuesta de sesión no válida.')
        }
        this.csrfToken = body.csrf_token
      }).finally(() => { if (this.csrfRequest === pending) this.csrfRequest = null })
      this.csrfRequest = pending
    }
    return this.csrfRequest
  }

  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(path, 'http://same-origin.invalid')
    if (!path.startsWith('/api/v1/') || path.includes('\\')
      || url.origin !== 'http://same-origin.invalid' || !url.pathname.startsWith('/api/v1/')) {
      throw new Error('Only same-origin versioned API paths are supported')
    }
    const method = options.method ?? 'GET'
    const write = method !== 'GET'
    const versioned = url.pathname.startsWith('/api/v1/')
    const revision = this.sessionRevision
    if (versioned && write && !this.csrfToken) await this.prepareCsrf()
    if (versioned && revision !== this.sessionRevision) throw this.sessionChanged()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (versioned && write && this.csrfToken) headers['X-CSRF-Token'] = this.csrfToken
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
    const response = await fetch(path, {
      method, headers, credentials: 'same-origin', cache: 'no-store',
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    })
    if (versioned && revision !== this.sessionRevision) throw this.sessionChanged()
    if (versioned && response.ok && (url.pathname === '/api/v1/auth/login' || url.pathname === '/api/v1/auth/logout')) {
      this.clearCsrf()
    }
    const rotatedToken = response.headers.get('X-CSRF-Token')
    if (versioned && response.ok && rotatedToken) this.csrfToken = rotatedToken
    if (versioned && response.status === 401) {
      this.clearCsrf()
      this.unauthorizedListeners.forEach(listener => listener())
    }
    if (response.status === 204) return undefined as T
    const responseRevision = this.sessionRevision
    if (response.ok && options.responseType === 'blob') {
      const blob = await response.blob()
      if (responseRevision !== this.sessionRevision) throw this.sessionChanged()
      return blob as T
    }
    let body: unknown
    try { body = await response.json() } catch {
      if (response.ok) throw new ApiError(502, 'invalid_response', 'Respuesta del servidor no válida.')
    }
    if (versioned && responseRevision !== this.sessionRevision) throw this.sessionChanged()
    if (versioned && response.status === 403 && typeof body === 'object' && body !== null && 'error' in body) {
      const error = body.error
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'csrf_failed') this.clearCsrf()
    }
    if (!response.ok) throw responseError(response.status, body,
      options.fallback ?? 'No se pudo completar la solicitud.')
    return body as T
  }
}

export const apiClient = new ApiClient()
