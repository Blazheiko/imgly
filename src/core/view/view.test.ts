import { describe, expect, it } from 'vitest'
import {
  clampPan,
  fitView,
  fitZoom,
  panBy,
  resizeView,
  setActualSize,
  stepZoom,
  zoomAt,
  zoomRange,
  ZOOM_STEPS,
  type View,
  type ViewContext,
} from './index'

const ctx = (iw: number, ih: number, cw: number, ch: number): ViewContext => ({
  image: { width: iw, height: ih },
  canvas: { width: cw, height: ch },
})

/** Where image point (x, y) lands on the canvas under `view`. */
const toCanvas = (view: View, x: number, y: number) => ({
  x: view.panX + x * view.zoom,
  y: view.panY + y * view.zoom,
})

describe('fitZoom', () => {
  it('is the largest zoom at which the whole image fits', () => {
    expect(fitZoom({ width: 4000, height: 2000 }, { width: 1000, height: 1000 })).toBe(0.25)
    expect(fitZoom({ width: 2000, height: 4000 }, { width: 1000, height: 1000 })).toBe(0.25)
  })

  it('never exceeds 100%, so a small image is not enlarged (AC-01)', () => {
    expect(fitZoom({ width: 200, height: 100 }, { width: 1000, height: 800 })).toBe(1)
  })
})

describe('fitView', () => {
  it('centres the image at Fit with auto-fit on', () => {
    expect(fitView(ctx(200, 100, 1000, 800))).toEqual({
      zoom: 1,
      panX: 400,
      panY: 350,
      autoFit: true,
    })
  })

  it('fills one axis and centres the other for a large image', () => {
    const view = fitView(ctx(4000, 2000, 1000, 1000))
    expect(view.zoom).toBe(0.25)
    expect(view.panX).toBe(0)
    expect(view.panY).toBe(250)
  })
})

describe('zoom range and steps', () => {
  it('runs from min(Fit, 10%) to 800%', () => {
    expect(zoomRange(0.5)).toEqual({ min: 0.1, max: 8 })
    expect(zoomRange(0.04)).toEqual({ min: 0.04, max: 8 })
  })

  it('uses the fixed zoom steps from the epic', () => {
    expect(ZOOM_STEPS.map((z) => Math.round(z * 10000) / 100)).toEqual([
      10, 25, 33.33, 50, 66.67, 100, 150, 200, 300, 400, 600, 800,
    ])
  })

  it('steps in to the next level strictly above the current zoom', () => {
    const c = ctx(1000, 1000, 500, 500)
    expect(stepZoom({ zoom: 0.42, panX: 0, panY: 0, autoFit: false }, 1, c).zoom).toBe(0.5)
    expect(stepZoom({ zoom: 0.5, panX: 0, panY: 0, autoFit: false }, 1, c).zoom).toBeCloseTo(2 / 3)
  })

  it('steps out to the next level strictly below the current zoom', () => {
    const c = ctx(1000, 1000, 500, 500)
    expect(stepZoom({ zoom: 0.42, panX: 0, panY: 0, autoFit: false }, -1, c).zoom).toBeCloseTo(
      1 / 3,
    )
  })

  it('stops at 800% and at min(Fit, 10%)', () => {
    const c = ctx(1000, 1000, 500, 500)
    expect(stepZoom({ zoom: 8, panX: 0, panY: 0, autoFit: false }, 1, c).zoom).toBe(8)
    expect(stepZoom({ zoom: 0.1, panX: 0, panY: 0, autoFit: false }, -1, c).zoom).toBe(0.1)

    const huge = ctx(40000, 40000, 1000, 1000) // Fit = 2.5%
    expect(stepZoom({ zoom: 0.1, panX: 0, panY: 0, autoFit: false }, -1, huge).zoom).toBe(0.025)
    expect(stepZoom({ zoom: 0.025, panX: 0, panY: 0, autoFit: false }, 1, huge).zoom).toBe(0.1)
  })

  it('zooms around the canvas centre and turns auto-fit off', () => {
    const c = ctx(1000, 1000, 500, 500)
    const before = fitView(c) // 50%, image fills the canvas
    const after = stepZoom(before, 1, c)
    // The image point under the centre (500, 500) stays under the centre.
    const centre = toCanvas(after, 500, 500)
    expect(centre.x).toBeCloseTo(250)
    expect(centre.y).toBeCloseTo(250)
    expect(after.autoFit).toBe(false)
  })
})

