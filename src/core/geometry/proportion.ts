import { centreRect, isInsideTurned, resizeCrop, scaleHalfUp, type CropHandle } from './crop'
import { turnedSize, type CropRect, type Geometry, type Size } from './types'

export type ProportionKind = 'free' | 'original' | '1:1' | '4:3' | '3:2' | '16:9'
export type ProportionOrientation = 'landscape' | 'portrait'

/** The ratio the crop frame is locked to, and which way round (AC-08). */
export interface Proportion {
  kind: ProportionKind
  orientation: ProportionOrientation
}

export const FREE: Proportion = { kind: 'free', orientation: 'landscape' }

const NAMED: Record<Exclude<ProportionKind, 'free' | 'original'>, Size> = {
  '1:1': { width: 1, height: 1 },
  '4:3': { width: 4, height: 3 },
  '3:2': { width: 3, height: 2 },
  '16:9': { width: 16, height: 9 },
}

/**
 * The locked width:height ratio, or null for Free. Original is the image's proportions after its
 * current Rotation (so it follows a later Rotation or Reset); portrait turns any ratio round.
 */
export function ratioOf(p: Proportion, g: Geometry, original: Size): Size | null {
  if (p.kind === 'free') return null
  const base = p.kind === 'original' ? turnedSize(g, original) : NAMED[p.kind]
  return p.orientation === 'portrait'
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height }
}

/**
 * A quarter turn turns a locked proportion with the frame: 4:3 becomes 3:4 (AC-03). Original
 * already follows the Rotation, and Free and 1:1 have no orientation.
 */
export function turnProportion(p: Proportion): Proportion {
  if (p.kind === 'free' || p.kind === 'original' || p.kind === '1:1') return p
  return { ...p, orientation: p.orientation === 'landscape' ? 'portrait' : 'landscape' }
}

/** Which side a typed or dragged length is. */
export type CropSide = 'width' | 'height'

/**
 * The frame's size when `side` is `n` px under `ratio`: the other side is `n` multiplied or divided
 * by the ratio, to the nearest pixel with a half up, and at least 1 (AC-08, AC-09).
 */
export function lockedSize(side: CropSide, n: number, ratio: Size): Size {
  return side === 'width'
    ? { width: n, height: Math.max(1, scaleHalfUp(n, ratio.height, ratio.width)) }
    : { width: Math.max(1, scaleHalfUp(n, ratio.width, ratio.height)), height: n }
}

/**
 * The largest `n` in 1…`hi` for which `fits(n)` gives a rect, by bisection (`fits` grows harder
 * with `n`). `fits(1)` is assumed to succeed; returns its rect when nothing larger does.
 */
export function largestFitting(hi: number, fits: (n: number) => CropRect | null): CropRect | null {
  let best = fits(1)
  if (!best) return null
  let lo = 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    const r = fits(mid)
    if (r) {
      best = r
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  return best
}

/**
 * The largest frame of `p`'s proportion inside the current frame, centred on it (AC-08). The long
 * side is the input and the short side follows it, half up. Free leaves the frame as it is.
 */
export function applyProportion(g: Geometry, p: Proportion, original: Size): Geometry {
  const ratio = ratioOf(p, g, original)
  if (!ratio) return g
  const { x, y, width, height } = g.crop
  const side: CropSide = ratio.width >= ratio.height ? 'width' : 'height'
  const limit = side === 'width' ? width : height
  const size = largestFittingSize(limit, (n) => {
    const s = lockedSize(side, n, ratio)
    return s.width <= width && s.height <= height
  })
  const s = lockedSize(side, size, ratio)
  return { ...g, crop: centreRect(x + width / 2, y + height / 2, s.width, s.height) }
}

function largestFittingSize(hi: number, ok: (n: number) => boolean): number {
  let lo = 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (ok(mid)) lo = mid
    else hi = mid - 1
  }
  return lo
}

/**
 * `resizeCrop` with a locked proportion (AC-08): the dragged side is the input and the other side
 * follows. An edge keeps the opposite edge and centres the other axis; a corner keeps the opposite
 * corner and follows whichever side the pointer pulls further. It stops at the image's edge.
 */
export function resizeCropLocked(
  g: Geometry,
  handle: CropHandle,
  dx: number,
  dy: number,
  p: Proportion,
  original: Size,
): Geometry {
  const ratio = ratioOf(p, g, original)
  if (!ratio) return resizeCrop(g, handle, dx, dy, original)

  const { x, y, width, height } = g.crop
  const east = handle.includes('e')
  const west = handle.includes('w')
  const south = handle.includes('s')
  const north = handle.includes('n')
  const fromX = east ? width + Math.round(dx) : west ? width - Math.round(dx) : null
  const fromY = south ? height + Math.round(dy) : north ? height - Math.round(dy) : null

  let side: CropSide
  let wanted: number
  if (fromX !== null && (fromY === null || fromX * ratio.height >= fromY * ratio.width)) {
    side = 'width'
    wanted = fromX
  } else {
    side = 'height'
    wanted = fromY!
  }

  const place = (n: number): CropRect => {
    const s = lockedSize(side, n, ratio)
    const centred = centreRect(x + width / 2, y + height / 2, s.width, s.height)
    return {
      x: east ? x : west ? x + width - s.width : centred.x,
      y: south ? y : north ? y + height - s.height : centred.y,
      width: s.width,
      height: s.height,
    }
  }
  const fits = (n: number) => {
    const r = place(n)
    return isInsideTurned(r, g, original) ? r : null
  }
  const crop = largestFitting(Math.max(1, wanted), fits) ?? g.crop
  return { ...g, crop }
}
