import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bitmapLedger, resetBitmapLedger } from '@/shared'
import {
  copyLayer,
  createLayer,
  hasAnyMark,
  isBlankLayer,
  layerContext,
  readRect,
  releaseLayer,
  setLayerCanvasFactory,
  type CanvasFactory,
} from './layer'
import { createFakeCanvas, getPixel, setPixel, type FakeCanvas } from './fake-canvas'

const fake = (layer: { pixels: unknown }) => layer.pixels as unknown as FakeCanvas

describe('render/drawing layer (ADR-0001)', () => {
  let previous: CanvasFactory

  beforeEach(() => {
    previous = setLayerCanvasFactory((w, h) => createFakeCanvas(w, h) as unknown as OffscreenCanvas)
    resetBitmapLedger()
  })
  afterEach(() => {
    setLayerCanvasFactory(previous)
  })

  it('creates a transparent layer of the Original’s size, with an id, read frequently', () => {
    const layer = createLayer({ width: 8, height: 6 })
    expect(layer.width).toBe(8)
    expect(layer.height).toBe(6)
    expect(layer.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(fake(layer).width).toBe(8)
    expect(fake(layer).contextOptions).toEqual({ willReadFrequently: true })
    expect(hasAnyMark(layer)).toBe(false)
    expect(bitmapLedger.layersCreated).toBe(1)
  })

  it('copies into a new layer with a new id; painting the copy leaves the source unchanged', () => {
    const source = createLayer({ width: 4, height: 4 })
    setPixel(fake(source), 1, 1, [255, 0, 0, 255])
    const copy = copyLayer(source)
    expect(copy.id).not.toBe(source.id)
    expect(getPixel(fake(copy), 1, 1)).toEqual([255, 0, 0, 255])
    setPixel(fake(copy), 2, 2, [0, 255, 0, 255])
    expect(getPixel(fake(source), 2, 2)).toEqual([0, 0, 0, 0])
    expect(bitmapLedger.layersCreated).toBe(2)
  })

  it('releases to 0×0 once, counted once', () => {
    const layer = createLayer({ width: 4, height: 4 })
    releaseLayer(layer)
    expect(fake(layer).width).toBe(0)
    expect(fake(layer).height).toBe(0)
    releaseLayer(layer)
    expect(bitmapLedger.layersReleased).toBe(1)
  })

  it('reads a released layer as empty, allocating nothing', () => {
    const layer = createLayer({ width: 4, height: 4 })
    setPixel(fake(layer), 1, 1, [0, 0, 0, 255])
    releaseLayer(layer)
    fake(layer).calls.length = 0
    expect(readRect(layer, { x: 0, y: 0, width: 4, height: 4 })).toBeNull()
    expect(hasAnyMark(layer)).toBe(false)
    expect(fake(layer).calls.filter((c) => c[0] === 'getImageData')).toEqual([])
  })

  it('a new layer is blank until its context is taken to draw; a copy is not', () => {
    const layer = createLayer({ width: 4, height: 4 })
    expect(isBlankLayer(layer)).toBe(true)
    readRect(layer, { x: 0, y: 0, width: 4, height: 4 }) // a read keeps it blank
    expect(isBlankLayer(layer)).toBe(true)
    expect(isBlankLayer(copyLayer(layer))).toBe(false)
    layerContext(layer)
    expect(isBlankLayer(layer)).toBe(false)
  })

  it('resets the layer counters with the ledger', () => {
    releaseLayer(createLayer({ width: 2, height: 2 }))
    resetBitmapLedger()
    expect(bitmapLedger.layersCreated).toBe(0)
    expect(bitmapLedger.layersReleased).toBe(0)
  })

  it('finds a mark with any alpha, and none on a transparent layer', () => {
    const layer = createLayer({ width: 5, height: 5 })
    setPixel(fake(layer), 4, 4, [0, 0, 0, 1])
    expect(hasAnyMark(layer)).toBe(true)
  })

  describe('readRect', () => {
    it('reads a rectangle inside the layer', () => {
      const layer = createLayer({ width: 6, height: 6 })
      setPixel(fake(layer), 2, 3, [1, 2, 3, 4])
      const image = readRect(layer, { x: 2, y: 3, width: 2, height: 1 })!
      expect(image.width).toBe(2)
      expect([...image.data.subarray(0, 4)]).toEqual([1, 2, 3, 4])
    })

    it('clamps a rectangle partly outside the layer, rounding outwards to whole pixels', () => {
      const layer = createLayer({ width: 6, height: 6 })
      expect(readRect(layer, { x: -3.5, y: 4.2, width: 5, height: 10 })).toMatchObject({
        width: 2,
        height: 2,
      })
    })

    it('returns null for a rectangle wholly outside or empty, never throws', () => {
      const layer = createLayer({ width: 6, height: 6 })
      expect(readRect(layer, { x: 10, y: 0, width: 5, height: 5 })).toBeNull()
      expect(readRect(layer, { x: 1, y: 1, width: 0, height: 3 })).toBeNull()
    })
  })
})
