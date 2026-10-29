import type { ValidationField } from './types.ts'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: ValidationField[]

  constructor(status: number, code: string, message: string, fields: ValidationField[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function legacyMessages(value: unknown, prefix = '', depth = 0): string[] {
  if (depth > 3) return []
  if (typeof value === 'string') return [prefix ? `${prefix}: ${value}` : value]
  if (Array.isArray(value)) return value.flatMap(item => legacyMessages(item, prefix, depth + 1))
  if (isRecord(value)) return Object.entries(value).flatMap(([key, item]) =>
    legacyMessages(item, prefix ? `${prefix}.${key}` : key, depth + 1))
  return []
}

export function responseError(status: number, body: unknown, fallback: string): ApiError {
  if (isRecord(body) && isRecord(body.error)
    && typeof body.error.code === 'string' && typeof body.error.message === 'string') {
    const fields = Array.isArray(body.error.fields) ? body.error.fields.filter(
      (field): field is ValidationField => isRecord(field) && typeof field.type === 'string'
        && Array.isArray(field.location)
        && field.location.every(part => typeof part === 'string' || typeof part === 'number'),
    ) : []
    return new ApiError(status, body.error.code, body.error.message, fields)
  }
  // DRF detail/field errors stay at the legacy boundary; HTML is never rendered.
  const messages = isRecord(body) ? legacyMessages(body) : []
  return new ApiError(status, 'http_error', messages.slice(0, 8).join(' · ') || fallback)
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}
