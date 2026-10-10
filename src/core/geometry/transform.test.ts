import { describe, expect, it } from 'vitest'
import {
  cropRectOnScreen,
  cropToOriginalUv,
  fitCropInside,
  frameToOriginal,
  identityGeometry,
  screenDeltaToImage,
  screenToImage,
  turnedBounds,
  turnedImageToOriginalUv,
  type CropRect,
  type Geometry,
  type Mat3,
  type Rotation,
} from './index'
import { ROTATIONS } from './test-helpers'

/** Applies a column-major mat3 to (x, y, 1). */
const apply = (m: Mat3, x: number, y: number) => ({
  x: m[0] * x + m[3] * y + m[6],
  y: m[1] * x + m[4] * y + m[7],
})

/** Reference: flips and rotations done on a pixel grid, independent of the implementation. */
function turnGrid(grid: number[][], g: Pick<Geometry, 'flipH' | 'flipV' | 'rotation'>) {
  let out = grid.map((row) => (g.flipH ? [...row].reverse() : [...row]))
  if (g.flipV) out = out.reverse()
  for (let r = 0; r < g.rotation / 90; r++) {
    const h = out.length
    const w = out[0]!.length
    out = Array.from({ length: w }, (_, y) =>
      Array.from({ length: h }, (_, x) => out[h - 1 - x]![y]!),
    )
  }
  return out
}

const W = 5
const H = 3
const original = { width: W, height: H }
const ids = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => y * W + x))

describe('cropToOriginalUv', () => {
  it('is the identity for the identity Geometry', () => {
    expect(cropToOriginalUv(identityGeometry(original), original)).toEqual([
      1, 0, 0, 0, 1, 0, 0, 0, 1,
    ])
  })

  const combos = ROTATIONS.flatMap((rotation: Rotation) =>
    [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ].map(([flipH, flipV]) => ({ rotation, flipH: flipH!, flipV: flipV! })),
  )

  it.each(combos)(
    'maps every output pixel centre to its source texel centre: rotation $rotation, flipH $flipH, flipV $flipV',
    (combo) => {
      const turned = turnGrid(ids, combo)
      const tw = turned[0]!.length
      const th = turned.length
      const crops: CropRect[] = [
        { x: 0, y: 0, width: tw, height: th },
        { x: 1, y: 1, width: tw - 2, height: th - 1 },
        { x: tw - 1, y: 0, width: 1, height: th }, // a 1-pixel-wide Crop at the right edge
      ]
      for (const crop of crops) {
        const m = cropToOriginalUv({ ...combo, straighten: 0, crop }, original)
        for (let j = 0; j < crop.height; j++) {
          for (let i = 0; i < crop.width; i++) {
            const uv = apply(m, (i + 0.5) / crop.width, (j + 0.5) / crop.height)
            const source = turned[crop.y + j]![crop.x + i]!
            const sx = source % W
            const sy = Math.floor(source / W)
            expect(uv.x * W).toBeCloseTo(sx + 0.5, 9)
            expect(uv.y * H).toBeCloseTo(sy + 0.5, 9)
          }
        }
      }
    },
  )

  it.each([-450, -1, 10, 450])(
    'maps every Crop pixel centre inside the Original at %i tenths (QG-1c)',
    (straighten) => {
      const size = { width: 64, height: 48 }
      for (const rotation of ROTATIONS) {
        const g = fitCropInside(
          {
            ...identityGeometry(size),
            rotation,
            straighten,
            crop:
              rotation % 180 ? { x: 0, y: 0, width: 48, height: 64 } : identityGeometry(size).crop,
          },
          size,
        )
        const m = cropToOriginalUv(g, size)
        for (let j = 0; j < g.crop.height; j++) {
          for (let i = 0; i < g.crop.width; i++) {
            const uv = apply(m, (i + 0.5) / g.crop.width, (j + 0.5) / g.crop.height)
            expect(uv.x).toBeGreaterThan(0)
            expect(uv.x).toBeLessThan(1)
            expect(uv.y).toBeGreaterThan(0)
            expect(uv.y).toBeLessThan(1)
          }
        }
      }
    },
  )

  it('turns a positive Straighten angle clockwise on screen', () => {
    // A 100×100 image straightened +90° would put the Original's top-left at the top-right;
    // at +45° the Original's top-left corner is straight above the centre.
    const size = { width: 100, height: 100 }
    const g = { ...identityGeometry(size), straighten: 450 }
    const corner = turnedImageToOriginalUv(g, size)
    const b = turnedBounds(g, size)
    // The point straight above the centre on the bounding box's top edge is the Original's (0, 0).
    const uv = apply(corner, (50 - b.x) / b.width, 0)
    expect(uv.x).toBeCloseTo(0, 9)
    expect(uv.y).toBeCloseTo(0, 9)
  })
})

