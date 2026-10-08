import { describe, expect, it } from 'vitest'
import {
  flipOnScreen,
  geometryEquals,
  identityGeometry,
  rotateQuarter,
  turnedSize,
  workSize,
  type Geometry,
} from './index'
import { createWork } from '../document'
import { mulberry32, randomGeometry, randomOriginal } from './test-helpers'

const original = { width: 4096, height: 3072 }

const geometry = (over: Partial<Geometry> = {}): Geometry => ({
  ...identityGeometry(original),
  ...over,
})

describe('identityGeometry', () => {
  it('has no Flip, no Rotation, no Straighten angle and a Crop covering the whole Original', () => {
    expect(identityGeometry(original)).toEqual({
      flipH: false,
      flipV: false,
      rotation: 0,
      straighten: 0,
      crop: { x: 0, y: 0, width: 4096, height: 3072 },
    })
  })
})

describe('createWork', () => {
  it('starts the Work with the identity Geometry', () => {
    const work = createWork({ ...original, pixels: null, hasTransparency: false }, 'w', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    expect(work.geometry).toEqual(identityGeometry(original))
  })
})

describe('workSize', () => {
  it("is the Crop's width and height", () => {
    const work = createWork({ ...original, pixels: null, hasTransparency: false }, 'w', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    const cropped = {
      ...work,
      geometry: geometry({ crop: { x: 10, y: 20, width: 300, height: 200 } }),
    }

    expect(workSize(work)).toEqual({ width: 4096, height: 3072 })
    expect(workSize(cropped)).toEqual({ width: 300, height: 200 })
  })
})

describe('turnedSize', () => {
  it("is the Original's size, swapped at 90° and 270°", () => {
    expect(turnedSize(geometry({ rotation: 0 }), original)).toEqual({ width: 4096, height: 3072 })
    expect(turnedSize(geometry({ rotation: 90 }), original)).toEqual({ width: 3072, height: 4096 })
    expect(turnedSize(geometry({ rotation: 180 }), original)).toEqual({ width: 4096, height: 3072 })
    expect(turnedSize(geometry({ rotation: 270 }), original)).toEqual({ width: 3072, height: 4096 })
  })
})

describe('geometryEquals (AC-13)', () => {
  it('is true for the same fields', () => {
    expect(geometryEquals(geometry(), geometry())).toBe(true)
  })

  it.each([
    ['flipH', { flipH: true }],
    ['flipV', { flipV: true }],
    ['rotation', { rotation: 90 as const }],
    ['straighten', { straighten: 1 }],
    ['crop.x', { crop: { x: 1, y: 0, width: 4096, height: 3072 } }],
    ['crop.y', { crop: { x: 0, y: 1, width: 4096, height: 3072 } }],
    ['crop.width', { crop: { x: 0, y: 0, width: 4095, height: 3072 } }],
    ['crop.height', { crop: { x: 0, y: 0, width: 4096, height: 3071 } }],
  ])('is false when %s differs', (_field, over) => {
    expect(geometryEquals(geometry(), geometry(over))).toBe(false)
  })

  it('counts a horizontal and a vertical Flip on a 180° Rotation as a change, although the pixels match', () => {
    const before = geometry({ rotation: 180 })
    const after = geometry({ rotation: 180, flipH: true, flipV: true })

    expect(geometryEquals(before, after)).toBe(false)
  })
})

describe('rotateQuarter (AC-03)', () => {
  it('steps the Rotation by 90° each way', () => {
    expect(rotateQuarter(geometry(), 'cw', original).rotation).toBe(90)
    expect(rotateQuarter(geometry(), 'ccw', original).rotation).toBe(270)
    expect(rotateQuarter(geometry({ rotation: 270 }), 'cw', original).rotation).toBe(0)
  })

  it('turns the frame with the image: width and height swap, same content stays inside', () => {
    // A 4096×3072 image; Crop is the top-left 100×50 corner.
    const g = geometry({ crop: { x: 0, y: 0, width: 100, height: 50 } })

    // After a clockwise turn the image is 3072×4096 and the old top-left is now top-right.
    expect(rotateQuarter(g, 'cw', original).crop).toEqual({
      x: 3072 - 50,
      y: 0,
      width: 50,
      height: 100,
    })
    // After a counter-clockwise turn the old top-left is now bottom-left.
    expect(rotateQuarter(g, 'ccw', original).crop).toEqual({
      x: 0,
      y: 4096 - 100,
      width: 50,
      height: 100,
    })
  })

  it('keeps the Straighten angle and re-expresses a Crop with negative coordinates exactly', () => {
    const g = geometry({ straighten: 120, crop: { x: -3, y: -7, width: 90, height: 40 } })
    const turned = rotateQuarter(g, 'cw', original)

    expect(turned.straighten).toBe(120)
    expect(turned.crop).toEqual({ x: 3072 - (-7 + 40), y: -3, width: 40, height: 90 })
    expect(Number.isInteger(turned.crop.x) && Number.isInteger(turned.crop.y)).toBe(true)
  })

  it('gives back an equal Geometry after four turns one way or one turn each way (property)', () => {
    const rand = mulberry32(3)
    for (let i = 0; i < 500; i++) {
      const size = randomOriginal(rand)
      const g = { ...randomGeometry(rand, size), straighten: Math.round(rand() * 900) - 450 }
      let four = g
      for (let k = 0; k < 4; k++) four = rotateQuarter(four, 'cw', size)
      const back = rotateQuarter(rotateQuarter(g, 'cw', size), 'ccw', size)
      const backCcw = rotateQuarter(rotateQuarter(g, 'ccw', size), 'cw', size)

      expect(geometryEquals(four, g)).toBe(true)
      expect(geometryEquals(back, g)).toBe(true)
      expect(geometryEquals(backCcw, g)).toBe(true)
    }
  })

  it('keeps the Crop inside the turned image (property)', () => {
    const rand = mulberry32(5)
    for (let i = 0; i < 500; i++) {
      const size = randomOriginal(rand)
      const g = rotateQuarter(randomGeometry(rand, size), rand() < 0.5 ? 'cw' : 'ccw', size)
      const { width, height } = turnedSize(g, size)

      expect(g.crop.x).toBeGreaterThanOrEqual(0)
      expect(g.crop.y).toBeGreaterThanOrEqual(0)
      expect(g.crop.x + g.crop.width).toBeLessThanOrEqual(width)
      expect(g.crop.y + g.crop.height).toBeLessThanOrEqual(height)
    }
  })

  it('never mutates the Geometry it was given', () => {
    const g = geometry({ crop: { x: 1, y: 2, width: 3, height: 4 } })
    rotateQuarter(g, 'cw', original)
    expect(g).toEqual(geometry({ crop: { x: 1, y: 2, width: 3, height: 4 } }))
  })
})

describe('flipOnScreen (AC-04)', () => {
  it('toggles the stored horizontal Flip at 0° and 180° for a screen-horizontal flip', () => {
    expect(flipOnScreen(geometry({ rotation: 0 }), 'horizontal', original)).toMatchObject({
      flipH: true,
      flipV: false,
      rotation: 0,
    })
    expect(flipOnScreen(geometry({ rotation: 180 }), 'horizontal', original)).toMatchObject({
      flipH: true,
      flipV: false,
      rotation: 180,
    })
  })

  it('toggles the stored vertical Flip at 90° and 270° for a screen-horizontal flip', () => {
    for (const rotation of [90, 270] as const) {
      expect(flipOnScreen(geometry({ rotation }), 'horizontal', original)).toMatchObject({
        flipH: false,
        flipV: true,
        rotation,
      })
      expect(flipOnScreen(geometry({ rotation }), 'vertical', original)).toMatchObject({
        flipH: true,
        flipV: false,
        rotation,
      })
    }
  })

  it('mirrors the Crop in the turned image', () => {
    const g = geometry({ crop: { x: 10, y: 20, width: 100, height: 50 } })

    expect(flipOnScreen(g, 'horizontal', original).crop).toEqual({
      x: 4096 - 110,
      y: 20,
      width: 100,
      height: 50,
    })
    expect(flipOnScreen(g, 'vertical', original).crop).toEqual({
      x: 10,
      y: 3072 - 70,
      width: 100,
      height: 50,
    })
  })

  it('changes the sign of the Straighten angle', () => {
    expect(flipOnScreen(geometry({ straighten: 50 }), 'horizontal', original).straighten).toBe(-50)
    expect(flipOnScreen(geometry({ straighten: -50 }), 'vertical', original).straighten).toBe(50)
  })

  it('gives back an equal Geometry after flipping twice the same way (property)', () => {
    const rand = mulberry32(7)
    for (let i = 0; i < 500; i++) {
      const size = randomOriginal(rand)
      const g = { ...randomGeometry(rand, size), straighten: Math.round(rand() * 900) - 450 }
      for (const axis of ['horizontal', 'vertical'] as const) {
        const twice = flipOnScreen(flipOnScreen(g, axis, size), axis, size)
        expect(geometryEquals(twice, g)).toBe(true)
      }
    }
  })
})
