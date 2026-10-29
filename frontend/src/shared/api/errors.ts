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
  const cashMessages: Record<string, string> = {
    shift_closed: 'El turno está cerrado. Abre un turno nuevo para continuar.',
    shift_already_open: 'La caja principal ya tiene un turno abierto. Solicita su cierre al responsable o encargado.',
    payment_incomplete: 'La venta exige el pago completo. Revisa el efectivo recibido.',
    insufficient_cash: 'El efectivo disponible no alcanza para ese retiro o reintegro.',
    reason_required: 'Indica el motivo de la diferencia de caja.',
    sale_already_voided: 'La venta ya fue anulada. Consulta su detalle.',
    invalid_return: 'Indica la cantidad realmente devuelta para cada línea de la venta original.',
    payment_reconciliation_required: 'Esta venta histórica no tiene un cobro registrado. Requiere conciliación antes de corregirla.',
    invalid_refund_reference: 'El reintegro por transferencia exige su referencia; el efectivo no la utiliza.',
  }
  if (error instanceof ApiError && cashMessages[error.code]) return cashMessages[error.code]!
  return error instanceof ApiError ? error.message : fallback
}
