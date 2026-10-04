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
}

/** A newer open replaced this one; not an error — the caller ignores it (AC-16b). */
export interface Superseded {
  readonly kind: 'superseded'
}

export const SUPERSEDED: Superseded = Object.freeze({ kind: 'superseded' })

export function isSuperseded(value: unknown): value is Superseded {
  return value === SUPERSEDED
}

export interface DecodeRequest {
  file: Blob
}

/** Errors cross the worker boundary as plain `{ code, details }` objects. */
export type DecodeResponse = Result<DecodedImage, AppError>

export type DecodeOutcome = DecodeResponse | Superseded
