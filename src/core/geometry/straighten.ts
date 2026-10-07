import { fitRectInside, centreRect } from './crop'
import { turnedSize, type Geometry, type Size } from './types'

/** The Straighten angle's range in tenths of a degree (AC-05). */
export const STRAIGHTEN_LIMIT = 450

/**
 * Sets the Straighten angle (AC-05). The image turns around the frame's centre: the stored angle
 * turns the image around its own centre, so the frame's centre is moved to where the same image
 * content lands under the new angle. Then the frame shrinks to fit (AC-06).
 */
export function setStraighten(g: Geometry, tenths: number, original: Size): Geometry {
  const angle = Math.min(STRAIGHTEN_LIMIT, Math.max(-STRAIGHTEN_LIMIT, Math.round(tenths))) || 0
  if (angle === g.straighten) return g

  const { width, height } = turnedSize(g, original)
  const turn = ((angle - g.straighten) / 10) * (Math.PI / 180)
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  const dx = g.crop.x + g.crop.width / 2 - width / 2
  const dy = g.crop.y + g.crop.height / 2 - height / 2
  const cx = width / 2 + dx * cos - dy * sin
  const cy = height / 2 + dx * sin + dy * cos

  return fitCropInside(
    { ...g, straighten: angle, crop: centreRect(cx, cy, g.crop.width, g.crop.height) },
    original,
  )
}

/**
 * Shrinks the frame around its centre, keeping its proportion, to the largest whole-pixel frame
 * inside the turned image; a centre outside it moves to the nearest point inside. Never grows the
 * frame, so moving the angle back towards 0° leaves it as it is (AC-06).
 */
export function fitCropInside(g: Geometry, original: Size): Geometry {
  const crop = fitRectInside(g.crop, g, original)
  const same =
    crop.x === g.crop.x &&
    crop.y === g.crop.y &&
    crop.width === g.crop.width &&
    crop.height === g.crop.height
  return same ? g : { ...g, crop }
}
