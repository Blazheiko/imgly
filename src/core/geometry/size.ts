import { placeNear } from './crop'
import { largestFitting, lockedSize, ratioOf, type CropSide, type Proportion } from './proportion'
import { turnedSize, type Geometry, type Size } from './types'

/**
 * Sets the frame's width or height to a typed `px` (AC-09, AC-10). The frame resizes around its
 * centre and moves only as far as it must to stay inside. With a proportion locked the typed side
 * is the input and the other follows; with Free the other side stays. A value larger than fits
 * becomes the largest that fits at the current Straighten angle.
 */
export function setCropSize(
  g: Geometry,
  side: CropSide,
  px: number,
  p: Proportion,
  original: Size,
): Geometry {
  const ratio = ratioOf(p, g, original)
  const { x, y, width, height } = g.crop
  const size = (n: number): Size =>
    ratio
      ? lockedSize(side, n, ratio)
      : side === 'width'
        ? { width: n, height }
        : { width, height: n }
  const fits = (n: number) => {
    const s = size(n)
    return placeNear(x + width / 2, y + height / 2, s.width, s.height, g, original)
  }
  // No side of a frame inside the turned image is longer than its diagonal.
  const t = turnedSize(g, original)
  const bound = Math.ceil(Math.hypot(t.width, t.height))
  const crop = largestFitting(Math.max(1, Math.min(Math.round(px), bound)), fits)
  return crop ? { ...g, crop } : g
}
