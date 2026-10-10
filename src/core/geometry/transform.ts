import { turnedSize, type CropRect, type Geometry, type Size } from './types'

/** A column-major 3×3 matrix as 9 plain numbers, the layout `uniformMatrix3fv` takes. */
export type Mat3 = [number, number, number, number, number, number, number, number, number]

/** Row-major 3×3, easier to compose by hand. */
type Rows = [[number, number, number], [number, number, number], [number, number, number]]

const multiply = (a: Rows, b: Rows): Rows => {
  const cell = (i: 0 | 1 | 2, j: 0 | 1 | 2) =>
    a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]
  return [
    [cell(0, 0), cell(0, 1), cell(0, 2)],
    [cell(1, 0), cell(1, 1), cell(1, 2)],
    [cell(2, 0), cell(2, 1), cell(2, 2)],
  ]
}

const toColumnMajor = (m: Rows): Mat3 => [
  m[0][0],
  m[1][0],
  m[2][0],
  m[0][1],
  m[1][1],
  m[2][1],
  m[0][2],
  m[1][2],
  m[2][2],
]

const affine = (a: number, b: number, c: number, d: number, e: number, f: number): Rows => [
  [a, b, c],
  [d, e, f],
  [0, 0, 1],
]

/**
 * From a point of the Crop's frame (the image after Flip, Rotation and Straighten angle) to an
 * Original pixel, undoing the steps in reverse order. Every step keeps lengths.
 */
function frameToOriginalPx(g: Geometry, original: Size): Rows {
  const { width: W, height: H } = turnedSize(g, original)
  const W0 = original.width
  const H0 = original.height
  // Undo the Straighten angle: turn back (counter-clockwise) around the turned image's centre.
  const a = (g.straighten / 10) * (Math.PI / 180)
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const unStraighten = multiply(
    affine(1, 0, W / 2, 0, 1, H / 2),
    multiply(affine(cos, sin, 0, -sin, cos, 0), affine(1, 0, -W / 2, 0, 1, -H / 2)),
  )
  // Undo the clockwise Rotation: turned (x, y) → flipped Original (fx, fy).
  const unRotate = {
    0: affine(1, 0, 0, 0, 1, 0),
    90: affine(0, 1, 0, -1, 0, H0),
    180: affine(-1, 0, W0, 0, -1, H0),
    270: affine(0, -1, W0, 1, 0, 0),
  }[g.rotation]
  // Undo the Flip, then scale Original pixels to texture coordinates.
  const unFlip = affine(
    g.flipH ? -1 : 1,
    0,
    g.flipH ? W0 : 0,
    0,
    g.flipV ? -1 : 1,
    g.flipV ? H0 : 0,
  )
  return multiply(unFlip, multiply(unRotate, unStraighten))
}

/** `frameToOriginalPx` scaled to an Original texture coordinate (0…1, v down). */
function frameToOriginalUv(g: Geometry, original: Size): Rows {
  const toUv = affine(1 / original.width, 0, 0, 0, 1 / original.height, 0)
  return multiply(toUv, frameToOriginalPx(g, original))
}

/** A Canvas 2D transform `[a, b, c, d, e, f]`, the argument order of `ctx.setTransform`. */
export type CanvasTransform = [number, number, number, number, number, number]

/**
 * The pixel-unit form of the frame step `cropToOriginalUv` composes (draw ADR-0002): a point of
 * the Crop's frame to the Original pixel under it, ready for `ctx.setTransform`. Quarter turns and
 * Flips give exact integers, so the layer follows the image through every round trip (AC-08).
 */
export function frameToOriginal(g: Geometry, original: Size): CanvasTransform {
  const m = frameToOriginalPx(g, original)
  // `+ 0` turns a −0 from sin(0) into 0.
  return [m[0][0] + 0, m[1][0] + 0, m[0][1] + 0, m[1][1] + 0, m[0][2] + 0, m[1][2] + 0]
}

/** The unit quad (0…1 over `rect`, v down) → the rect's pixels in the Crop's frame. */
const quadOver = (rect: CropRect): Rows => affine(rect.width, 0, rect.x, 0, rect.height, rect.y)

/**
 * The one transform every renderer uses (ADR-0001): a unit-quad point over the Crop to the
 * Original texture coordinate it shows. An output pixel centre lands on a texel centre for any
 * Rotation and Flip.
 */
export function cropToOriginalUv(g: Geometry, original: Size): Mat3 {
  return toColumnMajor(multiply(frameToOriginalUv(g, original), quadOver(g.crop)))
}

/**
 * The axis-aligned box around the whole turned image in the Crop's frame: the turned image at the
 * origin without a Straighten angle, larger and fractional with one.
 */
export function turnedBounds(g: Geometry, original: Size): CropRect {
  const { width, height } = turnedSize(g, original)
  if (g.straighten === 0) return { x: 0, y: 0, width, height }
  const a = (g.straighten / 10) * (Math.PI / 180)
  const ex = (width / 2) * Math.abs(Math.cos(a)) + (height / 2) * Math.abs(Math.sin(a))
  const ey = (width / 2) * Math.abs(Math.sin(a)) + (height / 2) * Math.abs(Math.cos(a))
  return { x: width / 2 - ex, y: height / 2 - ey, width: 2 * ex, height: 2 * ey }
}

/**
 * `cropToOriginalUv` over `turnedBounds` instead of the Crop: what the tool shows (ADR-0003). Its
 * corners outside the turned image map outside 0…1 and render transparent.
 */
export function turnedImageToOriginalUv(g: Geometry, original: Size): Mat3 {
  return toColumnMajor(
    multiply(frameToOriginalUv(g, original), quadOver(turnedBounds(g, original))),
  )
}
