import { fitRectInside } from './crop'
import { turnedSize, type Geometry, type Size } from './types'

/** The Straighten angle's range in tenths of a degree (AC-05). */
export const STRAIGHTEN_LIMIT = 450

/**
 * What one slider or keyboard interaction with the angle keeps (AC-05, AC-06, AC-08): the frame's
 * centre on the image, unturned and unrounded, and the proportion the frame keeps. Every step is
 * derived from it, so whole-pixel rounding never builds up over many small steps.
 */
export interface StraightenAnchor {
  /** The frame's centre on the turned image before any Straighten angle, unrounded. */
  cx: number
  cy: number
  /** The width:height the frame keeps: a locked proportion, or the frame's own at the start. */
  ratio: Size
}

/**
 * The anchor for an interaction starting at `g`. It keeps the locked `ratio` only when the frame
 * already has it, within half a pixel (AC-08); otherwise the frame keeps its own (AC-06).
 */
export function straightenAnchor(
  g: Geometry,
  original: Size,
  ratio: Size | null = null,
): StraightenAnchor {
  const { x, y } = turnAroundImageCentre(
    g.crop.x + g.crop.width / 2,
    g.crop.y + g.crop.height / 2,
    -g.straighten,
    turnedSize(g, original),
  )
  const own = { width: g.crop.width, height: g.crop.height }
  return { cx: x, cy: y, ratio: ratio && hasRatio(own, ratio) ? ratio : own }
}

/** Whether a whole-pixel frame has `ratio`, its short side within half a pixel of exact. */
function hasRatio(frame: Size, ratio: Size): boolean {
  return frame.width >= frame.height
    ? Math.abs(frame.height - (frame.width * ratio.height) / ratio.width) <= 0.5
    : Math.abs(frame.width - (frame.height * ratio.width) / ratio.height) <= 0.5
}

/** A point of the turned image moved by `tenths` of a degree around the image's centre. */
function turnAroundImageCentre(x: number, y: number, tenths: number, size: Size) {
  const a = (tenths / 10) * (Math.PI / 180)
  const dx = x - size.width / 2
  const dy = y - size.height / 2
  return {
    x: size.width / 2 + dx * Math.cos(a) - dy * Math.sin(a),
    y: size.height / 2 + dx * Math.sin(a) + dy * Math.cos(a),
  }
}

/**
 * Sets the Straighten angle (AC-05). The image turns around the frame's centre: the stored angle
 * turns the image around its own centre, so the frame's centre is moved to where the anchor's
 * image content lands under the new angle. Then the frame shrinks to fit, keeping the anchor's
 * proportion (AC-06, AC-08). Without an anchor the step starts from `g` alone.
 */
export function setStraighten(
  g: Geometry,
  tenths: number,
  original: Size,
  anchor: StraightenAnchor = straightenAnchor(g, original),
): Geometry {
  const angle = Math.min(STRAIGHTEN_LIMIT, Math.max(-STRAIGHTEN_LIMIT, Math.round(tenths))) || 0
  if (angle === g.straighten) return g

  const { x: cx, y: cy } = turnAroundImageCentre(
    anchor.cx,
    anchor.cy,
    angle,
    turnedSize(g, original),
  )
  // The frame's long side, with its short side at the anchor's exact proportion, unrounded:
  // fitRectInside rounds only the result and never grows it.
  const { ratio } = anchor
  const landscape = ratio.width >= ratio.height
  const long = Math.max(g.crop.width, g.crop.height)
  const width = landscape ? long : (long * ratio.width) / ratio.height
  const height = landscape ? (long * ratio.height) / ratio.width : long
  const rect = { x: cx - width / 2, y: cy - height / 2, width, height }
  const next = { ...g, straighten: angle }
  return { ...next, crop: fitRectInside(rect, next, original) }
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
