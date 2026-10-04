import type { ExifOrientation } from '@/core'

/** A 2D canvas transform `[a, b, c, d, e, f]` as `setTransform`/`transform` take it. */
export type CanvasMatrix = readonly [number, number, number, number, number, number]

/**
 * How to draw a stored `width × height` image upright for its EXIF orientation: the canvas
 * transform and the upright size (sides swap for 5–8). Used only where the browser doesn't
 * apply orientation itself (feature ADR 0001 probe).
 */
export function orientationTransform(
  orientation: ExifOrientation,
  width: number,
  height: number,
): { matrix: CanvasMatrix; width: number; height: number } {
  const w = width
  const h = height
  switch (orientation) {
    case 2:
      return { matrix: [-1, 0, 0, 1, w, 0], width: w, height: h }
    case 3:
      return { matrix: [-1, 0, 0, -1, w, h], width: w, height: h }
    case 4:
      return { matrix: [1, 0, 0, -1, 0, h], width: w, height: h }
    case 5:
      return { matrix: [0, 1, 1, 0, 0, 0], width: h, height: w }
    case 6:
      return { matrix: [0, 1, -1, 0, h, 0], width: h, height: w }
    case 7:
      return { matrix: [0, -1, -1, 0, h, w], width: h, height: w }
    case 8:
      return { matrix: [0, -1, 1, 0, 0, w], width: h, height: w }
    default:
      return { matrix: [1, 0, 0, 1, 0, 0], width: w, height: h }
  }
}
