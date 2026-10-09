/**
 * The Work's seven colour values (feature ADR-0001). Every field is a whole number and always
 * present, so two Adjustments compare exactly, field by field (AC-11).
 */
export interface Adjustments {
  brightness: number
  contrast: number
  saturation: number
  temperature: number
  tint: number
  /** 0…100, shown with a "%" label. */
  grayscale: number
  /** 0…100, shown with a "%" label. */
  sepia: number
}

export type AdjustmentKey = keyof Adjustments

/** The fixed order the seven steps run in (ADR-0003), and the order the controls list them. */
export const ADJUSTMENT_KEYS: readonly AdjustmentKey[] = Object.freeze([
  'brightness',
  'contrast',
  'saturation',
  'temperature',
  'tint',
  'grayscale',
  'sepia',
])

export interface AdjustmentRange {
  min: number
  max: number
  neutral: number
}

const SIGNED: AdjustmentRange = Object.freeze({ min: -100, max: 100, neutral: 0 })
const PERCENT: AdjustmentRange = Object.freeze({ min: 0, max: 100, neutral: 0 })

export const ADJUSTMENT_RANGES: Readonly<Record<AdjustmentKey, AdjustmentRange>> = Object.freeze({
  brightness: SIGNED,
  contrast: SIGNED,
  saturation: SIGNED,
  temperature: SIGNED,
  tint: SIGNED,
  grayscale: PERCENT,
  sepia: PERCENT,
})

/** Every value at its neutral: the Adjustments a new Work starts with (AC-17). */
export const NEUTRAL_ADJUSTMENTS: Readonly<Adjustments> = Object.freeze({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  grayscale: 0,
  sepia: 0,
})
