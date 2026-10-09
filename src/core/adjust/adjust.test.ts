import { describe, expect, it } from 'vitest'
import {
  ADJUSTMENT_KEYS,
  ADJUSTMENT_RANGES,
  NEUTRAL_ADJUSTMENTS,
  adjustmentsEquals,
  isNeutral,
  type Adjustments,
} from './index'

describe('Adjustments model (ADR-0001)', () => {
  it('lists the seven keys in the fixed order of ADR-0003', () => {
    expect(ADJUSTMENT_KEYS).toEqual([
      'brightness',
      'contrast',
      'saturation',
      'temperature',
      'tint',
      'grayscale',
      'sepia',
    ])
  })

  it('ranges −100…100 for the first five and 0…100 for grayscale and sepia, all neutral at 0', () => {
    for (const key of ['brightness', 'contrast', 'saturation', 'temperature', 'tint'] as const) {
      expect(ADJUSTMENT_RANGES[key]).toEqual({ min: -100, max: 100, neutral: 0 })
    }
    for (const key of ['grayscale', 'sepia'] as const) {
      expect(ADJUSTMENT_RANGES[key]).toEqual({ min: 0, max: 100, neutral: 0 })
    }
  })

  it('has a frozen neutral value with every key at its neutral', () => {
    for (const key of ADJUSTMENT_KEYS) {
      expect(NEUTRAL_ADJUSTMENTS[key]).toBe(ADJUSTMENT_RANGES[key].neutral)
    }
    expect(Object.keys(NEUTRAL_ADJUSTMENTS).sort()).toEqual([...ADJUSTMENT_KEYS].sort())
    expect(Object.isFrozen(NEUTRAL_ADJUSTMENTS)).toBe(true)
  })
})

describe('isNeutral', () => {
  it('is true for the neutral value and for an equal copy', () => {
    expect(isNeutral(NEUTRAL_ADJUSTMENTS)).toBe(true)
    expect(isNeutral({ ...NEUTRAL_ADJUSTMENTS })).toBe(true)
  })

  it.each(ADJUSTMENT_KEYS)('is false when only %s is off neutral by 1', (key) => {
    expect(isNeutral({ ...NEUTRAL_ADJUSTMENTS, [key]: 1 })).toBe(false)
  })
})

describe('adjustmentsEquals (AC-11: field by field, not by pixels)', () => {
  const a: Adjustments = {
    brightness: 10,
    contrast: -20,
    saturation: 30,
    temperature: -40,
    tint: 50,
    grayscale: 60,
    sepia: 70,
  }

  it('is true for the same seven numbers in different objects', () => {
    expect(adjustmentsEquals(a, { ...a })).toBe(true)
  })

  it('is true after values are changed and changed back', () => {
    const changed = { ...a, contrast: 5 }
    expect(adjustmentsEquals(a, { ...changed, contrast: -20 })).toBe(true)
  })

  it.each(ADJUSTMENT_KEYS)('is false when only %s differs by 1', (key) => {
    expect(adjustmentsEquals(a, { ...a, [key]: a[key] + 1 })).toBe(false)
  })

  it('is false for two settings that render the same pixels but differ in value', () => {
    // Two settings that both render a grey image are still different Adjustments.
    const grey1 = { ...NEUTRAL_ADJUSTMENTS, grayscale: 100 }
    const grey2 = { ...NEUTRAL_ADJUSTMENTS, saturation: -100 }
    expect(adjustmentsEquals(grey1, grey2)).toBe(false)
  })
})
