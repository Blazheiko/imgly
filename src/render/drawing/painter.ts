import {
  dotSegment,
  frameToOriginal,
  segmentBounds,
  type DrawMode,
  type Geometry,
  type Point,
  type Rect,
  type Segment,
} from '@/core'
import { layerContext, type Layer } from './layer'

/** What a Stroke paints with, read once at its start (AC-18). */
export interface BrushStyle {
  mode: DrawMode
  /** `#RRGGBB`, fully opaque. */
  colour: string
  /** In image pixels, the same in the Crop's frame and on the Original. */
  width: number
}

/**
 * Paints one piece of a Stroke into the layer (ADR-0002): in the Crop's frame under
 * `setTransform(frameToOriginal)`, clipped to the Crop, with round caps — `source-over` for the
 * Brush, `destination-out` for the Eraser, so only the layer ever changes (AC-04, AC-07, AC-09).
 * Returns the dirty rectangle on the Original's grid.
 */
export function paintSegment(layer: Layer, s: Segment, style: BrushStyle, g: Geometry): Rect {
  const ctx = begin(layer, style, g)
  ctx.beginPath()
  ctx.moveTo(s.p0.x, s.p0.y)
  ctx.bezierCurveTo(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.p1.x, s.p1.y)
  ctx.lineWidth = style.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = style.colour
  ctx.stroke()
  ctx.restore()
  return segmentDirtyRect(layer, s, style.width, g)
}

/** Paints a press without movement: one round dot of the width, clipped to the Crop (AC-01, AC-04). */
export function paintDot(layer: Layer, p: Point, style: BrushStyle, g: Geometry): Rect {
  const ctx = begin(layer, style, g)
  ctx.beginPath()
  ctx.arc(p.x, p.y, style.width / 2, 0, Math.PI * 2)
  ctx.fillStyle = style.colour
  ctx.fill()
  ctx.restore()
  return segmentDirtyRect(layer, dotSegment(p), style.width, g)
}

function begin(layer: Layer, style: BrushStyle, g: Geometry): OffscreenCanvasRenderingContext2D {
  const ctx = layerContext(layer)
  ctx.save()
  ctx.setTransform(...frameToOriginal(g, layer))
  ctx.beginPath()
  ctx.rect(g.crop.x, g.crop.y, g.crop.width, g.crop.height)
  ctx.clip()
  ctx.globalCompositeOperation = style.mode === 'eraser' ? 'destination-out' : 'source-over'
  return ctx
}

/**
 * What painting `s` may change: its bounds mapped onto the Original's grid, widened to whole
 * pixels and clamped to the layer. Known before painting, so a caller can read it first.
 */
export function segmentDirtyRect(layer: Layer, s: Segment, width: number, g: Geometry): Rect {
  const b = segmentBounds(s, width)
  const [a, bb, c, d, e, f] = frameToOriginal(g, layer)
  const corners = [
    [b.x, b.y],
    [b.x + b.width, b.y],
    [b.x, b.y + b.height],
    [b.x + b.width, b.y + b.height],
  ].map(([x, y]) => [a * x! + c * y! + e, bb * x! + d * y! + f] as const)
  const xs = corners.map(([x]) => x)
  const ys = corners.map(([, y]) => y)
  const x0 = Math.max(0, Math.floor(Math.min(...xs)))
  const y0 = Math.max(0, Math.floor(Math.min(...ys)))
  const x1 = Math.min(layer.width, Math.ceil(Math.max(...xs)))
  const y1 = Math.min(layer.height, Math.ceil(Math.max(...ys)))
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) }
}

const isEmpty = (r: Rect) => r.width <= 0 || r.height <= 0

/** The smallest rectangle holding both; an empty or missing one adds nothing. */
export function unionRect(a: Rect | null, b: Rect): Rect {
  if (!a || isEmpty(a)) return b
  if (isEmpty(b)) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

/** Whether any pixel's alpha went down between two reads of the same rectangle (sad.md §4). */
export function alphaLowered(before: ImageData, after: ImageData): boolean {
  const a = before.data
  const b = after.data
  for (let i = 3; i < a.length; i += 4) if (b[i]! < a[i]!) return true
  return false
}
