import { clampPan, fitZoom, zoomRange, type Point, type View, type ViewContext } from './view'

/** The fixed levels the zoom-in and zoom-out controls step through (tasks/_epic.md). */
export const ZOOM_STEPS: readonly number[] = [0.1, 0.25, 1 / 3, 0.5, 2 / 3, 1, 1.5, 2, 3, 4, 6, 8]

const EPSILON = 1e-9

/**
 * Multiplies the zoom by `factor`, clamped to the range, keeping the image point under `point`
 * (canvas device pixels) fixed. Returns the same View when the clamped result changes nothing.
 */
export function zoomAt(view: View, factor: number, point: Point, ctx: ViewContext): View {
  const { min, max } = zoomRange(fitZoom(ctx.image, ctx.canvas))
  const zoom = Math.min(max, Math.max(min, view.zoom * factor))
  if (zoom === view.zoom) return view

  const ratio = zoom / view.zoom
  return clampPan(
    {
      zoom,
      panX: point.x - (point.x - view.panX) * ratio,
      panY: point.y - (point.y - view.panY) * ratio,
      autoFit: false,
    },
    ctx,
  )
}

/** Steps to the next fixed level strictly beyond the current zoom, around the canvas centre. */
export function stepZoom(view: View, direction: 1 | -1, ctx: ViewContext): View {
  const { min, max } = zoomRange(fitZoom(ctx.image, ctx.canvas))
  const target =
    direction > 0
      ? (ZOOM_STEPS.find((z) => z > view.zoom + EPSILON) ?? max)
      : ([...ZOOM_STEPS].reverse().find((z) => z < view.zoom - EPSILON) ?? min)
  const clamped = Math.min(max, Math.max(min, target))
  return zoomAt(view, clamped / view.zoom, centre(ctx), ctx)
}

/** "100%": one image pixel per device pixel, around the canvas centre. */
export function setActualSize(view: View, ctx: ViewContext): View {
  return zoomAt(view, 1 / view.zoom, centre(ctx), ctx)
}

function centre(ctx: ViewContext): Point {
  return { x: ctx.canvas.width / 2, y: ctx.canvas.height / 2 }
}
