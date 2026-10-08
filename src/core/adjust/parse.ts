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
  const value = parseDecimal(bare)
  if (value === null) return previous
  const { min, max } = ADJUSTMENT_RANGES[key]
  return Math.min(max, Math.max(min, Math.floor(value + 0.5))) || 0
}
