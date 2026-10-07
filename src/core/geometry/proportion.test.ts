import { describe, expect, it } from 'vitest'
import {
  applyProportion,
  identityGeometry,
  isInsideTurned,
  ratioOf,
  resizeCropLocked,
  setCropSize,
  setStraighten,
  turnProportion,
  type CropHandle,
  type Geometry,
  type Proportion,
  type ProportionKind,
} from './index'
import { int, mulberry32, randomGeometry } from './test-helpers'

const original = { width: 4096, height: 3072 }
const full = identityGeometry(original)
const p = (
  kind: ProportionKind,
  orientation: Proportion['orientation'] = 'landscape',
): Proportion => ({
  kind,
  orientation,
})
const KINDS: ProportionKind[] = ['original', '1:1', '4:3', '3:2', '16:9']
const centre = (g: Geometry) => ({
  x: g.crop.x + g.crop.width / 2,
  y: g.crop.y + g.crop.height / 2,
})

/** AC-08: the short side is within 0.5 px of the long side divided by the proportion. */
function expectKept(g: Geometry, prop: Proportion, size = original) {
  const r = ratioOf(prop, g, size)!
  const exactHeight = (g.crop.width * r.height) / r.width
  const exactWidth = (g.crop.height * r.width) / r.height
  const ok =
    Math.abs(g.crop.height - exactHeight) <= 0.5 || Math.abs(g.crop.width - exactWidth) <= 0.5
  expect(ok).toBe(true)
}

describe('ratioOf', () => {
  it('is null for Free and the named ratio, turned for portrait', () => {
    expect(ratioOf(p('free'), full, original)).toBeNull()
    expect(ratioOf(p('16:9'), full, original)).toEqual({ width: 16, height: 9 })
    expect(ratioOf(p('16:9', 'portrait'), full, original)).toEqual({ width: 9, height: 16 })
    expect(ratioOf(p('1:1', 'portrait'), full, original)).toEqual({ width: 1, height: 1 })
  })

  it('makes Original the image’s proportions after its current Rotation', () => {
    expect(ratioOf(p('original'), full, original)).toEqual({ width: 4096, height: 3072 })
    const turned = { ...full, rotation: 90 as const }
    expect(ratioOf(p('original'), turned, original)).toEqual({ width: 3072, height: 4096 })
    expect(ratioOf(p('original', 'portrait'), full, original)).toEqual({
      width: 3072,
      height: 4096,
    })
  })
})

describe('turnProportion (AC-03)', () => {
  it('turns a locked proportion with a quarter turn: 4:3 becomes 3:4', () => {
    expect(turnProportion(p('4:3'))).toEqual(p('4:3', 'portrait'))
    expect(turnProportion(p('4:3', 'portrait'))).toEqual(p('4:3'))
  })

  it('leaves Free, 1:1 and Original alone: Original already follows the Rotation', () => {
    for (const kind of ['free', '1:1', 'original'] as const) {
      expect(turnProportion(p(kind))).toEqual(p(kind))
    }
  })
})

describe('applyProportion (AC-08)', () => {
  it('Free leaves the frame as it is', () => {
    expect(applyProportion(full, p('free'), original)).toBe(full)
  })

  it('16:9 portrait on a full 4096×3072 Crop is 1728×3072, centred', () => {
    expect(applyProportion(full, p('16:9', 'portrait'), original).crop).toEqual({
      x: 1184,
      y: 0,
      width: 1728,
      height: 3072,
    })
  })

  it('rounds the short side half up from the long side', () => {
    // 1001 wide at 16:9 → 563.0625 → 563; 1000 wide at 3:2 → 666.67 → 667.
    const g = { ...full, crop: { x: 0, y: 0, width: 1001, height: 1000 } }
    expect(applyProportion(g, p('16:9'), original).crop).toMatchObject({ width: 1001, height: 563 })
    const h = { ...full, crop: { x: 0, y: 0, width: 1000, height: 1000 } }
    expect(applyProportion(h, p('3:2'), original).crop).toMatchObject({ width: 1000, height: 667 })
  })

  it.each(KINDS.flatMap((k) => [p(k), p(k, 'portrait')]))(
    'makes the largest $kind $orientation frame inside the current frame, centred on it',
    (prop) => {
      const rand = mulberry32(23)
      for (let i = 0; i < 200; i++) {
        const g = randomGeometry(rand, original)
        const next = applyProportion(g, prop, original)
        expectKept(next, prop)
        // Inside the old frame, centred on it (within half a pixel) …
        expect(next.crop.x).toBeGreaterThanOrEqual(g.crop.x)
        expect(next.crop.y).toBeGreaterThanOrEqual(g.crop.y)
        expect(next.crop.x + next.crop.width).toBeLessThanOrEqual(g.crop.x + g.crop.width)
        expect(next.crop.y + next.crop.height).toBeLessThanOrEqual(g.crop.y + g.crop.height)
        expect(Math.abs(centre(next).x - centre(g).x)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(centre(next).y - centre(g).y)).toBeLessThanOrEqual(0.5)
        // … and as large as fits: it already touches the old frame on one axis, or one more pixel
        // on the long side would not.
        const touches = next.crop.width >= g.crop.width - 1 || next.crop.height >= g.crop.height - 1
        expect(touches).toBe(true)
      }
    },
  )
})

