import { STRAIGHTEN_LIMIT } from './straighten'

/** Digits with an optional sign and one decimal point or comma, however long (AC-07, AC-10). */
const PLAIN_DECIMAL = /^[+-]?(\d+[.,]?\d*|[.,]\d+)$/

/** A number written in plain decimal notation, or null; `1e2`, hex and words are not numbers. */
export function parseDecimal(text: string): number | null {
  const t = text.trim()
  if (!PLAIN_DECIMAL.test(t)) return null
  return Number(t.replace(',', '.'))
}

/**
 * A typed Straighten angle in degrees, as tenths (AC-07): the nearest 0.1° (a half away from 0),
 * snapped to ±45°; empty or not a number returns `previous`.
 */
export function parseAngle(text: string, previous: number): number {
  const value = parseDecimal(text)
  if (value === null) return previous
  const tenths = Math.sign(value) * Math.round(Math.abs(value) * 10)
  return Math.min(STRAIGHTEN_LIMIT, Math.max(-STRAIGHTEN_LIMIT, tenths)) || 0
}

/**
 * A typed crop width or height (AC-10, export AC-04's rules): a fraction rounds, zero or negative
 * becomes 1, empty or not a number returns `previous`. The "larger than fits" limit is
 * `setCropSize`'s, which knows the image.
 */
export function parseCropSize(text: string, previous: number): number {
  const value = parseDecimal(text)
  if (value === null) return previous
  return Math.max(1, Math.round(value))
}
