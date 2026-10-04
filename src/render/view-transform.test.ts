import { describe, expect, it } from 'vitest'
import { fitView, zoomAt, type View } from '@/core'
import { viewToTransform } from './view-transform'

/** Applies the column-major mat3 to an image-unit point (u, v) ∈ [0,1]². */
function apply(m: Float32Array, u: number, v: number) {
  return { x: m[0]! * u + m[3]! * v + m[6]!, y: m[1]! * u + m[4]! * v + m[7]! }
}

const image = { width: 4000, height: 2000 }
const canvas = { width: 1000, height: 1000 }

describe('viewToTransform', () => {
  it('maps the image at Fit to the full width, centred vertically', () => {
    const m = viewToTransform(fitView({ image, canvas }), image, canvas)

    expect(apply(m, 0, 0)).toEqual({ x: -1, y: 0.5 }) // top-left
    expect(apply(m, 1, 1)).toEqual({ x: 1, y: -0.5 }) // bottom-right
  })

  it('makes one image pixel span one device pixel at 100%', () => {
    const view: View = { zoom: 1, panX: -1500, panY: -500, autoFit: false }
    const m = viewToTransform(view, image, canvas)
    const onePixel = 1 / image.width
    const a = apply(m, 0.5, 0.5)
    const b = apply(m, 0.5 + onePixel, 0.5)
    // Clip space is 2 units wide over 1000 device pixels.
    expect((b.x - a.x) * (canvas.width / 2)).toBeCloseTo(1)
  })

  it('places the image point under the pointer after zoom-at-point', () => {
    const ctx = { image, canvas }
    const view = zoomAt(
      { zoom: 1, panX: -1500, panY: -500, autoFit: false },
      2,
      { x: 250, y: 750 },
      ctx,
    )
    const m = viewToTransform(view, image, canvas)
    // Image pixel (1750, 1250) was under (250, 750) before the zoom and stays there.
    const p = apply(m, 1750 / image.width, 1250 / image.height)
    expect(p.x).toBeCloseTo(250 / 500 - 1)
    expect(p.y).toBeCloseTo(1 - 750 / 500)
  })

  it('moves with the pan, snapped to whole device pixels', () => {
    const m = viewToTransform(
      { zoom: 1, panX: -100.4, panY: -200.6, autoFit: false },
      image,
      canvas,
    )
    const topLeft = apply(m, 0, 0)
    expect((topLeft.x + 1) * 500).toBeCloseTo(-100)
    expect((1 - topLeft.y) * 500).toBeCloseTo(-201)
  })
})
