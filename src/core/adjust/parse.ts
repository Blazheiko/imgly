import { parseDecimal } from '../geometry'
import { ADJUSTMENT_RANGES, type AdjustmentKey } from './types'

/** The fields shown with a "%" label, which also accept a trailing "%" (AC-05). */
const PERCENT_KEYS: ReadonlySet<AdjustmentKey> = new Set(['grayscale', 'sepia'])

/**
 * A typed Adjustment value (AC-05): plain decimal notation as in crop-rotate AC-07, a trailing "%"
 * only in the grayscale and sepia fields, snapped to the key's range and rounded half up
 * (2.5 → 3, −2.5 → −2). Empty or not a number returns `previous`. Never fails.
 */
export function parseAdjustmentField(text: string, key: AdjustmentKey, previous: number): number {
  const trimmed = text.trim()
  const bare = PERCENT_KEYS.has(key) && trimmed.endsWith('%') ? trimmed.slice(0, -1) : trimmed
  if (parseDecimal(bare) === null) return previous
  const { min, max } = ADJUSTMENT_RANGES[key]
  return Math.min(max, Math.max(min, roundHalfUp(bare.trim()))) || 0
}

/**
 * Rounds a plain decimal half up from its digits, so a fraction longer than a double holds
 * ("2.49999999999999999999") cannot collapse onto the half first.
 */
function roundHalfUp(decimal: string): number {
  const negative = decimal.startsWith('-')
  const [whole, fraction = ''] = decimal.replace(/^[+-]/, '').split(/[.,]/)
  const magnitude = Number(whole || '0')
  const first = fraction.charAt(0)
  const beyondHalf = first > '5' || (first === '5' && /[1-9]/.test(fraction.slice(1)))
  if (negative) return -(beyondHalf ? magnitude + 1 : magnitude)
  return first >= '5' ? magnitude + 1 : magnitude
}
