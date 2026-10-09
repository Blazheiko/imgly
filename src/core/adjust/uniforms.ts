import { isNeutral } from './equality'
import type { Adjustments } from './types'

/**
 * The Adjustments pre-scaled for the shader's seven steps (ADR-0002, ADR-0003). Each neutral
 * value packs to its step's identity, and `enabled` is false when every value is neutral, so the
 * colour block is skipped and the output is bit for bit the unadjusted one.
 */
export interface AdjustUniforms {
  enabled: boolean
  /** Brightness: the gamma exponent `2 ^ (−b / 100)`, 2 at −100 … 0.5 at +100. */
  exponent: number
  /** Contrast: the factor around mid-grey, 0 at −100 … 4 at +100. */
  contrast: number
  /** Saturation: the factor around the lightness, 0 at −100 … 2 at +100. */
  saturation: number
  /** Temperature: red gains it, blue loses it, −0.2 … 0.2. */
  temperature: number
  /** Tint: green loses it, −0.2 … 0.2. */
  tint: number
  /** Grayscale: the mix amount, 0 … 1. */
  grayscale: number
  /** Sepia: the mix amount, 0 … 1. */
  sepia: number
}

export function toUniforms(a: Adjustments): AdjustUniforms {
  return {
    enabled: !isNeutral(a),
    exponent: 2 ** (-a.brightness / 100),
    contrast: a.contrast >= 0 ? 1 / (1 - (0.75 * a.contrast) / 100) : 1 + a.contrast / 100,
    saturation: 1 + a.saturation / 100,
    temperature: a.temperature / 500,
    tint: a.tint / 500,
    grayscale: a.grayscale / 100,
    sepia: a.sepia / 100,
  }
}
