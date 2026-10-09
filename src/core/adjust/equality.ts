import { ADJUSTMENT_KEYS, NEUTRAL_ADJUSTMENTS, type Adjustments } from './types'

/** Field by field, never by the pixels the Adjustments produce (AC-11). */
export function adjustmentsEquals(a: Adjustments, b: Adjustments): boolean {
  return ADJUSTMENT_KEYS.every((key) => a[key] === b[key])
}

/** Every value at its neutral, so the colour block can be skipped. */
export function isNeutral(a: Adjustments): boolean {
  return adjustmentsEquals(a, NEUTRAL_ADJUSTMENTS)
}
