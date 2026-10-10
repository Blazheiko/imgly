import { appError, err, isAppErrorCode, ok, type AppError, type Result } from '@/core'
import type {
  AlphaRequest,
  ExportRequest,
  ExportWorkerMessage,
  FormatCheck,
} from './worker-handler'

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
export const ALPHA_TIMEOUT_MS = 15_000

/** Validates an alpha-check reply; anything malformed fails the check. */
function parseAlphaReply(data: unknown): Result<boolean, AppError> {
  const reply = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
  return reply.ok === true && typeof reply.value === 'boolean'
    ? ok(reply.value)
    : err(appError('EXPORT_FAILED'))
}

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

/** A check reply; only an explicit `webgl2: false` sends exports to the window. */
function parseCheckReply(data: unknown): FormatCheck {
  const reply = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
  return { webgl2: reply.webgl2 !== false, jpeg: reply.jpeg === true, webp: reply.webp === true }
}

const formatsOf = (check: FormatCheck): FormatAvailabilityCheck => ({
  png: true,
  jpeg: check.jpeg,
  webp: check.webp,
})

/** The same export and check run in the window, for an engine whose workers lack WebGL2. */
export interface InWindowExport {
  exportImage(request: ExportRequest): Promise<Result<Blob, AppError>>
  check(): Promise<FormatCheck>
  checkAlpha?(request: AlphaRequest): Promise<Result<boolean, AppError>>
}

/** What an export or alpha request transfers: the bitmap copy and the layer's pixels, if any. */
const transferOf = (request: { bitmap: ImageBitmap; layer: ImageData | null }): Transferable[] =>
  request.layer ? [request.bitmap, request.layer.data.buffer] : [request.bitmap]

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

/**
 * The main-thread side of the export worker: one short-lived worker per export or check. When the
 * session check finds no WebGL2 in the worker, every later check and export runs in the window
 * instead (export ADR-0003), so the bitmap never goes to a worker that cannot render it.
 */
export function createExportClient(createWorker: () => Worker, inWindow?: InWindowExport) {
  /** Settles with whether exports run in the window; undefined until a check has started. */
  let useWindow: Promise<boolean> | undefined

  return {
    /** Renders, encodes and verifies one export; the bitmap is transferred and closed there. */
    async exportImage(request: ExportRequest): Promise<Result<Blob, AppError>> {
      if (inWindow && useWindow && (await useWindow)) return inWindow.exportImage(request)
      const { value, posted } = await runInWorker(
        createWorker,
        { kind: 'export', request },
        transferOf(request),
        parseExportReply,
        err(appError('EXPORT_FAILED')),
        EXPORT_TIMEOUT_MS,
      )
      if (!posted) request.bitmap.close()
      return value
    },

    /**
     * Whether any pixel inside the Crop is not fully opaque, rendered with the export's shader on
     * the GPU (crop-rotate ADR-0004). The bitmap is transferred and closed there; never rejects.
     */
    async checkCropTransparency(request: AlphaRequest): Promise<Result<boolean, AppError>> {
      if (inWindow?.checkAlpha && useWindow && (await useWindow))
        return inWindow.checkAlpha(request)
      const { value, posted } = await runInWorker(
        createWorker,
        { kind: 'alpha', request },
        transferOf(request),
        parseAlphaReply,
        err(appError('EXPORT_FAILED')),
        ALPHA_TIMEOUT_MS,
      )
      if (!posted) request.bitmap.close()
      return value
    },

    /** The session format check; never rejects — any error makes that format unavailable. */
    async checkExportFormats(): Promise<FormatAvailabilityCheck> {
      const inWorker = runInWorker(
        createWorker,
        { kind: 'check' },
        undefined,
        parseCheckReply,
        { webgl2: true, ...UNAVAILABLE },
        CHECK_TIMEOUT_MS,
      ).then(({ value }) => value)
      useWindow = inWorker.then((check) => inWindow !== undefined && !check.webgl2)
      const check = await inWorker
      if (!inWindow || check.webgl2) return formatsOf(check)
      try {
        return formatsOf(await inWindow.check())
      } catch {
        return UNAVAILABLE
      }
    },
  }
}
