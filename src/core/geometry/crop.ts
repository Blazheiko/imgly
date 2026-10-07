import { turnedSize, type CropRect, type Geometry, type Size } from './types'

/** An edge or a corner of the crop frame, by compass direction. */
export type CropHandle = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface Point {
  x: number
  y: number
}

/**
 * The turned image as a rotated rectangle in the Crop's frame: centre `c`, unit axes `u` (its
 * width) and `v` (its height), half sizes `hw` and `hh`. Positive Straighten turns clockwise on a
 * y-down screen.
 */
interface TurnedFrame {
  c: Point
  u: Point
  v: Point
  hw: number
  hh: number
}

/** Rounding slack for the rotated-rectangle tests; far below a pixel. */
const EPS = 1e-6

function turnedFrame(g: Geometry, original: Size): TurnedFrame {
  const { width, height } = turnedSize(g, original)
  const a = (g.straighten / 10) * (Math.PI / 180)
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return {
    c: { x: width / 2, y: height / 2 },
    u: { x: cos, y: sin },
    v: { x: -sin, y: cos },
    hw: width / 2,
    hh: height / 2,
  }
}

const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y

function corners(r: CropRect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x, y: r.y + r.height },
    { x: r.x + r.width, y: r.y + r.height },
  ]
}

/** The two corners of one side of `r`. */
function edge(r: CropRect, side: 'n' | 'e' | 's' | 'w'): Point[] {
  const [tl, tr, bl, br] = corners(r) as [Point, Point, Point, Point]
  return { n: [tl, tr], e: [tr, br], s: [bl, br], w: [tl, bl] }[side]
}

/** The four half-planes of the turned image as `n · (p − c) ≤ half`. */
function halfPlanes(f: TurnedFrame): { n: Point; half: number }[] {
  const neg = (p: Point) => ({ x: -p.x, y: -p.y })
  return [
    { n: f.u, half: f.hw },
    { n: neg(f.u), half: f.hw },
    { n: f.v, half: f.hh },
    { n: neg(f.v), half: f.hh },
  ]
}

function pointInside(p: Point, f: TurnedFrame): boolean {
  const d = { x: p.x - f.c.x, y: p.y - f.c.y }
  return Math.abs(dot(d, f.u)) <= f.hw + EPS && Math.abs(dot(d, f.v)) <= f.hh + EPS
}

/** Whether `rect` lies fully inside the turned image (a rotated rectangle with an angle). */
export function isInsideTurned(rect: CropRect, g: Geometry, original: Size): boolean {
  const f = turnedFrame(g, original)
  return corners(rect).every((p) => pointInside(p, f))
}

/**
 * The largest whole-pixel shift, towards `delta` and at most `|delta|`, that keeps every point of
 * `moving` inside the turned image. 0 when the first pixel would already leave it.
 */
function maxShift(moving: Point[], axis: 'x' | 'y', delta: number, f: TurnedFrame): number {
  const steps = Math.abs(delta)
  if (steps === 0) return 0
  const sign = Math.sign(delta)
  const e = axis === 'x' ? { x: sign, y: 0 } : { x: 0, y: sign }
  let limit = steps
  for (const p of moving) {
    const d = { x: p.x - f.c.x, y: p.y - f.c.y }
    for (const { n, half } of halfPlanes(f)) {
      const rate = dot(n, e)
      if (rate > 1e-12) limit = Math.min(limit, (half - dot(n, d)) / rate)
    }
  }
  return sign * Math.max(0, Math.floor(limit + EPS))
}

/** A `width`×`height` rect centred on (cx, cy); an odd pixel goes right and down (AC-02). */
export function centreRect(cx: number, cy: number, width: number, height: number): CropRect {
  return {
    x: Math.floor(cx - width / 2 + EPS),
    y: Math.floor(cy - height / 2 + EPS),
    width,
    height,
  }
}

/**
 * The largest whole-pixel rect of `rect`'s proportion, never larger than it, centred on its
 * centre and inside the turned image. A centre outside the turned image first moves to the nearest
 * point inside it (AC-06; also the fallback of `clampCrop` under a Straighten angle).
 */
