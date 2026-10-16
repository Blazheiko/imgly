import {
  appError,
  err,
  isAppErrorCode,
  ok,
  type AppError,
  type AppErrorCode,
  type Result,
} from '@/core'
import { isScriptLoadFailure } from '@/shared'
import type { CodecRequest, PixelSize } from './worker-handler'

/** Far above the §6 targets: only a hung worker reaches it. */
export const CODEC_TIMEOUT_MS = 60_000

function parseReply<T>(
  data: unknown,
  isValue: (value: unknown) => value is T,
  failure: AppErrorCode,
): Result<T, AppError> {
  const failed = err(appError(failure))
  if (typeof data !== 'object' || data === null) return failed
  const message = data as Record<string, unknown>
  if (message.ok === true) return isValue(message.value) ? ok(message.value) : failed
  const error = message.error as Record<string, unknown> | undefined
  if (message.ok !== false || typeof error !== 'object' || error === null) return failed
  return isAppErrorCode(error.code) ? err(appError(error.code)) : failed
}

const isBlob = (value: unknown): value is Blob => value instanceof Blob
const isBitmap = (value: unknown): value is ImageBitmap =>
  typeof value === 'object' && value !== null && 'width' in value && 'height' in value

/**
 * Runs one message in a fresh worker, terminated in every branch; `posted` is false if it never left.
 * A worker script that failed to load is APP_PART_UNAVAILABLE (pwa-install-update AC-14).
 */
function runInWorker<T>(
  createWorker: () => Worker,
  message: CodecRequest,
  transfer: Transferable[],
  parse: (data: unknown) => Result<T, AppError>,
  failure: AppErrorCode,
): Promise<{ result: Result<T, AppError>; posted: boolean }> {
  const failed = err(appError(failure))
  return new Promise((resolve) => {
    let worker: Worker
    try {
      worker = createWorker()
    } catch {
      resolve({ result: failed, posted: false })
      return
    }
    const timer = setTimeout(() => finish(failed), CODEC_TIMEOUT_MS)
    const finish = (result: Result<T, AppError>, posted = true) => {
      clearTimeout(timer)
      worker.onmessage = worker.onerror = worker.onmessageerror = null
      worker.terminate()
      resolve({ result, posted })
    }
    worker.onmessage = (event) => finish(parse(event.data))
    worker.onerror = (event) =>
      finish(isScriptLoadFailure(event) ? err(appError('APP_PART_UNAVAILABLE')) : failed)
    worker.onmessageerror = () => finish(failed)
    try {
      worker.postMessage(message, transfer)
    } catch {
      finish(failed, false)
    }
  })
}

/** PNG encode and decode, each job in a fresh worker (gallery ADR-0003). Never rejects. */
export function createWorkCodec(createWorker: () => Worker) {
  return {
    /** The bitmap is transferred to the worker and closed there. */
    async encodePng(bitmap: ImageBitmap): Promise<Result<Blob, AppError>> {
      const { result, posted } = await runInWorker(
        createWorker,
        { kind: 'encode', bitmap },
        [bitmap],
        (data) => parseReply(data, isBlob, 'STORAGE_FAILED'),
        'STORAGE_FAILED',
      )
      if (!posted) bitmap.close()
      return result
    },

    /** A decode failure or a size other than `expected` is WORK_DAMAGED (AC-08). */
    async decodePng(blob: Blob, expected: PixelSize): Promise<Result<ImageBitmap, AppError>> {
      const { result } = await runInWorker(
        createWorker,
        { kind: 'decode', blob, expected },
        [],
        (data) => parseReply(data, isBitmap, 'WORK_DAMAGED'),
        'WORK_DAMAGED',
      )
      return result
    },
  }
}
