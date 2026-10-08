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

/** Rounds to the nearest integer, an exact half down: the left/top edge rule of AC-02. */
const roundHalfDown = (v: number) => Math.ceil(v - 0.5 - EPS) + 0 // + 0 turns −0 into 0

/** `value × num / den` rounded to the nearest whole number, an exact half up (AC-08, AC-09). */
export function scaleHalfUp(value: number, num: number, den: number): number {
  return Math.floor((2 * value * num + den) / (2 * den))
}

/**
 * A `width`×`height` rect centred on (cx, cy) in whole pixels; when that leaves an odd pixel the
 * left and top edges round down, so it goes right and down (AC-02).
 */
export function centreRect(cx: number, cy: number, width: number, height: number): CropRect {
  return { x: roundHalfDown(cx - width / 2), y: roundHalfDown(cy - height / 2), width, height }
}

/**
 * Whole-pixel positions of a `w`×`h` rect centred on (cx, cy): the AC-02 one first, then the
 * neighbouring pixel on each axis where the centre falls between pixels.
 */
function placements(cx: number, cy: number, w: number, h: number): CropRect[] {
  const first = centreRect(cx, cy, w, h)
  const other = (at: number, exact: number) => (exact === at ? at : exact > at ? at + 1 : at - 1)
  const x1 = other(first.x, cx - w / 2)
  const y1 = other(first.y, cy - h / 2)
  return [first, { ...first, y: y1 }, { ...first, x: x1 }, { ...first, x: x1, y: y1 }]
}

/**
 * A whole-pixel `w`×`h` rect inside the turned image, centred on (cx, cy) or, when it does not
 * fit there, on the nearest centre where it does (AC-09); null when it fits nowhere.
 */
export function placeNear(
  cx: number,
  cy: number,
  w: number,
  h: number,
  g: Geometry,
  original: Size,
): CropRect | null {
  const f = turnedFrame(g, original)
  const ac = Math.abs(f.u.x)
  const as = Math.abs(f.u.y)
  // The centres where the rect fits form a box along the image's own axes.
  const roomU = f.hw - (w / 2) * ac - (h / 2) * as
  const roomV = f.hh - (w / 2) * as - (h / 2) * ac
  if (roomU < -EPS || roomV < -EPS) return null
  const clamp = (t: number, room: number) => Math.min(room, Math.max(-room, t))
  const d = { x: cx - f.c.x, y: cy - f.c.y }
  const du = clamp(dot(d, f.u), Math.max(0, roomU))
  const dv = clamp(dot(d, f.v), Math.max(0, roomV))
  const px = f.c.x + du * f.u.x + dv * f.v.x
  const py = f.c.y + du * f.u.y + dv * f.v.y
  return placements(px, py, w, h).find((r) => isInsideTurned(r, g, original)) ?? null
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
  // Room a 1×1 frame needs around its centre along each image axis, after whole-pixel placement.
  const margin = ac + as
  const d = { x: rect.x + a - f.c.x, y: rect.y + b - f.c.y }
  const clampAxis = (t: number, half: number) => {
    const room = Math.max(0, half - margin)
    return Math.min(room, Math.max(-room, t))
  }
  const du = clampAxis(dot(d, f.u), f.hw)
  const dv = clampAxis(dot(d, f.v), f.hh)
  const cx = f.c.x + du * f.u.x + dv * f.v.x
  const cy = f.c.y + du * f.u.y + dv * f.v.y

  const k = Math.min(
    1,
    (f.hw - Math.abs(du)) / (a * ac + b * as),
    (f.hh - Math.abs(dv)) / (a * as + b * ac),
  )
  // The long side rounds down and is the input; the short side follows it, half up, so the
  // proportion holds within 0.5 px (AC-06, AC-08). Whole-pixel placement can shift the frame by up
  // to half a pixel, so shrink a pixel at a time until it fits.
  const landscape = rect.width >= rect.height
  const longIn = landscape ? rect.width : rect.height
  const shortIn = landscape ? rect.height : rect.width
  for (let long = Math.max(1, Math.floor(longIn * k + EPS)); ; long--) {
    const short = Math.max(1, scaleHalfUp(long, shortIn, longIn))
    const [w, h] = landscape ? [long, short] : [short, long]
    const fit = placements(cx, cy, w, h).find((r) => isInsideTurned(r, g, original))
    if (fit) return fit
    if (long === 1) return centreRect(cx, cy, w, h)
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
