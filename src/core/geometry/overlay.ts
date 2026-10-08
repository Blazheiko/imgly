import type { View } from '../view'
import type { CropRect } from './types'

type ViewPlacement = Pick<View, 'zoom' | 'panX' | 'panY'>

/** A rect on the canvas, in device pixels. */
export interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Where the Crop sits on the canvas, in device pixels, when the renderer draws `shown` (the Crop
 * itself, or `turnedBounds` in the tool) with `view`. Pan is snapped to whole device pixels as
 * `viewToTransform` does, so the frame sits on the pixels the shader draws (ADR-0005).
 */
export function cropRectOnScreen(crop: CropRect, shown: CropRect, view: ViewPlacement): ScreenRect {
  return {
    left: Math.round(view.panX) + (crop.x - shown.x) * view.zoom,
    top: Math.round(view.panY) + (crop.y - shown.y) * view.zoom,
    width: crop.width * view.zoom,
    height: crop.height * view.zoom,
  }
}

/** A canvas point in device pixels → a point of the Crop's frame, under the same placement. */
export function screenToImage(
  p: { x: number; y: number },
  shown: CropRect,
  view: ViewPlacement,
): { x: number; y: number } {
  return {
    x: (p.x - Math.round(view.panX)) / view.zoom + shown.x,
    y: (p.y - Math.round(view.panY)) / view.zoom + shown.y,
  }
}

/** A pointer or key move in device pixels → image pixels of the Crop's frame. */
export function screenDeltaToImage(
  dx: number,
  dy: number,
  view: ViewPlacement,
): { dx: number; dy: number } {
  return { dx: dx / view.zoom, dy: dy / view.zoom }
}
