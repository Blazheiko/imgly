import { parseDecimal } from '../geometry'
import { MAX_WIDTH, MIN_WIDTH } from './settings'

/** A trailing "px", in any letter case, with or without spaces before it (AC-03). */
const PX_SUFFIX = /\s*px$/i

const clampWidth = (width: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))

/**
 * A typed width (AC-03): plain decimal notation as in crop-rotate AC-07, an optional "px",
 * rounded half up (2.5 → 3) and snapped to 1…200. Empty or not a number returns `previous`.
 */
export function parseWidth(text: string, previous: number): number {
  const bare = text.trim().replace(PX_SUFFIX, '')
  const value = parseDecimal(bare)
  if (value === null) return previous
  if (value <= 0) return MIN_WIDTH
  return clampWidth(roundHalfUp(bare.trim()))
}

/**
 * Rounds a positive plain decimal half up from its digits, so a fraction longer than a double
 * holds ("2.49999999999999999999") cannot collapse onto the half first.
 */
function roundHalfUp(decimal: string): number {
  const [whole, fraction = ''] = decimal.replace(/^\+/, '').split(/[.,]/)
  return Number(whole || '0') + (fraction.charAt(0) >= '5' ? 1 : 0)
}

/** The width after `[` or `]` (±1, ±10 with Shift), kept within 1…200 (AC-19). */
export function stepWidth(width: number, delta: number): number {
  return clampWidth(width + delta)
}
