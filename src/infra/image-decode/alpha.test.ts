import { describe, expect, it } from 'vitest'
import { hasTransparentPixel } from './alpha'

/** A canvas whose 2D context draws nothing and reads back the given RGBA pixels by row strips. */
function canvasOver(width: number, height: number, rgba: Uint8ClampedArray) {
  const reads: number[][] = []
  const create = (w: number, h: number) =>
    ({
      width: w,
      height: h,
      getContext: () => ({
        drawImage: () => {},
        getImageData: (x: number, y: number, sw: number, sh: number) => {
          reads.push([x, y, sw, sh])
          return { data: rgba.slice(y * width * 4, (y + sh) * width * 4) }
        },
      }),
    }) as unknown as OffscreenCanvas
  const bitmap = { width, height } as ImageBitmap
  return { create, bitmap, reads }
}

function opaque(width: number, height: number) {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255
  return rgba
}

describe('hasTransparentPixel (AC-15)', () => {
  it('is false for a fully opaque image with an alpha channel', () => {
    const { create, bitmap } = canvasOver(3, 2, opaque(3, 2))
    expect(hasTransparentPixel(bitmap, create)).toBe(false)
  })

  it('is true for a single pixel with alpha 254', () => {
    const rgba = opaque(3, 2)
    rgba[(1 * 3 + 2) * 4 + 3] = 254
    const { create, bitmap } = canvasOver(3, 2, rgba)
    expect(hasTransparentPixel(bitmap, create)).toBe(true)
  })

  it('reads in bounded row strips and stops at the first transparent pixel', () => {
    const width = 4
    const height = 600
    const rgba = opaque(width, height)
    rgba[300 * width * 4 + 3] = 0
    const { create, bitmap, reads } = canvasOver(width, height, rgba)

    expect(hasTransparentPixel(bitmap, create)).toBe(true)
    expect(reads.every(([, , , rows]) => rows! <= 256)).toBe(true)
    expect(reads.at(-1)![1]).toBeLessThanOrEqual(300)
    expect(reads.length).toBeLessThan(Math.ceil(height / 256))
  })
})
