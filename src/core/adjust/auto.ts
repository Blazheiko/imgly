import { lightness } from './formula'
import type { Adjustments } from './types'

/** Premultiplied RGBA, 8 bits per channel, row-major: what the Preview context reads back. */
export interface ImageSample {
  width: number
  height: number
  data: Uint8Array | Uint8ClampedArray
}

export type AutoValues = Pick<Adjustments, 'brightness' | 'contrast' | 'temperature' | 'tint'>

export type AutoResult = { kind: 'values'; values: AutoValues } | { kind: 'nothing' }

/** Auto never moves a slider further than this from neutral (AC-13). */
const AUTO_LIMIT = 50
const MID = 128 / 255
const LOW_TARGET = 5 / 255
const HIGH_TARGET = 250 / 255
const LOW_PERCENTILE = 0.005
const HIGH_PERCENTILE = 0.995

/** Rounded half up and clamped to ±50, never −0. */
function settle(value: number): number {
  return Math.min(AUTO_LIMIT, Math.max(-AUTO_LIMIT, Math.floor(value + 0.5))) || 0
}

/** The lightness bin (0…255) holding the given fraction of the samples, counted from the dark end. */
function percentileBin(histogram: Uint32Array, count: number, fraction: number): number {
  const rank = Math.max(1, Math.ceil(count * fraction))
  let seen = 0
  for (let bin = 0; bin < histogram.length; bin++) {
    seen += histogram[bin]!
    if (seen >= rank) return bin
  }
  return histogram.length - 1
}

/** The brightness `b` whose exponent `2 ^ (−b / 100)` maps the median lightness to mid-grey. */
function brightnessFor(median: number): number {
  if (median <= 0) return AUTO_LIMIT
  if (median >= 1) return -AUTO_LIMIT
  const exponent = Math.log(MID) / Math.log(median)
  return -100 * Math.log2(exponent)
}

/** The contrast `k` whose factor stretches `lo` and `hi` towards 5 and 250 without passing them. */
function contrastFor(lo: number, hi: number): number {
  const factors: number[] = []
  if (lo < MID) factors.push((MID - LOW_TARGET) / (MID - lo))
  if (hi > MID) factors.push((HIGH_TARGET - MID) / (hi - MID))
  if (factors.length === 0) return 0
  const f = Math.min(...factors)
  return f >= 1 ? ((1 - 1 / f) * 100) / 0.75 : (f - 1) * 100
}

/**
 * Brightness, contrast, temperature and tint measured from a sample of the Work (ADR-0004), or
 * `nothing` when no pixel is visible or every visible pixel has the same colour. Fully transparent
 * samples are skipped and the rest count at their unpremultiplied colour. Pure and deterministic.
 */
export function autoAdjust(sample: ImageSample): AutoResult {
  const { data } = sample
  const histogram = new Uint32Array(256)
  let count = 0
  let sumR = 0
  let sumG = 0
  let sumB = 0
  let first: [number, number, number] | null = null
  let varied = false

  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3]!
    if (alpha === 0) continue
    const r = Math.min(1, data[i]! / alpha)
    const g = Math.min(1, data[i + 1]! / alpha)
    const b = Math.min(1, data[i + 2]! / alpha)
    if (first === null) first = [r, g, b]
    else if (!varied && (r !== first[0] || g !== first[1] || b !== first[2])) varied = true
    histogram[Math.min(255, Math.round(lightness(r, g, b) * 255))]!++
    sumR += r
    sumG += g
    sumB += b
    count++
  }
  if (count === 0 || !varied) return { kind: 'nothing' }

  const brightness = settle(brightnessFor(percentileBin(histogram, count, 0.5) / 255))
  const exponent = 2 ** (-brightness / 100)
  const lo = (percentileBin(histogram, count, LOW_PERCENTILE) / 255) ** exponent
  const hi = (percentileBin(histogram, count, HIGH_PERCENTILE) / 255) ** exponent
  const contrast = settle(contrastFor(lo, hi))

  // Grey world: the gain that makes the red and blue means equal, then the one that brings the
  // green mean to theirs (ADR-0003's temperature and tint gains, 0.2 at ±100).
  const warmth = sumR + sumB > 0 ? (sumB - sumR) / (sumR + sumB) : 0
  const redBlue = sumR * (1 + warmth)
  const magenta = sumG > 0 ? 1 - redBlue / sumG : redBlue > 0 ? -Infinity : 0

  return {
    kind: 'values',
    values: {
      brightness,
      contrast,
      temperature: settle(warmth * 500),
      tint: settle(magenta * 500),
    },
  }
}
