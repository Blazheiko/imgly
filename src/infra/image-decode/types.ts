import type { AppError, ImageFormat, Result } from '@/core'

/** The Original as the worker hands it over: upright, sRGB, within the Downscale limit. */
export interface DecodedImage {
  bitmap: ImageBitmap
  /** Upright size before the Downscale limit was applied. */
  sourceWidth: number
  sourceHeight: number
  width: number
  height: number
  format: ImageFormat
  animated: boolean
  downscaled: boolean
  /** At least one pixel of the Original is not fully opaque (export AC-15). */
  hasTransparency: boolean
}

/** A newer open replaced this one; not an error — the caller ignores it (AC-16b). */
export interface Superseded {
  readonly kind: 'superseded'
}

export const SUPERSEDED: Superseded = Object.freeze({ kind: 'superseded' })

export function isSuperseded(value: unknown): value is Superseded {
  return value === SUPERSEDED
}

/** What the per-session probes found (feature ADR 0001); no user-agent sniffing. */
export interface Capabilities {
  /** `createImageBitmap` already applies EXIF orientation. */
  appliesOrientation: boolean
  decodesHeic: boolean
}

export interface DecodeRequest {
  file: Blob
  /** Absent for the session's first worker, which runs the probes itself. */
  capabilities?: Capabilities
}

/** Errors cross the worker boundary as plain `{ code, details }` objects. */
export type DecodeResponse = Result<DecodedImage, AppError>

/** The first worker of a session also returns what its probes found. */
export type DecodeMessage = DecodeResponse & { capabilities?: Capabilities }

export type DecodeOutcome = DecodeResponse | Superseded
