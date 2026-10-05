import { describe, expect, it } from 'vitest'
import { DEFAULT_QUALITY, normalizeQuality } from './index'

describe('quality (AC-04)', () => {
  it('defaults to 90', () => {
    expect(DEFAULT_QUALITY).toBe(90)
  })

  it.each([
    ['0', 1],
    ['-5', 1],
    ['150', 100],
    ['42.5', 43],
    ['42.4', 42],
    ['1', 1],
    ['100', 100],
    [' 75 ', 75],
  ])('%j → %d', (raw, expected) => {
    expect(normalizeQuality(raw, 60)).toBe(expected)
  })

  it.each(['', '  ', 'abc', 'NaN'])('%j returns to the previous value', (raw) => {
    expect(normalizeQuality(raw, 60)).toBe(60)
  })
})
