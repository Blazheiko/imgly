import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { catmullRomSegments, identityGeometry, type Geometry } from '@/core'
import { createLayer, setLayerCanvasFactory, type CanvasFactory, type Layer } from './layer'
import { alphaLowered, paintDot, paintSegment, unionRect, type BrushStyle } from './painter'
import { createFakeCanvas, type FakeCanvas } from './fake-canvas'

const calls = (layer: Layer) => (layer.pixels as unknown as FakeCanvas).calls
const names = (layer: Layer) => calls(layer).map((c) => c[0])
const image = (alphas: number[]) =>
  ({
    width: alphas.length,
    height: 1,
    data: new Uint8ClampedArray(alphas.flatMap((a) => [10, 20, 30, a])),
  }) as unknown as ImageData

const brush: BrushStyle = { mode: 'brush', colour: '#E53935', width: 12 }
const eraser: BrushStyle = { mode: 'eraser', colour: '#E53935', width: 12 }

describe('render/drawing painter (ADR-0002)', () => {
  let previous: CanvasFactory
  let layer: Layer
  const original = { width: 400, height: 300 }

  beforeEach(() => {
    previous = setLayerCanvasFactory((w, h) => createFakeCanvas(w, h) as unknown as OffscreenCanvas)
    layer = createLayer(original)
    calls(layer).length = 0
  })
  afterEach(() => {
    setLayerCanvasFactory(previous)
  })

  const segment = catmullRomSegments([
    { x: 50, y: 60 },
    { x: 90, y: 70 },
  ])[0]!

  it('paints a Brush segment: save → setTransform → clip(crop) → source-over → round stroke → restore', () => {
    const g: Geometry = {
      ...identityGeometry(original),
      crop: { x: 10, y: 20, width: 200, height: 100 },
    }
    paintSegment(layer, segment, brush, g)
    const seq = names(layer)
    expect(seq.indexOf('save')).toBeLessThan(seq.indexOf('setTransform'))
    expect(seq.indexOf('setTransform')).toBeLessThan(seq.indexOf('clip'))
    expect(seq.indexOf('clip')).toBeLessThan(seq.indexOf('stroke'))
    expect(seq.at(-1)).toBe('restore')
    expect(calls(layer)).toContainEqual(['setTransform', 1, 0, 0, 1, 0, 0])
    expect(calls(layer)).toContainEqual(['rect', 10, 20, 200, 100])
    expect(calls(layer)).toContainEqual(['set globalCompositeOperation', 'source-over'])
    expect(calls(layer)).toContainEqual(['set lineCap', 'round'])
    expect(calls(layer)).toContainEqual(['set lineJoin', 'round'])
    expect(calls(layer)).toContainEqual(['set lineWidth', 12])
    expect(calls(layer)).toContainEqual(['set strokeStyle', '#E53935'])
    expect(calls(layer)).toContainEqual(['moveTo', 50, 60])
    expect(calls(layer)).toContainEqual([
      'bezierCurveTo',
      segment.c1.x,
      segment.c1.y,
      segment.c2.x,
      segment.c2.y,
      90,
      70,
    ])
  })

  it('erases with destination-out on the layer, restored afterwards', () => {
    paintSegment(layer, segment, eraser, identityGeometry(original))
    const seq = calls(layer)
    const op = seq.findIndex((c) => c[0] === 'set globalCompositeOperation')
    expect(seq[op]).toEqual(['set globalCompositeOperation', 'destination-out'])
    expect(seq.findIndex((c) => c[0] === 'restore')).toBeGreaterThan(op)
  })

  it('sets the frame-to-Original transform of the Geometry', () => {
    const g: Geometry = { ...identityGeometry(original), rotation: 90 }
    paintSegment(layer, segment, brush, g)
    // A 90° turn: frame (x, y) → Original (y, H0 − x).
    expect(calls(layer)).toContainEqual(['setTransform', 0, -1, 1, 0, 0, 300])
  })

  it('paints a dot as a filled circle of the width, clipped to the Crop (AC-09)', () => {
    const g: Geometry = {
      ...identityGeometry(original),
      crop: { x: 0, y: 0, width: 100, height: 100 },
    }
    const dirty = paintDot(layer, { x: 102, y: 50 }, brush, g)
    expect(calls(layer)).toContainEqual(['arc', 102, 50, 6, 0, Math.PI * 2])
    expect(calls(layer)).toContainEqual(['rect', 0, 0, 100, 100])
    expect(names(layer)).toContain('fill')
    expect(calls(layer)).toContainEqual(['set fillStyle', '#E53935'])
    expect(dirty).toEqual({ x: 102 - 8, y: 50 - 8, width: 16, height: 16 })
  })

  it('returns the dirty rectangle on the Original grid: bounds + width/2 + 2, whole pixels', () => {
    const dirty = paintSegment(layer, segment, brush, identityGeometry(original))
    expect(dirty.x).toBeLessThanOrEqual(50 - 8)
    expect(dirty.y).toBeLessThanOrEqual(60 - 8)
    expect(dirty.x + dirty.width).toBeGreaterThanOrEqual(90 + 8)
    expect(dirty.y + dirty.height).toBeGreaterThanOrEqual(70 + 8)
    for (const v of Object.values(dirty)) expect(Number.isInteger(v)).toBe(true)
  })

  it('maps the dirty rectangle through a turn', () => {
    const g: Geometry = { ...identityGeometry(original), rotation: 90 }
    const dirty = paintDot(layer, { x: 50, y: 20 }, brush, g)
    // Frame (50, 20) → Original (20, 250).
    expect(dirty).toEqual({ x: 12, y: 242, width: 16, height: 16 })
  })

  it('clamps a dirty rectangle wholly outside the layer to empty', () => {
    const dirty = paintDot(layer, { x: -500, y: -500 }, brush, identityGeometry(original))
    expect(dirty.width * dirty.height).toBe(0)
  })

  it('never touches anything but the layer it was given', () => {
    paintSegment(layer, segment, brush, identityGeometry(original))
    expect(calls(layer).some((c) => c[0] === 'drawImage' || c[0] === 'putImageData')).toBe(false)
  })
})

describe('unionRect', () => {
  it('joins two rectangles, and an empty one adds nothing', () => {
    expect(
      unionRect({ x: 0, y: 0, width: 2, height: 2 }, { x: 5, y: 1, width: 1, height: 4 }),
    ).toEqual({ x: 0, y: 0, width: 6, height: 5 })
    expect(unionRect(null, { x: 1, y: 1, width: 1, height: 1 })).toEqual({
      x: 1,
      y: 1,
      width: 1,
      height: 1,
    })
    expect(
      unionRect({ x: 1, y: 1, width: 1, height: 1 }, { x: 9, y: 9, width: 0, height: 0 }),
    ).toEqual({
      x: 1,
      y: 1,
      width: 1,
      height: 1,
    })
  })
})

describe('alphaLowered (sad.md §4 change flag)', () => {
  it('is false when only colour changed (Brush over Brush)', () => {
    const before = image([255, 255, 0])
    const after = image([255, 255, 0])
    after.data[0] = 200
    expect(alphaLowered(before, after)).toBe(false)
  })

  it('is true when one pixel went 255 → 254', () => {
    expect(alphaLowered(image([255, 255, 0]), image([255, 254, 0]))).toBe(true)
  })

  it('is false when alpha only rose', () => {
    expect(alphaLowered(image([0, 10]), image([255, 10]))).toBe(false)
  })
})
