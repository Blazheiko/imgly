import type { Size } from '../view'
import { parseNumber } from './quality'

export const SIZE_PRESETS = [100, 75, 50, 25] as const

/** An export size in the form it was chosen, so session memory can keep that form. AC-19 */
export type SizeChoice = { kind: 'preset'; percent: number } | { kind: 'longSide'; px: number }

/**
 * The long side a choice asks for, before the AC-06 snap. A preset rounds half up in integers:
 * `floor((2·W·p + 100) / 200)`. AC-05
 */
export function longSideFor(work: Size, choice: SizeChoice): number {
  if (choice.kind === 'longSide') return choice.px
  const { long } = sides(work)
  return Math.floor((2 * long * choice.percent + 100) / 200)
}

/** The least long side whose short side, rounded half up, is at least 1 px. AC-06 */
export function minLongSide(work: Size): number {
  const { long, short } = sides(work)
  return Math.max(1, Math.ceil(long / (2 * short)))
}

/** The exact export dimensions for a choice, proportions kept and snapped to AC-06. AC-05 */
export function exportSize(work: Size, choice: SizeChoice): Size {
  const { long, short } = sides(work)
  const exportLong = snapLongSide(longSideFor(work, choice), work)
  const exportShort = Math.floor((2 * exportLong * short + long) / (2 * long))
  return work.width >= work.height
    ? { width: exportLong, height: exportShort }
    : { width: exportShort, height: exportLong }
}

/**
 * A typed long side applied on leaving the field: a fraction rounds, empty or non-numeric returns
 * to `previous`, then the AC-06 snap. AC-05, AC-06
 */
export function normalizeLongSide(raw: string, previous: number, work: Size): number {
  const value = parseNumber(raw)
  if (value === null) return previous
  return snapLongSide(Math.round(value), work)
}

function snapLongSide(px: number, work: Size): number {
  const { long } = sides(work)
  if (px > long) return long
  return Math.max(px, minLongSide(work))
}

function sides(work: Size): { long: number; short: number } {
  return {
    long: Math.max(work.width, work.height),
    short: Math.min(work.width, work.height),
  }
}
