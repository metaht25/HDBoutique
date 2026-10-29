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
  return new ApiError(status, 'http_error', fallback)
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}
