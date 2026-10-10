import type { CropRect } from '../geometry'
import type { Point, View } from './view'

/**
 * A canvas point (device pixels) to the Crop's frame (draw ADR-0002): the inverse of the View for
 * one point, `crop.origin + (point − round(pan)) / zoom`, with the pan rounded as the View draws it.
 */
export function deviceToFrame(view: View, crop: Pick<CropRect, 'x' | 'y'>, point: Point): Point {
  return {
    x: crop.x + (point.x - Math.round(view.panX)) / view.zoom,
    y: crop.y + (point.y - Math.round(view.panY)) / view.zoom,
  }
}
