import type { Size, View } from '@/core'

/**
 * The View as one column-major mat3 that maps the unit quad (image u, v ∈ [0,1], v down) to clip
 * space. Pan is snapped to whole device pixels so 100% stays one image pixel per device pixel.
 */
export function viewToTransform(view: View, image: Size, canvas: Size): Float32Array {
  const sx = (2 * image.width * view.zoom) / canvas.width
  const sy = (-2 * image.height * view.zoom) / canvas.height
  const tx = (2 * Math.round(view.panX)) / canvas.width - 1
  const ty = 1 - (2 * Math.round(view.panY)) / canvas.height
  return new Float32Array([sx, 0, 0, 0, sy, 0, tx, ty, 1])
}
