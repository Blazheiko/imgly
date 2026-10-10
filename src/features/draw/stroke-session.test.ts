import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { identityGeometry, type Geometry, type View } from '@/core'
import {
  createLayer,
  setLayerCanvasFactory,
  type CanvasFactory,
  type Layer,
  type LayerRect,
} from '@/render'
import { createFakeLayerCanvas, setPixel, type FakeLayerCanvas } from '@/render/testing'
import { StrokeSession, type StrokeTarget } from './stroke-session'

const SIZE = { width: 400, height: 300 }
const calls = (layer: Layer) => (layer.pixels as unknown as FakeLayerCanvas).calls
const painted = (layer: Layer, name: 'moveTo' | 'arc' | 'bezierCurveTo') =>
  calls(layer).filter((c) => c[0] === name)
const view = (zoom = 1, panX = 0, panY = 0): View => ({ zoom, panX, panY, autoFit: false })

function target(initial: Layer | null = null) {
  let layer = initial
  let changed = false
  const dirty: LayerRect[] = []
  const t: StrokeTarget = {
    layer: () => layer,
    ensureLayer: () => (layer ??= createLayer(SIZE)),
    isChanged: () => changed,
    markChanged: () => {
      changed = true
    },
    layerChanged: (rect) => dirty.push(rect),
  }
  return {
    t,
    dirty,
    get layer() {
      return layer
    },
    get changed() {
      return changed
    },
  }
}

