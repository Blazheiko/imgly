import { describe, expect, it } from 'vitest'
import {
  centreRect,
  clampCrop,
  identityGeometry,
  isInsideTurned,
  moveCrop,
  resizeCrop,
  turnedSize,
  type CropHandle,
  type CropRect,
  type Geometry,
} from './index'
import { int, mulberry32, randomGeometry } from './test-helpers'

const original = { width: 200, height: 100 }
const withCrop = (crop: CropRect, over: Partial<Geometry> = {}): Geometry => ({
  ...identityGeometry(original),
  ...over,
  crop,
})

const HANDLES: CropHandle[] = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw']

/** The AC-02 invariant: whole pixels, at least 1×1, inside the turned image. */
function expectValid(g: Geometry, size: { width: number; height: number }) {
  const { x, y, width, height } = g.crop
  for (const v of [x, y, width, height]) expect(Number.isInteger(v)).toBe(true)
  expect(width).toBeGreaterThanOrEqual(1)
  expect(height).toBeGreaterThanOrEqual(1)
  expect(isInsideTurned(g.crop, g, size)).toBe(true)
}

describe('centreRect (AC-02 odd-pixel rule)', () => {
  it('rounds the left and top edges down, so the extra pixel goes right and down', () => {
    expect(centreRect(100, 50, 101, 31)).toEqual({ x: 49, y: 34, width: 101, height: 31 })
    expect(centreRect(100, 50, 100, 30)).toEqual({ x: 50, y: 35, width: 100, height: 30 })
  })
})

describe('isInsideTurned', () => {
  it('without a Straighten angle, is plain containment in the turned image', () => {
    const g = withCrop({ x: 0, y: 0, width: 200, height: 100 })
    expect(isInsideTurned({ x: 0, y: 0, width: 200, height: 100 }, g, original)).toBe(true)
    expect(isInsideTurned({ x: 1, y: 0, width: 200, height: 100 }, g, original)).toBe(false)
    expect(isInsideTurned({ x: -1, y: 0, width: 10, height: 10 }, g, original)).toBe(false)
  })

  it('with a Straighten angle, the corners of the turned image are cut away', () => {
    const g = withCrop({ x: 0, y: 0, width: 200, height: 100 }, { straighten: 100 })
    expect(isInsideTurned({ x: 0, y: 0, width: 10, height: 10 }, g, original)).toBe(false)
    expect(isInsideTurned({ x: 90, y: 40, width: 20, height: 20 }, g, original)).toBe(true)
  })
})

describe('moveCrop', () => {
  it('moves the frame by whole pixels, size unchanged', () => {
    const g = moveCrop(withCrop({ x: 10, y: 10, width: 50, height: 30 }), 5, -3, original)
    expect(g.crop).toEqual({ x: 15, y: 7, width: 50, height: 30 })
  })

  it('stops at the edge of the image, each axis on its own', () => {
    const g = withCrop({ x: 10, y: 10, width: 50, height: 30 })
    expect(moveCrop(g, -500, 0, original).crop).toEqual({ x: 0, y: 10, width: 50, height: 30 })
    expect(moveCrop(g, 500, 500, original).crop).toEqual({ x: 150, y: 70, width: 50, height: 30 })
  })

  it('keeps a 1×1 Crop 1×1 and inside', () => {
    const g = moveCrop(withCrop({ x: 199, y: 99, width: 1, height: 1 }), 10, 10, original)
    expect(g.crop).toEqual({ x: 199, y: 99, width: 1, height: 1 })
  })

  it('on a straightened image, stops where a frame corner meets the edge', () => {
    const g = withCrop({ x: 90, y: 40, width: 20, height: 20 }, { straighten: 100 })
    const moved = moveCrop(g, -500, -500, original)
    expectValid(moved, original)
    expect(moved.crop.width).toBe(20)
    // One step further in either direction leaves the turned image.
    expect(
      isInsideTurned({ ...moved.crop, x: moved.crop.x - 1, y: moved.crop.y - 1 }, moved, original),
    ).toBe(false)
  })
})

