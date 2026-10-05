/**
 * The error contract shared by `core` and `infra`: functions return `Result<T, AppError>` and throw
 * only for programmer errors. The UI surfaces every `AppError` through one toast boundary.
 */
export type AppErrorCode =
  | 'STORAGE_QUOTA'
  /** The browser refused to read the file (permission, moved or deleted). AC-10 */
  | 'FILE_NOT_PERMITTED'
  /** The content is not a recognised image, whatever its name says. AC-08 */
  | 'NOT_AN_IMAGE'
  /** A recognised image whose declared size can't be found in the header window. AC-08 */
  | 'UNREADABLE'
  /** The browser could not decode a file the header parser accepted. AC-08 */
  | 'DECODE_FAILED'
  /** A recognised image format this browser/app can't open; `details.format` names it. AC-07 */
  | 'UNSUPPORTED_FORMAT'
  /**
   * Above the size ceiling: `details.{width,height,megapixels,ceilingMegapixels}`, or above the
   * byte ceiling: `details.{megabytes,ceilingMegabytes}`. AC-09
   */
  | 'TOO_LARGE'
  /** The browser lacks a capability the editor needs (WebGL2, workers). AC-18 */
  | 'UNSUPPORTED_BROWSER'
  /** The GPU context was lost and could not be restored in time. AC-19b */
  | 'DISPLAY_LOST'
  /** Rendering, encoding, size or graphics failed during an export; nothing was written. AC-13 */
  | 'EXPORT_FAILED'
  /** The browser produced a different format than asked: `details.{asked,produced}`. AC-12 */
  | 'EXPORT_FORMAT_MISMATCH'
  /** The browser refused to write the chosen file (permission, read-only target). AC-14 */
  | 'EXPORT_NOT_PERMITTED'
  /** The save dialog returned a name whose extension doesn't match the format: `details.name`. AC-01b */
  | 'EXPORT_EXTENSION_MISMATCH'

export interface AppError {
  code: AppErrorCode
  details?: Record<string, unknown>
}

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error }
}

export function appError(code: AppErrorCode, details?: Record<string, unknown>): AppError {
  return details === undefined ? { code } : { code, details }
}

const APP_ERROR_CODES: Record<AppErrorCode, true> = {
  STORAGE_QUOTA: true,
  FILE_NOT_PERMITTED: true,
  NOT_AN_IMAGE: true,
  UNREADABLE: true,
  DECODE_FAILED: true,
  UNSUPPORTED_FORMAT: true,
  TOO_LARGE: true,
  UNSUPPORTED_BROWSER: true,
  DISPLAY_LOST: true,
  EXPORT_FAILED: true,
  EXPORT_FORMAT_MISMATCH: true,
  EXPORT_NOT_PERMITTED: true,
  EXPORT_EXTENSION_MISMATCH: true,
}

/** Runtime check for codes that crossed a boundary untyped (e.g. a worker message). */
export function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === 'string' && Object.hasOwn(APP_ERROR_CODES, value)
}