describe('turnedBounds and turnedImageToOriginalUv', () => {
  it('without a Straighten angle, is the turned image at the origin', () => {
    expect(turnedBounds({ ...identityGeometry(original), rotation: 90 }, original)).toEqual({
      x: 0,
      y: 0,
      width: 3,
      height: 5,
    })
    const g = { ...identityGeometry(original), rotation: 270 as const, flipH: true }
    expect(turnedImageToOriginalUv(g, original)).toEqual(
      cropToOriginalUv({ ...g, crop: { x: 0, y: 0, width: 3, height: 5 } }, original),
    )
  })

  it('with a Straighten angle, encloses the whole turned image around its centre', () => {
    const size = { width: 400, height: 200 }
    const b = turnedBounds({ ...identityGeometry(size), straighten: 450 }, size)
    const e = Math.SQRT1_2 * 300
    expect(b.x).toBeCloseTo(200 - e, 9)
    expect(b.y).toBeCloseTo(100 - e, 9)
    expect(b.width).toBeCloseTo(2 * e, 9)
    expect(b.height).toBeCloseTo(2 * e, 9)
  })

  it('maps the Crop the same way the whole-image mapping does', () => {
    const size = { width: 400, height: 200 }
    const g = fitCropInside(
      {
        ...identityGeometry(size),
        rotation: 90,
        flipV: true,
        straighten: 123,
        crop: { x: 0, y: 0, width: 200, height: 400 },
      },
      size,
    )
    const whole = turnedImageToOriginalUv(g, size)
    const crop = cropToOriginalUv(g, size)
    const b = turnedBounds(g, size)
    for (const [s, t] of [
      [0, 0],
      [1, 0],
      [0.3, 0.7],
      [1, 1],
    ] as const) {
      const viaCrop = apply(crop, s, t)
      const px = g.crop.x + s * g.crop.width
      const py = g.crop.y + t * g.crop.height
      const viaWhole = apply(whole, (px - b.x) / b.width, (py - b.y) / b.height)
      expect(viaCrop.x).toBeCloseTo(viaWhole.x, 9)
      expect(viaCrop.y).toBeCloseTo(viaWhole.y, 9)
    }
  })
})

describe('overlay maths', () => {
  const view = { zoom: 8, panX: 10.4, panY: -3.6 }
  const shown = { x: -12.5, y: -7.25, width: 300, height: 200 }

  it('places the Crop on screen with the renderer’s View (pan snapped to device pixels)', () => {
    const crop = { x: 0, y: 0, width: 10, height: 5 }
    expect(cropRectOnScreen(crop, shown, view)).toEqual({
      left: 10 + 12.5 * 8,
      top: -4 + 7.25 * 8,
      width: 80,
      height: 40,
    })
  })

  it('lands on device-pixel boundaries at 800% for a whole-pixel shown image', () => {
    const r = cropRectOnScreen(
      { x: 3, y: 4, width: 2, height: 1 },
      { x: 0, y: 0, width: 50, height: 50 },
      view,
    )
    for (const v of Object.values(r)) expect(Number.isInteger(v)).toBe(true)
  })

  it('turns a screen point and a screen delta back into image pixels (round trip)', () => {
    const crop = { x: 17, y: 9, width: 30, height: 20 }
    const r = cropRectOnScreen(crop, shown, view)
    expect(screenToImage({ x: r.left, y: r.top }, shown, view)).toEqual({ x: 17, y: 9 })
    expect(screenDeltaToImage(80, -16, view)).toEqual({ dx: 10, dy: -2 })
  })
})

describe('frameToOriginal (draw ADR-0002)', () => {
  /** Applies a Canvas 2×3 [a, b, c, d, e, f] to (x, y). */
  const applyCanvas = (m: readonly number[], x: number, y: number) => ({
    x: m[0]! * x + m[2]! * y + m[4]!,
    y: m[1]! * x + m[3]! * y + m[5]!,
  })
  const original = { width: 40, height: 30 }

  it('is exactly the identity for the identity Geometry', () => {
    expect(frameToOriginal(identityGeometry(original), original)).toEqual([1, 0, 0, 1, 0, 0])
  })

  it('agrees with cropToOriginalUv × (W₀, H₀) for every Rotation, Flip, a Straighten angle and a Crop', () => {
    const cases: Geometry[] = []
    for (const rotation of ROTATIONS) {
      for (const flipH of [false, true]) {
        for (const flipV of [false, true]) {
          for (const straighten of [0, 123, -450]) {
            cases.push({
              flipH,
              flipV,
              rotation,
              straighten,
              crop: { x: 3, y: 4, width: 10, height: 8 },
            })
          }
        }
      }
    }
    for (const g of cases) {
      const m = frameToOriginal(g, original)
      const uv = cropToOriginalUv(g, original)
      for (const [u, v] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [0.25, 0.75],
      ] as const) {
        const frame = { x: g.crop.x + u * g.crop.width, y: g.crop.y + v * g.crop.height }
        const got = applyCanvas(m, frame.x, frame.y)
        const want = apply(uv, u, v)
        expect(got.x).toBeCloseTo(want.x * original.width, 9)
        expect(got.y).toBeCloseTo(want.y * original.height, 9)
      }
    }
  })

  it('keeps lengths: |det| = 1 and orthonormal columns, with a Straighten angle too', () => {
    for (const rotation of ROTATIONS) {
      for (const straighten of [0, 37, -300]) {
        const g = { ...identityGeometry(original), rotation, straighten, flipH: true }
        const [a, b, c, d] = frameToOriginal(g, original)
        expect(Math.abs(a * d - b * c)).toBeCloseTo(1, 12)
        expect(Math.hypot(a, b)).toBeCloseTo(1, 12)
        expect(a * c + b * d).toBeCloseTo(0, 12)
      }
    }
  })

  it('gives exact integers for quarter turns and Flips, so round trips are exact', () => {
    for (const rotation of ROTATIONS) {
      const m = frameToOriginal({ ...identityGeometry(original), rotation, flipV: true }, original)
      for (const value of m) expect(Number.isInteger(value)).toBe(true)
    }
  })
})
