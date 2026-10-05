import { describe, expect, it } from 'vitest'
import {
  exportSize,
  longSideFor,
  minLongSide,
  normalizeLongSide,
  SIZE_PRESETS,
  type SizeChoice,
} from './index'

const landscape = { width: 4096, height: 3072 }
const portrait = { width: 3072, height: 4096 }
const sliver = { width: 4096, height: 10 }
const preset = (percent: number): SizeChoice => ({ kind: 'preset', percent })
const longSide = (px: number): SizeChoice => ({ kind: 'longSide', px })

describe('SIZE_PRESETS (AC-05)', () => {
  it('offers 100, 75, 50 and 25 percent', () => {
    expect(SIZE_PRESETS).toEqual([100, 75, 50, 25])
  })
})

describe('longSideFor (AC-05)', () => {
  it('takes a preset percentage of the long side, half up', () => {
    expect(longSideFor(landscape, preset(100))).toBe(4096)
    expect(longSideFor(landscape, preset(50))).toBe(2048)
    expect(longSideFor(landscape, preset(25))).toBe(1024)
    // 4095 × 50% = 2047.5 → 2048
    expect(longSideFor({ width: 4095, height: 100 }, preset(50))).toBe(2048)
    // 4095 × 25% = 1023.75 → 1024; 4093 × 25% = 1023.25 → 1023
    expect(longSideFor({ width: 4095, height: 100 }, preset(25))).toBe(1024)
    expect(longSideFor({ width: 4093, height: 100 }, preset(25))).toBe(1023)
  })

  it('uses the height as the long side of a portrait Work', () => {
    expect(longSideFor(portrait, preset(75))).toBe(3072)
  })

  it('returns a typed long side as chosen', () => {
    expect(longSideFor(landscape, longSide(1000))).toBe(1000)
  })
})

describe('exportSize (AC-05, AC-06)', () => {
  it('keeps the proportions, rounding the short side half up', () => {
    expect(exportSize(landscape, preset(100))).toEqual({ width: 4096, height: 3072 })
    expect(exportSize(landscape, preset(50))).toEqual({ width: 2048, height: 1536 })
    // 2048 × 3073 / 4096 = 1536.5 → 1537
    expect(exportSize({ width: 4096, height: 3073 }, longSide(2048))).toEqual({
      width: 2048,
      height: 1537,
    })
  })

  it('derives the width of a portrait Work', () => {
    expect(exportSize(portrait, preset(50))).toEqual({ width: 1536, height: 2048 })
    expect(exportSize({ width: 3073, height: 4096 }, longSide(2048))).toEqual({
      width: 1537,
      height: 2048,
    })
  })

  it('snaps a size larger than the Work to full size', () => {
    expect(exportSize(landscape, longSide(5000))).toEqual(landscape)
  })

  it('snaps a size too small for a 1 px short side to the smallest valid long side', () => {
    expect(exportSize(sliver, longSide(100))).toEqual({ width: 205, height: 1 })
    expect(exportSize(sliver, preset(25))).toEqual({ width: 1024, height: 3 })
    expect(exportSize({ width: 10, height: 4096 }, longSide(1))).toEqual({ width: 1, height: 205 })
  })

  it('keeps the short side within 0.5 px of the exact value over a sweep of sizes', () => {
    const works = [
      { width: 4096, height: 3072 },
      { width: 4095, height: 2731 },
      { width: 3000, height: 1999 },
      { width: 4096, height: 10 },
      { width: 777, height: 333 },
      { width: 1, height: 1 },
      { width: 2, height: 1 },
    ]
    for (const work of works) {
      const W = Math.max(work.width, work.height)
      const H = Math.min(work.width, work.height)
      for (let L = 1; L <= W; L += Math.max(1, Math.floor(W / 97))) {
        const size = exportSize(work, longSide(L))
        const long = Math.max(size.width, size.height)
        const short = Math.min(size.width, size.height)
        expect(long).toBeLessThanOrEqual(W)
        expect(short).toBeGreaterThanOrEqual(1)
        expect(Math.abs(short - (long * H) / W)).toBeLessThanOrEqual(0.5)
      }
    }
  })
})

describe('minLongSide (AC-06)', () => {
  it('is the least long side whose short side rounds to 1 px', () => {
    expect(minLongSide(sliver)).toBe(205)
    expect(minLongSide(landscape)).toBe(1)
    expect(minLongSide({ width: 1, height: 1 })).toBe(1)
    expect(minLongSide({ width: 3, height: 1 })).toBe(2)
  })
})

describe('normalizeLongSide (AC-05, AC-06)', () => {
  it('rounds a fractional value', () => {
    expect(normalizeLongSide('1000.4', 2048, landscape)).toBe(1000)
    expect(normalizeLongSide('1000.5', 2048, landscape)).toBe(1001)
  })

  it('returns to the previous value when empty or non-numeric', () => {
    expect(normalizeLongSide('', 2048, landscape)).toBe(2048)
    expect(normalizeLongSide('  ', 2048, landscape)).toBe(2048)
    expect(normalizeLongSide('abc', 2048, landscape)).toBe(2048)
  })

  it('snaps above the Work to full size', () => {
    expect(normalizeLongSide('5000', 2048, landscape)).toBe(4096)
  })

  it('snaps zero, negative or too small to the smallest valid long side', () => {
    expect(normalizeLongSide('0', 2048, sliver)).toBe(205)
    expect(normalizeLongSide('-3', 2048, sliver)).toBe(205)
    expect(normalizeLongSide('100', 2048, sliver)).toBe(205)
    expect(normalizeLongSide('0', 2048, landscape)).toBe(1)
  })
})
