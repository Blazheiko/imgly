import { describe, expect, it } from 'vitest'
import {
  catmullRomSegment,
  catmullRomSegments,
  DEFAULT_COLOUR,
  DEFAULT_WIDTH,
  dotSegment,
  footprintReachesCrop,
  MAX_WIDTH,
  MIN_WIDTH,
  PALETTE,
  parseWidth,
  segmentBounds,
  stepWidth,
  type Segment,
} from '@/core'

describe('draw settings (AC-01, AC-02)', () => {
  it('has the 10 preset colours in AC-02 order', () => {
    expect(PALETTE.map((c) => c.hex)).toEqual([
      '#000000',
      '#FFFFFF',
      '#E53935',
      '#FB8C00',
      '#FDD835',
      '#43A047',
      '#00ACC1',
      '#1E88E5',
      '#8E24AA',
      '#D81B60',
    ])
    expect(PALETTE.map((c) => c.name)).toEqual([
      'Black',
      'White',
      'Red',
      'Orange',
      'Yellow',
      'Green',
      'Cyan',
      'Blue',
      'Purple',
      'Pink',
    ])
  })

  it('defaults to red #E53935 at 12 px, widths 1…200', () => {
    expect(DEFAULT_COLOUR).toBe('#E53935')
    expect(DEFAULT_WIDTH).toBe(12)
    expect(MIN_WIDTH).toBe(1)
    expect(MAX_WIDTH).toBe(200)
  })
})

describe('parseWidth (AC-03)', () => {
  it.each([
    ['12', 12],
    ['2.5', 3],
    ['2,5', 3],
    ['2.4', 2],
    ['2.49999999999999999999', 2],
    ['0', 1],
    ['-4', 1],
    ['+7', 7],
    ['20px', 20],
    ['20 px', 20],
    ['20PX', 20],
    ['20,4', 20],
    ['  33  ', 33],
    ['201', 200],
    ['999999999999999999999', 200],
    ['.6', 1],
  ])('%j → %i', (text, expected) => {
    expect(parseWidth(text, 50)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '1e2', 'px', '12px px', '0x10', '1.2.3'])(
    '%j returns the previous width',
    (text) => {
      expect(parseWidth(text, 50)).toBe(50)
    },
  )
})

describe('stepWidth (AC-19)', () => {
  it.each([
    [12, 1, 13],
    [12, -1, 11],
    [195, 10, 200],
    [3, -10, 1],
    [1, -1, 1],
    [200, 1, 200],
  ])('stepWidth(%i, %i) = %i', (width, delta, expected) => {
    expect(stepWidth(width, delta)).toBe(expected)
  })
})

describe('catmullRomSegments (ADR-0002 curve)', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 10 },
    { x: 20, y: 30 },
  ]

  it('joins n points with n − 1 segments that start and end exactly at the points', () => {
    const segments = catmullRomSegments(points)
    expect(segments).toHaveLength(3)
    segments.forEach((s, i) => {
      expect(s.p0).toEqual(points[i])
      expect(s.p1).toEqual(points[i + 1])
    })
  })

  it('gives a smooth joint: the tangents either side of an inner point are collinear', () => {
    const [a, b] = catmullRomSegments(points)
    const inX = a!.p1.x - a!.c2.x
    const inY = a!.p1.y - a!.c2.y
    const outX = b!.c1.x - b!.p0.x
    const outY = b!.c1.y - b!.p0.y
    expect(inX * outY - inY * outX).toBeCloseTo(0, 9)
    expect(inX * outX + inY * outY).toBeGreaterThan(0)
  })

  it('gives a straight line for collinear points', () => {
    const s = catmullRomSegment({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 })
    expect(s.c1.y).toBe(0)
    expect(s.c2.y).toBe(0)
    expect(s.c1.x).toBeGreaterThan(1)
    expect(s.c2.x).toBeLessThan(2)
  })

  it('has no NaN for two identical consecutive points or at the ends', () => {
    const segments = catmullRomSegments([
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 9, y: 1 },
    ])
    for (const s of segments) {
      for (const p of [s.p0, s.c1, s.c2, s.p1]) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
      }
    }
  })

  it('gives no segment for fewer than two points', () => {
    expect(catmullRomSegments([])).toEqual([])
    expect(catmullRomSegments([{ x: 1, y: 1 }])).toEqual([])
  })
})

describe('segmentBounds (ADR-0002 dirty rectangle)', () => {
  it('is the control points’ bounds plus half the width plus 2 px', () => {
    const s: Segment = {
      p0: { x: 10, y: 20 },
      c1: { x: 5, y: 30 },
      c2: { x: 40, y: 25 },
      p1: { x: 30, y: 22 },
    }
    expect(segmentBounds(s, 12)).toEqual({ x: 5 - 8, y: 20 - 8, width: 35 + 16, height: 10 + 16 })
  })

  it('covers a dot of the width', () => {
    expect(segmentBounds(dotSegment({ x: 50, y: 50 }), 200)).toEqual({
      x: -52,
      y: -52,
      width: 204,
      height: 204,
    })
  })
})

describe('footprintReachesCrop (AC-09, AC-12)', () => {
  const crop = { x: 100, y: 100, width: 200, height: 100 }
  const line = (ax: number, ay: number, bx: number, by: number) =>
    catmullRomSegments([
      { x: ax, y: ay },
      { x: bx, y: by },
    ])

  it('is true for a path inside the Crop', () => {
    expect(footprintReachesCrop(line(150, 150, 250, 150), 1, crop)).toBe(true)
  })

  it('is true for a path crossing the Crop with both ends outside', () => {
    expect(footprintReachesCrop(line(0, 150, 400, 150), 1, crop)).toBe(true)
  })

  it('is true for a path outside the Crop but within half the width of an edge (the band)', () => {
    expect(footprintReachesCrop(line(150, 95, 250, 95), 12, crop)).toBe(true)
  })

  it('is false for a path farther than half the width outside', () => {
    expect(footprintReachesCrop(line(150, 93, 250, 93), 12, crop)).toBe(false)
    expect(footprintReachesCrop(line(0, 0, 50, 50), 12, crop)).toBe(false)
  })

  it('measures from a corner with the round end', () => {
    // 4 px right and 4 px up from the top-right corner: distance ≈ 5.66
    expect(footprintReachesCrop([dotSegment({ x: 304, y: 96 })], 12, crop)).toBe(true)
    expect(footprintReachesCrop([dotSegment({ x: 304, y: 96 })], 10, crop)).toBe(false)
  })

  it('follows the curve, not the straight chord', () => {
    // A curve bowing up into the Crop although its chord runs below it.
    const segments = catmullRomSegments([
      { x: 150, y: 260 },
      { x: 180, y: 230 },
      { x: 200, y: 190 },
      { x: 220, y: 230 },
      { x: 250, y: 260 },
    ])
    expect(footprintReachesCrop(segments, 1, crop)).toBe(true)
    expect(footprintReachesCrop(line(150, 260, 250, 260), 1, crop)).toBe(false)
  })

  it('is false for no segments', () => {
    expect(footprintReachesCrop([], 200, crop)).toBe(false)
  })
})
