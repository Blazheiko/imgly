import type { DrawingLayer, Size } from '@/core'
import { bitmapLedger, newId } from '@/shared'

/** A Drawing layer as the browser holds it: an `OffscreenCanvas` of the Original's size. */
export type Layer = DrawingLayer<OffscreenCanvas>

/** Makes a layer's canvas; injectable because happy-dom has no Canvas 2D. */
export type CanvasFactory = (width: number, height: number) => OffscreenCanvas

/** A rectangle on the Original's pixel grid, possibly fractional or partly outside the layer. */
export interface LayerRect {
  x: number
  y: number
  width: number
  height: number
}

let canvasFactory: CanvasFactory = (width, height) => new OffscreenCanvas(width, height)

/** Swaps the canvas factory and returns the previous one, so a test can restore it. */
export function setLayerCanvasFactory(next: CanvasFactory): CanvasFactory {
  const previous = canvasFactory
  canvasFactory = next
  return previous
}

const released = new WeakSet<OffscreenCanvas>()

/** The layer's 2D context. The first call (in `createLayer`) fixes `willReadFrequently`. */
export function layerContext(layer: Layer): OffscreenCanvasRenderingContext2D {
  return layer.pixels.getContext('2d', { willReadFrequently: true })!
}

/** A new, fully transparent layer of `size` with a new id, counted in the ledger. */
export function createLayer(size: Size): Layer {
  const pixels = canvasFactory(size.width, size.height)
  const layer: Layer = { id: newId(), width: size.width, height: size.height, pixels }
  layerContext(layer)
  bitmapLedger.noteLayerCreated()
  return layer
}

/** A new layer with the same marks and a new id; the source is never changed (ADR-0004). */
export function copyLayer(source: Layer): Layer {
  const copy = createLayer(source)
  layerContext(copy).drawImage(source.pixels, 0, 0)
  return copy
}

/**
 * Frees the layer's backing store at once by sizing its canvas to 0×0, rather than waiting for
 * the garbage collector, and counts it. A second release is a no-op.
 */
export function releaseLayer(layer: Layer): void {
  if (released.has(layer.pixels)) return
  released.add(layer.pixels)
  layer.pixels.width = 0
  layer.pixels.height = 0
  bitmapLedger.noteLayerReleased()
}

/** The layer's pixels under `rect`, widened to whole pixels and clamped to the layer; null if empty. */
export function readRect(layer: Layer, rect: LayerRect): ImageData | null {
  const x0 = Math.max(0, Math.floor(rect.x))
  const y0 = Math.max(0, Math.floor(rect.y))
  const x1 = Math.min(layer.width, Math.ceil(rect.x + rect.width))
  const y1 = Math.min(layer.height, Math.ceil(rect.y + rect.height))
  if (x1 <= x0 || y1 <= y0) return null
  return layerContext(layer).getImageData(x0, y0, x1 - x0, y1 - y0)
}

/** Whether any pixel of the layer has some alpha. */
export function hasAnyMark(layer: Layer): boolean {
  const image = readRect(layer, { x: 0, y: 0, width: layer.width, height: layer.height })
  if (!image) return false
  const { data } = image
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true
  return false
}
