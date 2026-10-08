import { turnedSize, type Geometry, type Rotation, type Size } from './types'

export type TurnDirection = 'cw' | 'ccw'
export type ScreenAxis = 'horizontal' | 'vertical'

/**
 * Turns the image a quarter turn (AC-03). The frame turns with it: the Crop is re-expressed in the
 * new turned image, so the same content stays inside. The Straighten angle turns around the
 * image's centre, which a quarter turn maps onto the new centre, so the angle is unchanged.
 */
export function rotateQuarter(g: Geometry, dir: TurnDirection, original: Size): Geometry {
  const { width, height } = turnedSize(g, original)
  const { x, y, width: w, height: h } = g.crop
  const step = dir === 'cw' ? 90 : 270
  return {
    ...g,
    rotation: ((g.rotation + step) % 360) as Rotation,
    crop:
      dir === 'cw'
        ? { x: height - (y + h), y: x, width: h, height: w }
        : { x: y, y: width - (x + w), width: h, height: w },
  }
}

/**
 * Mirrors the image as it is shown on screen (AC-04). Flip is stored before the Rotation, so at
 * 90° and 270° a screen-horizontal flip is a stored vertical one. The Crop is mirrored in the
 * turned image and the Straighten angle changes sign, so a level horizon stays level.
 */
export function flipOnScreen(g: Geometry, axis: ScreenAxis, original: Size): Geometry {
  const { width, height } = turnedSize(g, original)
  const quarter = g.rotation === 90 || g.rotation === 270
  const storedHorizontal = (axis === 'horizontal') !== quarter
  const { crop } = g
  return {
    ...g,
    flipH: storedHorizontal ? !g.flipH : g.flipH,
    flipV: storedHorizontal ? g.flipV : !g.flipV,
    straighten: g.straighten === 0 ? 0 : -g.straighten,
    crop:
      axis === 'horizontal'
        ? { ...crop, x: width - (crop.x + crop.width) }
        : { ...crop, y: height - (crop.y + crop.height) },
  }
}
