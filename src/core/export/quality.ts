export const DEFAULT_QUALITY = 90
export const MIN_QUALITY = 1
export const MAX_QUALITY = 100

/**
 * A typed quality applied on leaving the field: out of range snaps to the nearest bound, a fraction
 * rounds, empty or non-numeric returns to `previous`. AC-04
 */
export function normalizeQuality(raw: string, previous: number): number {
  const value = parseNumber(raw)
  if (value === null) return previous
  return Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, Math.round(value)))
}

/** A trimmed numeric string as a number, or null when it is empty or not a number. */
export function parseNumber(raw: string): number | null {
  const text = raw.trim()
  if (text === '') return null
  const value = Number(text)
  return Number.isNaN(value) ? null : value
}
