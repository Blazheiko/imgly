import { describe, expect, it } from 'vitest'
import { ADJUSTMENT_KEYS, parseAdjustmentField, type AdjustmentKey } from './index'

const SIGNED: AdjustmentKey[] = ['brightness', 'contrast', 'saturation', 'temperature', 'tint']
const PERCENT: AdjustmentKey[] = ['grayscale', 'sepia']
const PREVIOUS = 37

describe('parseAdjustmentField (AC-05)', () => {
  describe.each(ADJUSTMENT_KEYS)('in the %s field', (key) => {
    it.each([
      ['2.5', 3],
      ['1,5', 2],
      ['00000000000000000000012', 12],
      ['12.0000000000000000000001', 12],
      ['-0.4', 0],
      ['0', 0],
      ['  42  ', 42],
      ['+7', 7],
    ])('reads %j as %d', (text, expected) => {
      expect(parseAdjustmentField(text, key, PREVIOUS)).toBe(expected)
    })

    it.each(['', '   ', '-', '.', '1e2', 'abc', '0x10', '1.2.3', '1,2,3', 'Infinity', '50%%'])(
      'returns the previous value for %j',
      (text) => {
        expect(parseAdjustmentField(text, key, PREVIOUS)).toBe(PREVIOUS)
      },
    )

    it('never returns -0', () => {
      expect(Object.is(parseAdjustmentField('-0.4', key, PREVIOUS), 0)).toBe(true)
      expect(Object.is(parseAdjustmentField('-0', key, PREVIOUS), 0)).toBe(true)
    })
  })

  describe.each(SIGNED)('in the signed %s field', (key) => {
    it.each([
      ['-2.5', -2],
      ['-2.6', -3],
      ['150', 100],
      ['-150', -100],
      ['99.5', 100],
      ['-100.4', -100],
    ])('reads %j as %d', (text, expected) => {
      expect(parseAdjustmentField(text, key, PREVIOUS)).toBe(expected)
    })

    it('does not accept a trailing "%"', () => {
      expect(parseAdjustmentField('60%', key, PREVIOUS)).toBe(PREVIOUS)
    })
  })

  describe.each(PERCENT)('in the percent %s field', (key) => {
    it.each([
      ['60%', 60],
      ['60 %', 60],
      ['12.5%', 13],
      ['-7', 0],
      ['-2.5', 0],
      ['150%', 100],
      ['100', 100],
    ])('reads %j as %d', (text, expected) => {
      expect(parseAdjustmentField(text, key, PREVIOUS)).toBe(expected)
    })

    it('does not accept a leading "%" or a "%" alone', () => {
      expect(parseAdjustmentField('%60', key, PREVIOUS)).toBe(PREVIOUS)
      expect(parseAdjustmentField('%', key, PREVIOUS)).toBe(PREVIOUS)
    })
  })
})
