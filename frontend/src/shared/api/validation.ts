import { ApiError } from './errors'

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalidResponse()
  return value as Record<string, unknown>
}
export function invalidResponse(): never {
  throw new ApiError(502, 'invalid_response', 'La respuesta recibida no es válida. Intenta recargar.')
}
export function positiveId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) return invalidResponse()
  return value
}
export function nullableText(value: unknown): string | null {
  if (value !== null && typeof value !== 'string') return invalidResponse()
  return value
}
export function requiredText(value: unknown): string {
  if (typeof value !== 'string') return invalidResponse()
  return value
}
export function parseList<T>(value: unknown, parse: (row: unknown) => T): T[] {
  if (!Array.isArray(value)) return invalidResponse()
  return value.map(parse)
}
export async function allOptions<T>(load: (offset: number) => Promise<T[]>, id: (row: T) => number): Promise<T[]> {
  const rows: T[] = []
  const seen = new Set<number>()
  for (let offset = 0; ; offset += 100) {
    const page = await load(offset)
    if (page.length > 100 || page.some(row => seen.has(id(row)))
      || new Set(page.map(id)).size !== page.length) return invalidResponse()
    page.forEach(row => seen.add(id(row)))
    rows.push(...page)
    if (page.length < 100) return rows
  }
}
