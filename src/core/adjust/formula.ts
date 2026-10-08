import type { Adjustments } from './types'
import { toUniforms, type AdjustUniforms } from './uniforms'

/**
 * The CPU reference of the shader's colour block (ADR-0002, ADR-0003). It mirrors the GLSL step
 * for step, so unit tests pin the formulas' anchors and directions (AC-02 to AC-07) without a GPU.
 */

type Rgb = [number, number, number]

/** The stored mid-grey 128, the contrast pivot. */
const PIVOT = 128 / 255

/** The CSS `sepia()` matrix, row by row; every coefficient is at least the one below it. */
const SEPIA = [
  [0.393, 0.769, 0.189],
  [0.349, 0.686, 0.168],
  [0.272, 0.534, 0.131],
] as const

/** Rec. 709 lightness of a colour in 0…1, as CSS `grayscale()`. */
export function lightness(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const clampRgb = (c: Rgb): Rgb => [clamp01(c[0]), clamp01(c[1]), clamp01(c[2])]
/** GLSL `mix(x, y, t)`: exact at t = 0 and t = 1. */
const mix = (x: number, y: number, t: number) => x * (1 - t) + y * t

/** The seven steps on an unpremultiplied colour in 0…1, in their fixed order, clamped after each. */
function adjustColour(c: Rgb, u: AdjustUniforms): Rgb {
  if (u.exponent !== 1) c = clampRgb([c[0] ** u.exponent, c[1] ** u.exponent, c[2] ** u.exponent])
  if (u.contrast !== 1) {
    c = clampRgb([
      PIVOT + (c[0] - PIVOT) * u.contrast,
      PIVOT + (c[1] - PIVOT) * u.contrast,
      PIVOT + (c[2] - PIVOT) * u.contrast,
    ])
  }
  if (u.saturation !== 1) {
    const l = lightness(...c)
    c = clampRgb([
      l + (c[0] - l) * u.saturation,
      l + (c[1] - l) * u.saturation,
      l + (c[2] - l) * u.saturation,
    ])
  }
  if (u.temperature !== 0) {
    c = clampRgb([c[0] * (1 + u.temperature), c[1], c[2] * (1 - u.temperature)])
  }
  if (u.tint !== 0) c = clampRgb([c[0], c[1] * (1 - u.tint), c[2]])
  if (u.grayscale !== 0) {
    const l = lightness(...c)
    c = clampRgb([mix(c[0], l, u.grayscale), mix(c[1], l, u.grayscale), mix(c[2], l, u.grayscale)])
  }
  if (u.sepia !== 0) {
    const s = clampRgb(SEPIA.map(([kr, kg, kb]) => kr * c[0] + kg * c[1] + kb * c[2]) as Rgb)
    c = clampRgb([mix(c[0], s[0], u.sepia), mix(c[1], s[1], u.sepia), mix(c[2], s[2], u.sepia)])
  }
  return c
}

/**
 * One premultiplied RGBA pixel in 0…255 through the Adjustments, as the shader renders it: neutral
 * values return it unchanged, a fully transparent pixel stays (0, 0, 0, 0), and otherwise the
 * colour is unpremultiplied, adjusted and premultiplied back. Alpha is never changed (AC-06).
 * The result is not rounded.
 */
export function applyAdjustmentsToPixel(
  rgba: readonly [number, number, number, number],
  a: Adjustments,
): [number, number, number, number] {
  const u = toUniforms(a)
  const alpha = rgba[3]
  if (!u.enabled) return [rgba[0], rgba[1], rgba[2], alpha]
  if (alpha === 0) return [0, 0, 0, 0]
  const [r, g, b] = adjustColour([rgba[0] / alpha, rgba[1] / alpha, rgba[2] / alpha], u)
  return [r * alpha, g * alpha, b * alpha, alpha]
}