export function fitRectInside(rect: CropRect, g: Geometry, original: Size): CropRect {
  const f = turnedFrame(g, original)
  const a = rect.width / 2
  const b = rect.height / 2
  const ac = Math.abs(f.u.x)
  const as = Math.abs(f.u.y)
  // Room a 1×1 frame needs around its centre, along each image axis.
  const margin = 0.5 * (ac + as)
  const d = { x: rect.x + a - f.c.x, y: rect.y + b - f.c.y }
  const clampAxis = (t: number, half: number) => {
    const room = Math.max(0, half - margin)
    return Math.min(room, Math.max(-room, t))
  }
  const du = clampAxis(dot(d, f.u), f.hw)
  const dv = clampAxis(dot(d, f.v), f.hh)
  const cx = f.c.x + du * f.u.x + dv * f.v.x
  const cy = f.c.y + du * f.u.y + dv * f.v.y

  let k = Math.min(
    1,
    (f.hw - Math.abs(du)) / (a * ac + b * as),
    (f.hh - Math.abs(dv)) / (a * as + b * ac),
  )
  // Whole-pixel placement can shift the frame by up to half a pixel; shrink by a pixel until it fits.
  const step = 1 / Math.max(rect.width, rect.height)
  for (;;) {
    const w = Math.max(1, Math.floor(rect.width * k + EPS))
    const h = Math.max(1, Math.floor(rect.height * k + EPS))
    const r = centreRect(cx, cy, w, h)
    if (isInsideTurned(r, g, original) || (w === 1 && h === 1)) return r
    k -= step
  }
}

/** The Crop in whole pixels, at least 1×1 and inside the turned image (AC-02). */
export function clampCrop(g: Geometry, original: Size): Geometry {
  const rounded = {
    x: Math.round(g.crop.x),
    y: Math.round(g.crop.y),
    width: Math.max(1, Math.round(g.crop.width)),
    height: Math.max(1, Math.round(g.crop.height)),
  }
  if (isInsideTurned(rounded, g, original)) {
    return sameCrop(g.crop, rounded) ? g : { ...g, crop: rounded }
  }
  if (g.straighten !== 0) return { ...g, crop: fitRectInside(rounded, g, original) }
  const { width, height } = turnedSize(g, original)
  const w = Math.min(rounded.width, width)
  const h = Math.min(rounded.height, height)
  return {
    ...g,
    crop: {
      x: Math.min(Math.max(rounded.x, 0), width - w),
      y: Math.min(Math.max(rounded.y, 0), height - h),
      width: w,
      height: h,
    },
  }
}

function sameCrop(a: CropRect, b: CropRect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

/** Moves the frame by (dx, dy) image pixels; it stops at the edge, each axis on its own. */
export function moveCrop(g: Geometry, dx: number, dy: number, original: Size): Geometry {
  const f = turnedFrame(g, original)
  const rx = Math.round(dx)
  const ry = Math.round(dy)
  const crop = { ...g.crop }
  const sx = maxShift(corners(crop), 'x', rx, f)
  crop.x += sx
  crop.y += maxShift(corners(crop), 'y', ry, f)
  // Slide along an edge that stopped x before y moved (a straightened image's slanted edge).
  crop.x += maxShift(corners(crop), 'x', rx - sx, f)
  return { ...g, crop }
}

/**
 * Moves the edges `handle` names by (dx, dy) image pixels. The opposite edges stay put; a moving
 * edge stops at the edge of the image and 1 px before the opposite edge (AC-02).
 */
export function resizeCrop(
  g: Geometry,
  handle: CropHandle,
  dx: number,
  dy: number,
  original: Size,
): Geometry {
  const f = turnedFrame(g, original)
  const crop = { ...g.crop }
  const rx = Math.round(dx)
  const ry = Math.round(dy)
  if (handle.includes('e')) {
    crop.width += rx > 0 ? maxShift(edge(crop, 'e'), 'x', rx, f) : Math.max(rx, 1 - crop.width)
  } else if (handle.includes('w')) {
    const s = rx < 0 ? maxShift(edge(crop, 'w'), 'x', rx, f) : Math.min(rx, crop.width - 1)
    crop.x += s
    crop.width -= s
  }
  if (handle.includes('s')) {
    crop.height += ry > 0 ? maxShift(edge(crop, 's'), 'y', ry, f) : Math.max(ry, 1 - crop.height)
  } else if (handle.includes('n')) {
    const s = ry < 0 ? maxShift(edge(crop, 'n'), 'y', ry, f) : Math.min(ry, crop.height - 1)
    crop.y += s
    crop.height -= s
  }
  return { ...g, crop }
}
