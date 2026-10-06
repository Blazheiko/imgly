import { appError, err, isAppErrorCode, ok, type AppError, type Result } from '@/core'
import type { ExportRequest, ExportWorkerMessage } from './worker-handler'

/** Which formats this browser can produce, by content; PNG always (AC-12). */
export interface FormatAvailabilityCheck {
  png: true
  jpeg: boolean
  webp: boolean
}

const UNAVAILABLE: FormatAvailabilityCheck = { png: true, jpeg: false, webp: false }

/**
 * How long a worker may stay silent before it counts as crashed: a GPU or driver stall, or a
 * rejection in its async handler that never reaches `onerror`. Far above the §6 export times, so
 * only a hung worker hits them; without them the editor would stay locked in its exporting phase.
 */
export const EXPORT_TIMEOUT_MS = 60_000
export const CHECK_TIMEOUT_MS = 15_000

/** Validates an export reply; anything malformed is a failed export. */
function parseExportReply(data: unknown): Result<Blob, AppError> {
  const failed = err(appError('EXPORT_FAILED'))
  if (typeof data !== 'object' || data === null) return failed
  const message = data as Record<string, unknown>
  if (message.ok === true) return message.value instanceof Blob ? ok(message.value) : failed
  const error = message.error as Record<string, unknown> | undefined
  if (message.ok !== false || typeof error !== 'object' || error === null) return failed
  if (!isAppErrorCode(error.code)) return failed
  const details = error.details
  return err(
    typeof details === 'object' && details !== null
      ? appError(error.code, details as Record<string, unknown>)
      : appError(error.code),
  )
}

function parseCheckReply(data: unknown): FormatAvailabilityCheck {
  const reply = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
  return { png: true, jpeg: reply.jpeg === true, webp: reply.webp === true }
}

/**
 * Runs one message in a fresh worker and settles with `parse(reply)` or `fallback` on any crash.
 * The worker is terminated in every branch, which frees its WebGL2 context (export ADR-0002).
 */
function runInWorker<T>(
  createWorker: () => Worker,
  message: ExportWorkerMessage,
  transfer: Transferable[] | undefined,
  parse: (data: unknown) => T,
  fallback: T,
  timeoutMs: number,
): Promise<{ value: T; posted: boolean }> {
  return new Promise((resolve) => {
    let worker: Worker
    try {
      worker = createWorker()
    } catch {
      resolve({ value: fallback, posted: false })
      return
    }
    const timer = setTimeout(() => finish(fallback), timeoutMs)
    const finish = (value: T, posted = true) => {
      clearTimeout(timer)
      worker.onmessage = worker.onerror = worker.onmessageerror = null
      worker.terminate()
      resolve({ value, posted })
    }
    worker.onmessage = (event) => finish(parse(event.data))
    worker.onerror = () => finish(fallback)
    worker.onmessageerror = () => finish(fallback)
    try {
      worker.postMessage(message, transfer as Transferable[])
    } catch {
      finish(fallback, false)
    }
  })
}

/** The main-thread side of the export worker: one short-lived worker per export or check. */
export function createExportClient(createWorker: () => Worker) {
  return {
    /** Renders, encodes and verifies one export; the bitmap is transferred and closed there. */
    async exportImage(request: ExportRequest): Promise<Result<Blob, AppError>> {
      const { value, posted } = await runInWorker(
        createWorker,
        { kind: 'export', request },
        [request.bitmap],
        parseExportReply,
        err(appError('EXPORT_FAILED')),
        EXPORT_TIMEOUT_MS,
      )
      if (!posted) request.bitmap.close()
      return value
    },

    /** The session format check; never rejects — any error makes that format unavailable. */
    async checkExportFormats(): Promise<FormatAvailabilityCheck> {
      const { value } = await runInWorker(
        createWorker,
        { kind: 'check' },
        undefined,
        parseCheckReply,
        UNAVAILABLE,
        CHECK_TIMEOUT_MS,
      )
      return value
    },
  }
}
