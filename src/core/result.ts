/**
 * The error contract shared by `core` and `infra`: functions return `Result<T, AppError>` and throw
 * only for programmer errors. The UI surfaces every `AppError` through one toast boundary.
 */
export type AppErrorCode = 'STORAGE_QUOTA'

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
