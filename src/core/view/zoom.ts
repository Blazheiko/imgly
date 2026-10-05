import { clampPan, fitZoom, zoomRange, type Point, type View, type ViewContext } from './view'

/** The fixed levels the zoom-in and zoom-out controls step through (tasks/_epic.md). */
export const ZOOM_STEPS: readonly number[] = [0.1, 0.25, 1 / 3, 0.5, 2 / 3, 1, 1.5, 2, 3, 4, 6, 8]

const EPSILON = 1e-9

/**
 * Multiplies the zoom by `factor`, clamped to the range, keeping the image point under `point`
 * (canvas device pixels) fixed. Returns the same View when the clamped result changes nothing.
 */
export function zoomAt(view: View, factor: number, point: Point, ctx: ViewContext): View {
  const zoom = clampZoom(view.zoom * factor, ctx)
  if (zoom === view.zoom) return view
  return zoomAround(view, zoom, point, ctx)
}

/**
 * Sets the zoom to exactly `target` (clamped to the range) around `point`, and always leaves
 * auto-fit, even when the zoom is unchanged: a control press is a manual zoom (AC-12b).
 */
export function zoomTo(view: View, target: number, point: Point, ctx: ViewContext): View {
  return zoomAround(view, clampZoom(target, ctx), point, ctx)
}

/** Steps to the next fixed level strictly beyond the current zoom, around the canvas centre. */
export function stepZoom(view: View, direction: 1 | -1, ctx: ViewContext): View {
  const target =
    direction > 0
      ? (ZOOM_STEPS.find((z) => z > view.zoom + EPSILON) ?? Infinity)
      : ([...ZOOM_STEPS].reverse().find((z) => z < view.zoom - EPSILON) ?? 0)
  return zoomTo(view, target, centre(ctx), ctx)
}

/** "100%": one image pixel per device pixel, around the canvas centre. */
export function setActualSize(view: View, ctx: ViewContext): View {
  return zoomTo(view, 1, centre(ctx), ctx)
}

function clampZoom(zoom: number, ctx: ViewContext): number {
  const { min, max } = zoomRange(fitZoom(ctx.image, ctx.canvas))
  return Math.min(max, Math.max(min, zoom))
}

function zoomAround(view: View, zoom: number, point: Point, ctx: ViewContext): View {
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

function centre(ctx: ViewContext): Point {
  return { x: ctx.canvas.width / 2, y: ctx.canvas.height / 2 }
}
