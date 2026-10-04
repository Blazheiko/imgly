/**
 * The Work document model: one image being edited, its Original plus everything applied on top.
 * Unsaved edits are tracked with a revision counter (feature ADR 0005): every operation that
 * changes the Work raises `revision`; View changes live outside the Work and never touch it.
 */

/**
 * The opened image after orientation and the Downscale limit, in pixels only — no metadata.
 * `pixels` is the platform's pixel holder (an `ImageBitmap` in the browser); core never reads it.
 */
export interface Original<TPixels = unknown> {
  width: number
  height: number
  pixels: TPixels
}

export interface Work<TPixels = unknown> {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  original: Original<TPixels>
  revision: number
  /** The revision at open (later also at save). */
  cleanRevision: number
}

export function createWork<TPixels>(
  original: Original<TPixels>,
  id: string,
  now: number = Date.now(),
): Work<TPixels> {
  return {
    id,
    name: 'Untitled',
    createdAt: now,
    updatedAt: now,
    original,
    revision: 0,
    cleanRevision: 0,
  }
}

export function hasUnsavedEdits(work: Work): boolean {
  return work.revision !== work.cleanRevision
}

/** The one rule every edit follows: the changed Work carries `revision + 1`. */
export function withEdit<TPixels>(work: Work<TPixels>, now: number = Date.now()): Work<TPixels> {
  return { ...work, revision: work.revision + 1, updatedAt: now }
}