describe('StrokeSession (draw ADR-0002)', () => {
  let previous: CanvasFactory
  const g: Geometry = identityGeometry(SIZE)
  const brush = { mode: 'brush' as const, colour: '#E53935', width: 10 }
  const eraser = { mode: 'eraser' as const, colour: '#E53935', width: 10 }

  beforeEach(() => {
    previous = setLayerCanvasFactory(
      (w, h) => createFakeLayerCanvas(w, h) as unknown as OffscreenCanvas,
    )
  })
  afterEach(() => setLayerCanvasFactory(previous))

  it('maps device points through the View into the Crop’s frame', () => {
    const s = target()
    const crop = { x: 50, y: 40, width: 200, height: 200 }
    const session = new StrokeSession(brush, { ...g, crop }, s.t)
    session.begin({ x: 20, y: 30 }, view(2, 10, 10))
    session.end()
    expect(painted(s.layer!, 'arc')[0]!.slice(1, 3)).toEqual([55, 50])
  })

  it('paints the segment behind the newest point once the next arrives, and the last on release', () => {
    const s = target()
    const session = new StrokeSession(brush, g, s.t)
    session.begin({ x: 10, y: 10 }, view())
    session.move([{ x: 20, y: 10 }], view())
    expect(s.layer).toBeNull() // no segment is complete yet
    session.move([{ x: 30, y: 20 }], view())
    expect(painted(s.layer!, 'moveTo').map((c) => c.slice(1))).toEqual([[10, 10]])
    session.move([{ x: 40, y: 20 }], view())
    expect(painted(s.layer!, 'moveTo').map((c) => c.slice(1))).toEqual([
      [10, 10],
      [20, 10],
    ])
    session.end()
    expect(painted(s.layer!, 'moveTo').map((c) => c.slice(1))).toEqual([
      [10, 10],
      [20, 10],
      [30, 20],
    ])
    // Every segment ends exactly at the next point: the line passes through every position.
    expect(painted(s.layer!, 'bezierCurveTo').map((c) => c.slice(5))).toEqual([
      [20, 10],
      [30, 20],
      [40, 20],
    ])
  })

  it('takes coalesced positions as points of the line, with one dirty rectangle per event', () => {
    const s = target()
    const session = new StrokeSession(brush, g, s.t)
    session.begin({ x: 10, y: 10 }, view())
    session.move(
      [
        { x: 20, y: 10 },
        { x: 30, y: 10 },
        { x: 40, y: 10 },
        { x: 50, y: 10 },
      ],
      view(),
    )
    expect(painted(s.layer!, 'moveTo')).toHaveLength(3)
    expect(s.dirty).toHaveLength(1)
    expect(s.dirty[0]!.x).toBeLessThanOrEqual(10 - 7)
    expect(s.dirty[0]!.x + s.dirty[0]!.width).toBeGreaterThanOrEqual(40 + 7)
  })

  it('a later zoom maps only later points; what was painted stays', () => {
    const s = target()
    const session = new StrokeSession(brush, g, s.t)
    session.begin({ x: 10, y: 10 }, view(1))
    session.move([{ x: 20, y: 10 }], view(1))
    session.move([{ x: 60, y: 20 }], view(2))
    session.end()
    const ends = painted(s.layer!, 'bezierCurveTo').map((c) => c.slice(5))
    expect(ends).toEqual([
      [20, 10],
      [30, 10],
    ])
  })

  it('a click without moving paints one round dot of the width', () => {
    const s = target()
    const session = new StrokeSession(brush, g, s.t)
    session.begin({ x: 100, y: 100 }, view())
    session.end()
    expect(painted(s.layer!, 'arc')).toEqual([['arc', 100, 100, 5, 0, Math.PI * 2]])
    expect(s.changed).toBe(true)
    expect(s.dirty).toHaveLength(1)
  })

  it('two equal points give a dot: a move that stays on the press point paints no zero-length curve', () => {
    for (const style of [brush, eraser]) {
      const s = target(style.mode === 'eraser' ? createLayer(SIZE) : null)
      const session = new StrokeSession(style, g, s.t)
      session.begin({ x: 100, y: 100 }, view())
      session.move(
        [
          { x: 100, y: 100 },
          { x: 100, y: 100 },
        ],
        view(),
      ) // e.g. a pen's pressure change
      session.end()
      expect(painted(s.layer!, 'bezierCurveTo')).toEqual([])
      expect(painted(s.layer!, 'arc')).toEqual([['arc', 100, 100, 5, 0, Math.PI * 2]])
    }
  })

  it('a repeated position mid-Stroke adds no zero-length segment', () => {
    const s = target()
    const session = new StrokeSession(brush, g, s.t)
    session.begin({ x: 10, y: 10 }, view())
    session.move(
      [
        { x: 20, y: 10 },
        { x: 20, y: 10 },
        { x: 30, y: 10 },
      ],
      view(),
    )
    session.end()
    expect(painted(s.layer!, 'bezierCurveTo').map((c) => c.slice(5))).toEqual([
      [20, 10],
      [30, 10],
    ])
  })

  it('a Brush footprint inside the Crop sets the change flag; entirely outside paints nothing', () => {
    const outside = target()
    const crop = { x: 100, y: 100, width: 100, height: 100 }
    const away = new StrokeSession(brush, { ...g, crop }, outside.t)
    away.begin({ x: -60, y: -60 }, view()) // frame (40, 40)
    away.move([{ x: -80, y: -50 }], view()) // frame (20, 50)
    away.end()
    expect(outside.layer).toBeNull()
    expect(outside.changed).toBe(false)

    // Just outside the Crop, but within half the width: the band inside is painted (AC-09).
    const band = target()
    const near = new StrokeSession(brush, { ...g, crop }, band.t)
    near.begin({ x: -4, y: 20 }, view()) // frame (96, 120)
    near.move([{ x: -4, y: 60 }], view())
    near.end()
    expect(band.layer).not.toBeNull()
    expect(band.changed).toBe(true)
  })

  it('an Eraser on an empty Draft creates no layer and changes nothing (AC-04)', () => {
    const s = target()
    const session = new StrokeSession(eraser, g, s.t)
    session.begin({ x: 10, y: 10 }, view())
    session.move([{ x: 50, y: 50 }], view())
    session.end()
    expect(s.layer).toBeNull()
    expect(s.changed).toBe(false)
    expect(s.dirty).toHaveLength(0)
  })

  it('an Eraser sets the flag only when it lowered some alpha', () => {
    const layer = createLayer(SIZE)
    const s = target(layer)
    const fake = layer.pixels as unknown as FakeLayerCanvas
    const session = new StrokeSession(eraser, g, s.t)
    session.begin({ x: 10, y: 10 }, view())
    session.end()
    expect(s.changed).toBe(false)

    // A painter stand-in: make the erase actually lower a pixel's alpha.
    setPixel(fake, 50, 50, [255, 0, 0, 255])
    const ctx = fake.getContext('2d') as unknown as { fill: () => void }
    ctx.fill = vi.fn(() => setPixel(fake, 50, 50, [255, 0, 0, 0]))
    const second = new StrokeSession(eraser, g, s.t)
    second.begin({ x: 50, y: 50 }, view())
    second.end()
    expect(s.changed).toBe(true)
  })

  it('stops checking alpha once the flag is set', () => {
    const layer = createLayer(SIZE)
    const s = target(layer)
    s.t.markChanged()
    calls(layer).length = 0
    const session = new StrokeSession(eraser, g, s.t)
    session.begin({ x: 10, y: 10 }, view())
    session.end()
    expect(calls(layer).filter((c) => c[0] === 'getImageData')).toHaveLength(0)
  })

  it('ignores moves after end', () => {
    const s = target()
    const session = new StrokeSession(brush, g, s.t)
    session.begin({ x: 10, y: 10 }, view())
    session.end()
    const before = calls(s.layer!).length
    session.move([{ x: 90, y: 90 }], view())
    session.end()
    expect(calls(s.layer!).length).toBe(before)
  })
})
