import type { CropRect } from '../geometry'
import type { Point } from '../view'

/** One cubic Bézier piece of a Stroke, from `p0` to `p1`, in the Crop's frame (image pixels). */
export interface Segment {
  p0: Point
  c1: Point
  c2: Point
  p1: Point
}

/** An axis-aligned rectangle in image pixels (not necessarily whole). */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const EPSILON = 1e-9

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)

/** A press without movement: a zero-length segment, painted as a dot of the width (ADR-0002). */
export function dotSegment(p: Point): Segment {
  return { p0: p, c1: p, c2: p, p1: p }
}

/**
 * The centripetal Catmull–Rom piece (α = 0.5) from `p1` to `p2` with neighbours `p0` and `p3`, as a
 * cubic Bézier. It passes exactly through `p1` and `p2` (ADR-0002); a neighbour equal to its point
 * (the ends of a Stroke) or two identical points give a straighter, still finite piece.
 */
export function catmullRomSegment(p0: Point, p1: Point, p2: Point, p3: Point): Segment {
  const d1 = Math.sqrt(distance(p0, p1))
  const d2 = Math.sqrt(distance(p1, p2))
  const d3 = Math.sqrt(distance(p2, p3))
  if (d2 < EPSILON) return { p0: p1, c1: p1, c2: p2, p1: p2 }

  const c1 =
    d1 < EPSILON
      ? p1
      : {
          x:
            (d1 * d1 * p2.x - d2 * d2 * p0.x + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1.x) /
            (3 * d1 * (d1 + d2)),
          y:
            (d1 * d1 * p2.y - d2 * d2 * p0.y + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1.y) /
            (3 * d1 * (d1 + d2)),
        }
  const c2 =
    d3 < EPSILON
      ? p2
      : {
          x:
            (d3 * d3 * p1.x - d2 * d2 * p3.x + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2.x) /
            (3 * d3 * (d3 + d2)),
          y:
            (d3 * d3 * p1.y - d2 * d2 * p3.y + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2.y) /
            (3 * d3 * (d3 + d2)),
        }
  return { p0: p1, c1, c2, p1: p2 }
}

/** The pieces joining every point in order; each end uses the point itself as its missing neighbour. */
export function catmullRomSegments(points: readonly Point[]): Segment[] {
  const segments: Segment[] = []
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1]!
    const p2 = points[i]!
    segments.push(catmullRomSegment(points[i - 2] ?? p1, p1, p2, points[i + 1] ?? p2))
  }
  return segments
}

/** The segment's dirty rectangle: its control points' bounds plus half the width plus 2 px (ADR-0002). */
export function segmentBounds(s: Segment, width: number): Rect {
  const xs = [s.p0.x, s.c1.x, s.c2.x, s.p1.x]
  const ys = [s.p0.y, s.c1.y, s.c2.y, s.p1.y]
  const pad = width / 2 + 2
  const x = Math.min(...xs) - pad
  const y = Math.min(...ys) - pad
  return { x, y, width: Math.max(...xs) + pad - x, height: Math.max(...ys) + pad - y }
}

/**
 * Whether a Stroke's footprint (its path widened by half the width, with round ends) reaches inside
 * the Crop (AC-09, AC-12): judged geometrically, on the curve flattened to well under a pixel.
 */
export function footprintReachesCrop(
  segments: readonly Segment[],
  width: number,
  crop: CropRect,
): boolean {
  const radius = width / 2
  return segments.some((s) => {
    const b = segmentBounds(s, 0)
    if (
      b.x - radius >= crop.x + crop.width ||
      b.y - radius >= crop.y + crop.height ||
      b.x + b.width + radius <= crop.x ||
      b.y + b.height + radius <= crop.y
    ) {
      return false
    }
    const points = flatten(s)
    if (points.length === 1) return distanceToRect(points[0]!, crop) < radius
    for (let i = 1; i < points.length; i++) {
      if (lineDistanceToRect(points[i - 1]!, points[i]!, crop) < radius) return true
    }
    return false
  })
}

/** The Bézier as a polyline whose chords stay within ~0.05 px of the curve. */
function flatten(s: Segment): Point[] {
  const hull = distance(s.p0, s.c1) + distance(s.c1, s.c2) + distance(s.c2, s.p1)
  if (hull < EPSILON) return [s.p0]
  const steps = Math.min(512, Math.max(1, Math.ceil(Math.sqrt(hull / 0.05))))
  const points: Point[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    const a = u * u * u
    const b = 3 * u * u * t
    const c = 3 * u * t * t
    const d = t * t * t
    points.push({
      x: a * s.p0.x + b * s.c1.x + c * s.c2.x + d * s.p1.x,
      y: a * s.p0.y + b * s.c1.y + c * s.c2.y + d * s.p1.y,
    })
  }
  return points
}

function distanceToRect(p: Point, r: CropRect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width))
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height))
  return Math.hypot(dx, dy)
}

function pointToLine(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const len2 = vx * vx + vy * vy
  const t =
    len2 < EPSILON ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2))
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy))
}

/** The distance from a line piece to a rectangle: 0 when they meet. */
function lineDistanceToRect(a: Point, b: Point, r: CropRect): number {
  if (lineMeetsRect(a, b, r)) return 0
  const corners = [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x, y: r.y + r.height },
    { x: r.x + r.width, y: r.y + r.height },
  ]
  return Math.min(
    distanceToRect(a, r),
    distanceToRect(b, r),
    ...corners.map((c) => pointToLine(c, a, b)),
  )
}

/** Liang–Barsky: whether the piece from `a` to `b` passes through the rectangle. */
function lineMeetsRect(a: Point, b: Point, r: CropRect): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  let t0 = 0
  let t1 = 1
  const edges: [number, number][] = [
    [-dx, a.x - r.x],
    [dx, r.x + r.width - a.x],
    [-dy, a.y - r.y],
    [dy, r.y + r.height - a.y],
  ]
  for (const [p, q] of edges) {
    if (Math.abs(p) < EPSILON) {
      if (q < 0) return false
      continue
    }
    const t = q / p
    if (p < 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
    if (t0 > t1) return false
  }
  return true
}
