import { describe, expect, it } from 'vitest'
import {
  fitCropInside,
  identityGeometry,
  isInsideTurned,
  setStraighten,
  turnedSize,
  type CropRect,
  type Geometry,
} from './index'
import type { Size } from '../view'
import { int, mulberry32, randomGeometry } from './test-helpers'

const original = { width: 4096, height: 3072 }

/** Where a point of the Crop's frame sits on the image before its Straighten angle. */
function toUnturned(p: { x: number; y: number }, g: Geometry, size: Size) {
  const { width, height } = turnedSize(g, size)
  const a = (-g.straighten / 10) * (Math.PI / 180)
  const dx = p.x - width / 2
  const dy = p.y - height / 2
  return {
    x: width / 2 + dx * Math.cos(a) - dy * Math.sin(a),
    y: height / 2 + dx * Math.sin(a) + dy * Math.cos(a),
  }
}

const centre = (c: CropRect) => ({ x: c.x + c.width / 2, y: c.y + c.height / 2 })
const long = (c: CropRect) => Math.max(c.width, c.height)
const short = (c: CropRect) => Math.min(c.width, c.height)

function expectValid(g: Geometry, size: Size) {
  const { x, y, width, height } = g.crop
  for (const v of [x, y, width, height]) expect(Number.isInteger(v)).toBe(true)
  expect(width).toBeGreaterThanOrEqual(1)
  expect(height).toBeGreaterThanOrEqual(1)
  expect(isInsideTurned(g.crop, g, size)).toBe(true)
}

/** The short side is within 0.5 px of the long side divided by the frame's proportion before. */
function expectSameProportion(after: CropRect, before: CropRect) {
  const ratio = short(before) / long(before)
  const exact = long(after) * ratio
  if (short(after) > 1) expect(Math.abs(short(after) - exact)).toBeLessThanOrEqual(0.5 + 1e-9)
}

describe('setStraighten (AC-05)', () => {
  it('stores the angle in tenths, clamped to −45°…+45°', () => {
    const g = identityGeometry(original)
    expect(setStraighten(g, 123, original).straighten).toBe(123)
    expect(setStraighten(g, 451, original).straighten).toBe(450)
    expect(setStraighten(g, -9999, original).straighten).toBe(-450)
  })

  it('gives back the same Geometry when the angle does not change', () => {
    const g = identityGeometry(original)
    expect(setStraighten(g, 0, original)).toBe(g)
  })

  it('turns the image around the frame’s centre: the centre stays on the same image content', () => {
    const g: Geometry = {
      ...identityGeometry(original),
      crop: { x: 1000, y: 900, width: 300, height: 200 },
    }
    const before = toUnturned(centre(g.crop), g, original)
    const turned = setStraighten(g, 75, original)
    const after = toUnturned(centre(turned.crop), turned, original)

    expect(turned.crop.width).toBe(300)
    expect(turned.crop.height).toBe(200)
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThanOrEqual(Math.SQRT1_2)
  })
})

describe('fitCropInside (AC-06)', () => {
  it.each([450, -450, 1, -1, 100])(
    'shrinks a full Crop at %i tenths to the largest same-proportion frame inside',
    (tenths) => {
      const g = { ...identityGeometry(original), straighten: tenths }
      const fitted = fitCropInside(g, original)

      expectValid(fitted, original)
      expectSameProportion(fitted.crop, g.crop)
      // Largest: one more pixel on the long side (short side half up) fits at neither whole-pixel
      // position next to the centre.
      const w = fitted.crop.width + 1
      const h = Math.floor((2 * w * 3072 + 4096) / (2 * 4096))
      const c = { x: 2048, y: 1536 }
      for (const x of [Math.floor(c.x - w / 2), Math.ceil(c.x - w / 2)])
        for (const y of [Math.floor(c.y - h / 2), Math.ceil(c.y - h / 2)])
          expect(isInsideTurned({ x, y, width: w, height: h }, fitted, original)).toBe(false)
      // The centre stayed in the middle.
      expect(Math.abs(centre(fitted.crop).x - 2048)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(centre(fitted.crop).y - 1536)).toBeLessThanOrEqual(0.5)
    },
  )

  it('never grows a frame that already fits', () => {
    const g = { ...identityGeometry(original), crop: { x: 2000, y: 1500, width: 10, height: 7 } }
    expect(fitCropInside({ ...g, straighten: 200 }, original).crop).toEqual(g.crop)
  })

  it('moves a centre that falls outside to the nearest point inside, then shrinks', () => {
    const g: Geometry = {
      ...identityGeometry(original),
      straighten: 450,
      crop: { x: 0, y: 0, width: 40, height: 30 },
    }
    const fitted = fitCropInside(g, original)
    expectValid(fitted, original)
    expectSameProportion(fitted.crop, g.crop)
  })

  it('keeps a 1×1 Crop 1×1 and a very thin frame at least 1 px wide', () => {
    const one = { ...identityGeometry(original), crop: { x: 2048, y: 1536, width: 1, height: 1 } }
    expect(setStraighten(one, 450, original).crop).toMatchObject({ width: 1, height: 1 })

    const thin = {
      ...identityGeometry(original),
      rotation: 90 as const,
      crop: { x: 1500, y: 40, width: 1, height: 4000 },
    }
    const fitted = setStraighten(thin, 450, original)
    expectValid(fitted, original)
  })

  it('does not grow back when the angle moves back towards 0°', () => {
    const g = identityGeometry(original)
    const at10 = setStraighten(g, 100, original)
    const at2 = setStraighten(at10, 20, original)
    const at0 = setStraighten(at2, 0, original)

    expect(at2.crop.width).toBeLessThanOrEqual(at10.crop.width)
    expect(at2.crop.height).toBeLessThanOrEqual(at10.crop.height)
    expect(at0.crop.width).toBeLessThanOrEqual(at10.crop.width)
  })
})

describe('AC-06 invariant (property)', () => {
  it('any angle on any Crop: inside, whole pixels, ≥1×1, same proportion, never larger', () => {
    const rand = mulberry32(17)
    for (let i = 0; i < 2000; i++) {
      const size = { width: int(rand, 8, 3000), height: int(rand, 8, 3000) }
      const g = randomGeometry(rand, size)
      const turned = setStraighten(g, int(rand, -450, 450), size)

      expectValid(turned, size)
      expectSameProportion(turned.crop, g.crop)
      expect(turned.crop.width).toBeLessThanOrEqual(g.crop.width)
      expect(turned.crop.height).toBeLessThanOrEqual(g.crop.height)

      // And again from a straightened start.
      const again = setStraighten(turned, int(rand, -450, 450), size)
      expectValid(again, size)
      expect(again.crop.width).toBeLessThanOrEqual(turned.crop.width)
    }
  })
})