describe('resizeCropLocked (AC-08: the proportion holds while resizing)', () => {
  const HANDLES: CropHandle[] = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw']

  it('Free resizes like resizeCrop', () => {
    const g = { ...full, crop: { x: 100, y: 100, width: 400, height: 300 } }
    expect(resizeCropLocked(g, 'e', 50, 0, p('free'), original).crop).toEqual({
      x: 100,
      y: 100,
      width: 450,
      height: 300,
    })
  })

  it('an edge drag makes the other side follow, centred on the other axis', () => {
    const g = { ...full, crop: { x: 100, y: 100, width: 400, height: 300 } }
    expect(resizeCropLocked(g, 'e', 40, 0, p('4:3'), original).crop).toEqual({
      x: 100,
      y: 85,
      width: 440,
      height: 330,
    })
  })

  it('a corner drag keeps the opposite corner where it is', () => {
    const g = { ...full, crop: { x: 100, y: 100, width: 400, height: 300 } }
    expect(resizeCropLocked(g, 'nw', -40, -10, p('4:3'), original).crop).toEqual({
      x: 60,
      y: 70,
      width: 440,
      height: 330,
    })
  })

  it('keeps the proportion, whole pixels and the Crop inside for any drag (property)', () => {
    const rand = mulberry32(29)
    for (let i = 0; i < 1500; i++) {
      const prop = p(KINDS[int(rand, 0, 4)]!, rand() < 0.5 ? 'landscape' : 'portrait')
      let g = applyProportion(randomGeometry(rand, original), prop, original)
      if (rand() < 0.3) g = setStraighten(g, int(rand, -450, 450), original)
      const next = resizeCropLocked(
        g,
        HANDLES[int(rand, 0, 7)]!,
        (rand() - 0.5) * 6000,
        (rand() - 0.5) * 6000,
        prop,
        original,
      )
      expect(isInsideTurned(next.crop, next, original)).toBe(true)
      expect(next.crop.width).toBeGreaterThanOrEqual(1)
      expect(next.crop.height).toBeGreaterThanOrEqual(1)
      for (const v of Object.values(next.crop)) expect(Number.isInteger(v)).toBe(true)
      if (Math.min(next.crop.width, next.crop.height) > 1) expectKept(next, prop)
    }
  })
})

describe('setCropSize (AC-09, AC-10)', () => {
  const g = { ...full, crop: { x: 1000, y: 1000, width: 400, height: 300 } }

  it('Free: the typed side changes around the centre, the other side stays', () => {
    expect(setCropSize(g, 'width', 500, p('free'), original).crop).toEqual({
      x: 950,
      y: 1000,
      width: 500,
      height: 300,
    })
    // 301 around the centre 1150 puts the top at 999.5, which rounds down (AC-02).
    expect(setCropSize(g, 'height', 301, p('free'), original).crop).toEqual({
      x: 1000,
      y: 999,
      width: 400,
      height: 301,
    })
  })

  it('locked: the typed side is the input, long or short, the other follows half up', () => {
    // 16:9, typed height 9 → width 16; typed width 100 → height 56.25 → 56.
    expect(setCropSize(g, 'height', 9, p('16:9'), original).crop).toMatchObject({
      width: 16,
      height: 9,
    })
    expect(setCropSize(g, 'width', 100, p('16:9'), original).crop).toMatchObject({
      width: 100,
      height: 56,
    })
    // 3:2 typed height 101 → width 151.5 → 152 (half up).
    expect(setCropSize(g, 'height', 101, p('3:2'), original).crop).toMatchObject({
      width: 152,
      height: 101,
    })
  })

  it('moves the frame only as far as needed to stay inside', () => {
    const corner = { ...full, crop: { x: 3996, y: 0, width: 100, height: 100 } }
    expect(setCropSize(corner, 'width', 300, p('free'), original).crop).toEqual({
      x: 3796,
      y: 0,
      width: 300,
      height: 100,
    })
  })

  it('makes a value larger than fits the largest size that fits', () => {
    expect(setCropSize(g, 'width', 1e21, p('free'), original).crop).toEqual({
      x: 0,
      y: 1000,
      width: 4096,
      height: 300,
    })
    expect(setCropSize(g, 'width', 99999, p('4:3'), original).crop).toEqual({
      x: 0,
      y: 0,
      width: 4096,
      height: 3072,
    })
  })

  it('with a Straighten angle, the largest that fits is inside the turned image', () => {
    const straight = setStraighten(full, 100, original)
    const next = setCropSize(straight, 'width', 99999, p('4:3'), original)
    expect(isInsideTurned(next.crop, next, original)).toBe(true)
    expectKept(next, p('4:3'))
    expect(next.crop.width).toBeGreaterThanOrEqual(straight.crop.width - 1)
  })
})