describe('zoomAt', () => {
  it('keeps the image point under the pointer fixed', () => {
    const c = ctx(4000, 3000, 1000, 1000)
    const view: View = { zoom: 1, panX: -1000, panY: -1000, autoFit: false }
    const pointer = { x: 300, y: 700 }
    const imagePoint = { x: (300 + 1000) / 1, y: (700 + 1000) / 1 }

    const after = zoomAt(view, 2, pointer, c)

    expect(after.zoom).toBe(2)
    expect(toCanvas(after, imagePoint.x, imagePoint.y)).toEqual(pointer)
  })

  it('clamps past either end of the range (AC-12b)', () => {
    const c = ctx(1000, 1000, 500, 500)
    const view = fitView(c)
    expect(zoomAt(view, 1000, { x: 250, y: 250 }, c).zoom).toBe(8)
    expect(zoomAt(view, 0.0001, { x: 250, y: 250 }, c).zoom).toBe(0.1)
  })

  it('turns auto-fit off when the zoom changes', () => {
    const c = ctx(1000, 1000, 500, 500)
    expect(zoomAt(fitView(c), 2, { x: 0, y: 0 }, c).autoFit).toBe(false)
  })

  it('returns the same View when a clamped gesture changes nothing', () => {
    const c = ctx(1000, 1000, 500, 500)
    const atMax: View = { zoom: 8, panX: -3750, panY: -3750, autoFit: false }
    expect(zoomAt(atMax, 2, { x: 250, y: 250 }, c)).toBe(atMax)
  })
})

describe('setActualSize', () => {
  it('shows one image pixel per device pixel around the centre', () => {
    const c = ctx(4000, 4000, 1000, 1000)
    const after = setActualSize(fitView(c), c)
    expect(after.zoom).toBe(1)
    expect(toCanvas(after, 2000, 2000)).toEqual({ x: 500, y: 500 })
    expect(after.autoFit).toBe(false)
  })
})

describe('pan (AC-13)', () => {
  const c = ctx(4000, 4000, 1000, 1000)
  const zoomed: View = { zoom: 1, panX: -1500, panY: -1500, autoFit: false }

  it('moves the image by the gesture delta', () => {
    expect(panBy(zoomed, 100, -50, c)).toMatchObject({ panX: -1400, panY: -1550 })
  })

  it('stops at the image edge', () => {
    expect(panBy(zoomed, 99999, 99999, c)).toMatchObject({ panX: 0, panY: 0 })
    expect(panBy(zoomed, -99999, -99999, c)).toMatchObject({ panX: -3000, panY: -3000 })
  })

  it('keeps an axis where the image fits centred', () => {
    const wide = ctx(4000, 400, 1000, 1000)
    const view: View = { zoom: 1, panX: -1500, panY: 300, autoFit: false }
    expect(panBy(view, 0, 200, wide)).toMatchObject({ panX: -1500, panY: 300 })
  })

  it('does not pan an image that fits, and leaves auto-fit on', () => {
    const fit = fitView(c)
    expect(panBy(fit, 120, 80, c)).toBe(fit)
  })

  it('turns auto-fit off after a manual pan', () => {
    expect(panBy({ ...zoomed, autoFit: true }, 10, 0, c).autoFit).toBe(false)
  })

  it('clampPan pulls an out-of-range pan back inside', () => {
    expect(clampPan({ zoom: 1, panX: 500, panY: -5000, autoFit: false }, c)).toEqual({
      zoom: 1,
      panX: 0,
      panY: -3000,
      autoFit: false,
    })
  })
})

describe('resizeView (AC-12b)', () => {
  it('re-fits to the new canvas while auto-fit is on', () => {
    const before = fitView(ctx(4000, 4000, 1000, 1000))
    expect(resizeView(before, ctx(4000, 4000, 2000, 1000))).toEqual(
      fitView(ctx(4000, 4000, 2000, 1000)),
    )
  })

  it('keeps the zoom and re-clamps the pan after a manual zoom', () => {
    const view: View = { zoom: 1, panX: -3000, panY: -3000, autoFit: false }
    const after = resizeView(view, ctx(4000, 4000, 2000, 2000))
    expect(after).toEqual({ zoom: 1, panX: -2000, panY: -2000, autoFit: false })
  })

  it('raises a zoom that falls below the new range', () => {
    const view: View = { zoom: 0.05, panX: 0, panY: 0, autoFit: false }
    // Fit on the bigger canvas is 25%, so the floor becomes 10%.
    expect(resizeView(view, ctx(4000, 4000, 1000, 1000)).zoom).toBe(0.1)
  })
})

describe('View functions never touch a Work (AC-14)', () => {
  it('returns only View fields', () => {
    const c = ctx(4000, 4000, 1000, 1000)
    const views = [
      fitView(c),
      zoomAt(fitView(c), 3, { x: 1, y: 2 }, c),
      stepZoom(fitView(c), 1, c),
      panBy({ zoom: 1, panX: 0, panY: 0, autoFit: false }, -5, -5, c),
      setActualSize(fitView(c), c),
      resizeView(fitView(c), c),
    ]
    for (const view of views) {
      expect(Object.keys(view).sort()).toEqual(['autoFit', 'panX', 'panY', 'zoom'])
    }
  })
})
