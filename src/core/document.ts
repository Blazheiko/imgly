import type { ImageFormat } from './image-header'
import { identityGeometry, type Geometry } from './geometry'
import { NEUTRAL_ADJUSTMENTS, type Adjustments } from './adjust'

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

/**
 * The Work's one Drawing layer (draw ADR-0001): a bitmap on the Original's pixel grid, always the
 * Original's size. `id` is new for every applied layer; `pixels` is the platform's bitmap holder
 * (an `OffscreenCanvas` in the browser), which core never reads.
 */
export interface DrawingLayer<TPixels = unknown> {
  id: string
  width: number
  height: number
  pixels: TPixels
}

/** Where the Work came from: names Exports and picks their default format (export AC-07, AC-19). */
export interface WorkSource {
  /** The opened file's name with a known image extension removed; '' for a nameless Blob. */
  sourceName: string
  /** The format the Work was opened from, judged by content. */
  sourceFormat: ImageFormat
}

export interface Work<TPixels = unknown, TLayer = unknown> extends WorkSource {
  id: string
  createdAt: number
  updatedAt: number
  original: Original<TPixels>
  /** Flip, Rotation, Straighten angle and Crop over the Original (crop-rotate ADR-0001). */
  geometry: Geometry
  /** The seven colour values (adjust ADR-0001); neutral on every new Work. */
  adjustments: Adjustments
  /** The applied marks over the adjusted image; null while nothing is drawn (draw ADR-0001). */
  drawing: DrawingLayer<TLayer> | null
  revision: number
  /** The revision at open (later also at save). */
  cleanRevision: number
}

export function createWork<TPixels, TLayer = unknown>(
  original: Original<TPixels>,
  id: string,
  source: WorkSource,
  now: number = Date.now(),
): Work<TPixels, TLayer> {
  return {
    id,
    sourceName: source.sourceName,
    sourceFormat: source.sourceFormat,
    createdAt: now,
    updatedAt: now,
    original,
    geometry: identityGeometry(original),
    adjustments: NEUTRAL_ADJUSTMENTS,
    drawing: null,
    revision: 0,
    cleanRevision: 0,
  }
}

export function hasUnsavedEdits(work: Work): boolean {
  return work.revision !== work.cleanRevision
}

/** The one rule every edit follows: the changed Work carries `revision + 1`. */
export function withEdit<TPixels, TLayer>(
  work: Work<TPixels, TLayer>,
  now: number = Date.now(),
): Work<TPixels, TLayer> {
  return { ...work, revision: work.revision + 1, updatedAt: now }
}
