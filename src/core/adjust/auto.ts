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

/** The long side of the sample Auto measures, in pixels (ADR-0004). */
export const AUTO_SAMPLE_MAX_SIDE = 512

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

/**
 * Narrows `range` (low/high per channel, in 0…255 levels) to the colours that store as this
 * premultiplied pixel: 8-bit storage steps `c × alpha / 255`, and engines round that step down,
 * up or to the nearest, so a partly transparent pixel only pins its colour to within one stored
 * level (ADR-0004 amendment). An opaque pixel pins it exactly. Returns false once the intervals
 * stop overlapping.
 */
function narrowColour(range: Float64Array, data: ArrayLike<number>, i: number, alpha: number) {
  const slack = alpha === 255 ? 0 : 1
  for (let ch = 0; ch < 3; ch++) {
    const stored = data[i + ch]!
    range[ch * 2] = Math.max(range[ch * 2]!, Math.ceil(((stored - slack) * 255) / alpha))
    range[ch * 2 + 1] = Math.min(range[ch * 2 + 1]!, Math.floor(((stored + slack) * 255) / alpha))
    if (range[ch * 2]! > range[ch * 2 + 1]!) return false
  }
  return true
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
  // The colours every pixel so far could share; empty once two pixels differ (AC-13).
  const shared = new Float64Array([0, 255, 0, 255, 0, 255])
  let varied = false

  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3]!
    if (alpha === 0) continue
    const r = Math.min(1, data[i]! / alpha)
    const g = Math.min(1, data[i + 1]! / alpha)
    const b = Math.min(1, data[i + 2]! / alpha)
    if (!varied && !narrowColour(shared, data, i, alpha)) varied = true
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
  // green mean to theirs (ADR-0003's temperature and tint gains, 0.2 at ±100). Tint is measured
  // after the temperature as written, so a clamped temperature still gets the right tint sign.
  const temperature = settle(sumR + sumB > 0 ? ((sumB - sumR) / (sumR + sumB)) * 500 : 0)
  const gain = temperature / 500
  const redBlue = (sumR * (1 + gain) + sumB * (1 - gain)) / 2
  const magenta = sumG > 0 ? 1 - redBlue / sumG : redBlue > 0 ? -Infinity : 0

  return {
    kind: 'values',
    values: {
      brightness,
      contrast,
      temperature,
      tint: settle(magenta * 500),
    },
  }
}
