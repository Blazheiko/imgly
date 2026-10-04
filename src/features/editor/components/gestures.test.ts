import { describe, expect, it } from 'vitest'
import { wheelGesture, type WheelInput } from './gestures'

const rect = { left: 100, top: 50 }
// Plain inputs: happy-dom's WheelEvent drops modifier keys and client coordinates.
const wheel = (init: Partial<WheelInput>): WheelInput => ({
  deltaX: 0,
  deltaY: 0,
  deltaMode: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  clientX: 300,
  clientY: 250,
  ...init,
})

describe('wheelGesture', () => {
  it('zooms in toward the pointer for Ctrl+wheel up, in device pixels', () => {
    const g = wheelGesture(wheel({ ctrlKey: true, deltaY: -100 }), rect, 2)
    expect(g.kind).toBe('zoom')
    if (g.kind !== 'zoom') return
    expect(g.factor).toBeGreaterThan(1)
    expect(g.point).toEqual({ x: 400, y: 400 }) // (300-100)*2, (250-50)*2
  })

  it('zooms out for Cmd+wheel down (trackpad pinch arrives as ctrlKey too)', () => {
    const g = wheelGesture(wheel({ metaKey: true, deltaY: 100 }), rect, 1)
    expect(g.kind === 'zoom' && g.factor < 1).toBe(true)
  })

  it('is symmetric: in then out by the same delta returns to the start', () => {
    const zin = wheelGesture(wheel({ ctrlKey: true, deltaY: -40 }), rect, 1)
    const zout = wheelGesture(wheel({ ctrlKey: true, deltaY: 40 }), rect, 1)
    if (zin.kind !== 'zoom' || zout.kind !== 'zoom') throw new Error('expected zoom')
    expect(zin.factor * zout.factor).toBeCloseTo(1)
  })

  it('pans vertically for a plain wheel, moving the image against the scroll', () => {
    expect(wheelGesture(wheel({ deltaY: 30 }), rect, 2)).toEqual({ kind: 'pan', dx: -0, dy: -60 })
  })

  it('pans horizontally for Shift+wheel', () => {
    expect(wheelGesture(wheel({ shiftKey: true, deltaY: 30 }), rect, 1)).toEqual({
      kind: 'pan',
      dx: -30,
      dy: 0,
    })
  })

  it('pans both ways for a two-finger trackpad scroll', () => {
    expect(wheelGesture(wheel({ deltaX: 5, deltaY: -7 }), rect, 1)).toEqual({
      kind: 'pan',
      dx: -5,
      dy: 7,
    })
  })

  it('converts line-mode deltas to pixels', () => {
    expect(wheelGesture(wheel({ deltaY: 3, deltaMode: 1 }), rect, 1)).toEqual({
      kind: 'pan',
      dx: -0,
      dy: -48,
    })
  })
})
