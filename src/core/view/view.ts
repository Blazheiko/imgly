/**
 * The View: how the Original is shown on the canvas. Everything is in device pixels, so zoom 1 is
 * one image pixel per physical screen pixel (AC-12). A canvas point is `pan + imagePoint * zoom`.
 * The View lives outside the Work and never changes it (AC-14).
 */
export interface View {
  zoom: number
  /** Canvas x of the image's left edge, in device pixels. */
  panX: number
  /** Canvas y of the image's top edge, in device pixels. */
  panY: number
  /** True until the first manual zoom or pan after an open or "Fit"; resize then re-fits. */
  autoFit: boolean
}

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** The upright Original's size and the canvas area's size, both in device pixels. */
export interface ViewContext {
  image: Size
  canvas: Size
}

/** The largest zoom at which the whole image fits, never above 100% (AC-01). */
export function fitZoom(image: Size, canvas: Size): number {
  return Math.min(canvas.width / image.width, canvas.height / image.height, 1)
}

/** Fit, centred, with auto-fit back on. */
export function fitView(ctx: ViewContext): View {
  const zoom = fitZoom(ctx.image, ctx.canvas)
  return clampPan({ zoom, panX: 0, panY: 0, autoFit: true }, ctx)
}

/** Keeps the image against the canvas edges on any axis where it overflows; centres it otherwise. */
export function clampPan(view: View, ctx: ViewContext): View {
  const panX = clampAxis(view.panX, ctx.image.width * view.zoom, ctx.canvas.width)
  const panY = clampAxis(view.panY, ctx.image.height * view.zoom, ctx.canvas.height)
  return panX === view.panX && panY === view.panY ? view : { ...view, panX, panY }
}

function clampAxis(pan: number, imageExtent: number, canvasExtent: number): number {
  if (imageExtent <= canvasExtent) return (canvasExtent - imageExtent) / 2
  return Math.min(0, Math.max(canvasExtent - imageExtent, pan))
}

/**
 * Re-applies the View after the canvas area changed size (AC-12b): re-fit while auto-fit is on,
 * otherwise keep the zoom (re-clamped to the new range) and re-clamp the pan.
 */
export function resizeView(view: View, ctx: ViewContext): View {
  if (view.autoFit) return fitView(ctx)
  const { min, max } = zoomRange(fitZoom(ctx.image, ctx.canvas))
  const zoom = Math.min(max, Math.max(min, view.zoom))
  return clampPan(zoom === view.zoom ? view : { ...view, zoom }, ctx)
}

/** Zoom bounds: the smaller of Fit and 10% up to 800% (AC-12b). */
export function zoomRange(fit: number): { min: number; max: number } {
  return { min: Math.min(fit, MIN_STEP), max: MAX_ZOOM }
}

const MIN_STEP = 0.1
const MAX_ZOOM = 8