describe('resizeCrop', () => {
  const g = withCrop({ x: 50, y: 20, width: 100, height: 60 })

  it.each([
    ['e', 10, 0, { x: 50, y: 20, width: 110, height: 60 }],
    ['w', -10, 0, { x: 40, y: 20, width: 110, height: 60 }],
    ['n', 0, -5, { x: 50, y: 15, width: 100, height: 65 }],
    ['s', 0, 5, { x: 50, y: 20, width: 100, height: 65 }],
    ['se', 10, 5, { x: 50, y: 20, width: 110, height: 65 }],
    ['nw', -10, -5, { x: 40, y: 15, width: 110, height: 65 }],
    ['ne', 10, -5, { x: 50, y: 15, width: 110, height: 65 }],
    ['sw', -10, 5, { x: 40, y: 20, width: 110, height: 65 }],
  ] as const)('moves only the %s edges, the opposite ones stay put', (handle, dx, dy, crop) => {
    expect(resizeCrop(g, handle, dx, dy, original).crop).toEqual(crop)
  })

  it('ignores the delta across the handle (an edge moves on one axis only)', () => {
    expect(resizeCrop(g, 'e', 10, 40, original).crop).toEqual({
      x: 50,
      y: 20,
      width: 110,
      height: 60,
    })
  })

  it('stops the moving edge at the edge of the image', () => {
    expect(resizeCrop(g, 'e', 500, 0, original).crop).toEqual({
      x: 50,
      y: 20,
      width: 150,
      height: 60,
    })
    expect(resizeCrop(g, 'nw', -500, -500, original).crop).toEqual({
      x: 0,
      y: 0,
      width: 150,
      height: 80,
    })
  })

  it('stops 1 px before the opposite edge and never turns inside out', () => {
    expect(resizeCrop(g, 'e', -500, 0, original).crop).toEqual({
      x: 50,
      y: 20,
      width: 1,
      height: 60,
    })
    expect(resizeCrop(g, 'w', 500, 0, original).crop).toEqual({
      x: 149,
      y: 20,
      width: 1,
      height: 60,
    })
    expect(resizeCrop(g, 'n', 0, 500, original).crop).toEqual({
      x: 50,
      y: 79,
      width: 100,
      height: 1,
    })
  })
})

describe('clampCrop', () => {
  it('rounds to whole pixels, keeps at least 1×1 and pulls the Crop inside', () => {
    expect(
      clampCrop(withCrop({ x: -5.4, y: 3.6, width: 0.2, height: 500 }), original).crop,
    ).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 100,
    })
    expect(clampCrop(withCrop({ x: 190, y: 90, width: 50, height: 50 }), original).crop).toEqual({
      x: 150,
      y: 50,
      width: 50,
      height: 50,
    })
  })

  it('leaves a valid Crop as it is', () => {
    const g = withCrop({ x: 3, y: 4, width: 5, height: 6 })
    expect(clampCrop(g, original)).toEqual(g)
  })
})

describe('AC-02 invariant (property)', () => {
  it('holds for any move, any edge or corner resize and any delta, with or without an angle', () => {
    const rand = mulberry32(11)
    for (let i = 0; i < 2000; i++) {
      const size = { width: int(rand, 8, 300), height: int(rand, 8, 300) }
      let g = randomGeometry(rand, size)
      if (rand() < 0.5) {
        // A straightened Geometry: the Crop is a small frame around the turned image's centre.
        const t = turnedSize(g, size)
        g = clampCrop(
          {
            ...g,
            straighten: int(rand, -450, 450),
            crop: centreRect(t.width / 2, t.height / 2, 2, 2),
          },
          size,
        )
      }
      expectValid(g, size)
      const dx = (rand() - 0.5) * 1000
      const dy = (rand() - 0.5) * 1000
      const next =
        rand() < 0.3
          ? moveCrop(g, dx, dy, size)
          : resizeCrop(g, HANDLES[int(rand, 0, 7)] as CropHandle, dx, dy, size)
      expectValid(next, size)
    }
  })
})
