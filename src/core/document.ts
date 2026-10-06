import type { ImageFormat } from './image-header'

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
  /**
   * At least one pixel is not fully opaque (export AC-15). An edit that changes alpha must keep this
   * true for the edited Work.
   */
  hasTransparency: boolean
}

/** Where the Work came from: names Exports and picks their default format (export AC-07, AC-19). */
export interface WorkSource {
  /** The opened file's name with a known image extension removed; '' for a nameless Blob. */
  sourceName: string
  /** The format the Work was opened from, judged by content. */
  sourceFormat: ImageFormat
}

export interface Work<TPixels = unknown> extends WorkSource {
  id: string
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
  source: WorkSource,
  now: number = Date.now(),
): Work<TPixels> {
  return {
    id,
    sourceName: source.sourceName,
    sourceFormat: source.sourceFormat,
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
