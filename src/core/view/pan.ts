import { clampPan, type View, type ViewContext } from './view'

/**
 * Moves the image by a gesture delta in device pixels, stopping at its edges (AC-13). A pan that
 * moves nothing — the image fits, or it is already at the edge — returns the same View.
 */
export function panBy(view: View, dx: number, dy: number, ctx: ViewContext): View {
  const next = clampPan({ ...view, panX: view.panX + dx, panY: view.panY + dy }, ctx)
  if (next.panX === view.panX && next.panY === view.panY) return view
  return { ...next, autoFit: false }
}
