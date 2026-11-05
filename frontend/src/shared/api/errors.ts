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
    payment_incomplete: 'La venta exige el pago completo. Revisa el efectivo recibido.',
    sale_already_voided: 'La venta ya fue anulada. Consulta su detalle.',
    invalid_return: 'Indica la cantidad realmente devuelta para cada línea de la venta original.',
    payment_reconciliation_required: 'Esta venta histórica no tiene un cobro registrado. Requiere conciliación antes de corregirla.',
    invalid_refund_reference: 'El reintegro por transferencia exige su referencia; el efectivo no la utiliza.',
  }
  if (error instanceof ApiError && cashMessages[error.code]) return cashMessages[error.code]!
  if (!(error instanceof ApiError)) return fallback
  const messages: Record<string, string> = {
    'Authentication required': 'Tu sesión terminó. Inicia sesión para continuar.',
    'Invalid credentials': 'El usuario o la contraseña no son correctos.',
    'CSRF validation failed': 'La sesión necesita actualizarse. Vuelve a iniciar sesión si el problema continúa.',
    'Try again later': 'Se alcanzó el límite de intentos. Espera unos minutos antes de volver a iniciar sesión.',
    'Permission denied': 'Tu cuenta no tiene permiso para realizar esta acción.',
    'Database unavailable': 'El servicio no está disponible en este momento. Intenta de nuevo más tarde.',
    'Request could not be completed': 'No se pudo completar la solicitud.',
    'Record not found': 'No se encontró el registro solicitado.',
    'Account not found': 'No se encontró la cuenta solicitada.',
    'Employee not found': 'No se encontró el empleado seleccionado.',
    'Product not found': 'No se encontró el producto seleccionado.',
    'Supplier not found': 'No se encontró el proveedor seleccionado.',
    'Customer not found': 'No se encontró el cliente seleccionado.',
    'Sale not found': 'No se encontró la venta solicitada.',
    'Purchase not found': 'No se encontró la compra solicitada.',
    'Use the account employee': 'La operación debe usar el empleado vinculado a tu cuenta.',
    'Username or employee already assigned': 'El usuario o el empleado ya tienen una cuenta asignada.',
    'Employee already assigned': 'El empleado ya tiene una cuenta asignada.',
    'Invalid request': 'Revisa los datos indicados.',
  }
  const message = messages[error.message] ?? error.message
  if (error.code !== 'validation_error' || !error.fields.length) return message
  const labels: Record<string, string> = {
    username: 'Usuario', password: 'Contraseña', first_names: 'Nombres', last_names: 'Apellidos',
    phone_number: 'Teléfono', company_name: 'Empresa', contact_first_names: 'Nombres del contacto',
    contact_last_names: 'Apellidos del contacto', work_email: 'Correo', address: 'Domicilio',
    address_line: 'Dirección exacta', department_id: 'Departamento', municipality_id: 'Municipio',
    name: 'Nombre', cost: 'Costo', unit_price: 'Precio', category_id: 'Categoría', size_id: 'Talla',
    quantity: 'Cantidad', product_id: 'Producto', supplier_id: 'Proveedor', shipping_cost: 'Costo de envío',
    delivery_cost: 'Costo de entrega', payment: 'Pago', received_amount: 'Efectivo recibido',
    transfer_amount: 'Transferencia', logo_base64: 'Logo', start_date: 'Fecha de ingreso',
  }
  const details = error.fields.map(field => {
    const name = field.location.at(-1), item = field.location.find(part => typeof part === 'number')
    return `${typeof item === 'number' ? `Línea ${item + 1} · ` : ''}${typeof name === 'string' ? labels[name] ?? 'Campo solicitado' : 'Campo solicitado'}: ${validationMessage(field.type)}`
  })
  return `${message} ${[...new Set(details)].join(' ')}`
}

export function validationMessage(type: string): string {
  const messages: Record<string, string> = {
    missing: 'Completa este campo.', string_too_short: 'El texto no alcanza la longitud mínima permitida.',
    string_too_long: 'El texto supera la longitud máxima permitida.', string_pattern_mismatch: 'Usa el formato indicado para este campo.',
    greater_than: 'El valor debe ser mayor que el mínimo permitido.', greater_than_equal: 'El valor está por debajo del mínimo permitido.',
    less_than: 'El valor debe ser menor que el máximo permitido.', less_than_equal: 'El valor supera el máximo permitido.',
    int_type: 'Indica un número entero.', int_parsing: 'Indica un número entero.',
    literal_error: 'Selecciona una opción válida.', enum: 'Selecciona una opción válida.',
    decimal_parsing: 'Indica un importe válido.', decimal_max_places: 'El importe contiene demasiados decimales.',
    date_parsing: 'Indica una fecha válida.', date_from_datetime_parsing: 'Indica una fecha válida.',
    file_too_large: 'El archivo supera el tamaño permitido.',
  }
  return messages[type] ?? 'Revisa el valor de este campo.'
}
