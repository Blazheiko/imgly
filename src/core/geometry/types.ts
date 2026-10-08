import type { Size } from '../view'

export type { Size }

/** A quarter-turn Rotation, clockwise, in degrees. */
export type Rotation = 0 | 90 | 180 | 270

/**
 * An axis-aligned rectangle in whole pixels of the turned image (the Original after its Flip,
 * Rotation and Straighten angle). With a Straighten angle, `x` or `y` can be negative.
 */
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The Work's Geometry (feature ADR-0001), applied in this order: Flip, Rotation, Straighten angle,
 * Crop. Every field is an integer (or a boolean), so two Geometries compare exactly (AC-13).
 */
export interface Geometry {
  flipH: boolean
  flipV: boolean
  rotation: Rotation
  /** Integer tenths of a degree, −450…450; positive turns the image clockwise. */
  straighten: number
  crop: CropRect
}

/** No Flip, no Rotation, no Straighten angle, and a Crop covering the whole Original. */
export function identityGeometry(original: Size): Geometry {
  return {
    flipH: false,
    flipV: false,
    rotation: 0,
    straighten: 0,
    crop: { x: 0, y: 0, width: original.width, height: original.height },
  }
}

/** The image after its Flip and Rotation: the Original's size, swapped at 90° and 270°. */
export function turnedSize(g: Pick<Geometry, 'rotation'>, original: Size): Size {
  return g.rotation === 90 || g.rotation === 270
    ? { width: original.height, height: original.width }
    : { width: original.width, height: original.height }
}
