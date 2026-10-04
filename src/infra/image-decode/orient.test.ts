import { describe, expect, it } from 'vitest'
import { orientationTransform } from './orient'

/** Where stored pixel (x, y) lands under the canvas transform [a, b, c, d, e, f]. */
function apply([a, b, c, d, e, f]: readonly number[], x: number, y: number) {
  return { x: a! * x + c! * y + e!, y: b! * x + d! * y + f! }
}

// A 40×30 stored image; where its stored top-left and top-right corners must land when upright.
const W = 40
const H = 30
const cases: [number, { width: number; height: number }, [number, number], [number, number]][] = [
  [1, { width: 40, height: 30 }, [0, 0], [40, 0]],
  [2, { width: 40, height: 30 }, [40, 0], [0, 0]], // mirrored horizontally
  [3, { width: 40, height: 30 }, [40, 30], [0, 30]], // rotated 180°
  [4, { width: 40, height: 30 }, [0, 30], [40, 30]], // mirrored vertically
  [5, { width: 30, height: 40 }, [0, 0], [0, 40]], // transposed
  [6, { width: 30, height: 40 }, [30, 0], [30, 40]], // rotated 90° clockwise
  [7, { width: 30, height: 40 }, [30, 40], [30, 0]], // transversed
  [8, { width: 30, height: 40 }, [0, 40], [0, 0]], // rotated 90° counter-clockwise
]

describe('orientationTransform (EXIF 1–8)', () => {
  it.each(cases)('orientation %i', (orientation, size, topLeft, topRight) => {
    const t = orientationTransform(orientation as 1, W, H)
    expect({ width: t.width, height: t.height }).toEqual(size)
    expect(apply(t.matrix, 0, 0)).toEqual({ x: topLeft[0], y: topLeft[1] })
    expect(apply(t.matrix, W, 0)).toEqual({ x: topRight[0], y: topRight[1] })
  })

  it('keeps every corner inside the upright canvas', () => {
    for (let o = 1; o <= 8; o++) {
      const t = orientationTransform(o as 1, W, H)
      for (const [x, y] of [
        [0, 0],
        [W, 0],
        [0, H],
        [W, H],
      ] as const) {
        const p = apply(t.matrix, x, y)
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.x).toBeLessThanOrEqual(t.width)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeLessThanOrEqual(t.height)
      }
    }
  })
})
