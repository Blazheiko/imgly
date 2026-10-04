import { appError, err, isAppErrorCode, type AppError, type Result } from '@/core'
import { bitmapLedger } from '@/shared'
import {
  SUPERSEDED,
  type Capabilities,
  type DecodedImage,
  type DecodeOutcome,
  type DecodeRequest,
} from './types'

const FORMATS = new Set(['jpeg', 'png', 'gif', 'webp', 'avif', 'heic'])

/** Validates a worker message; anything malformed is a failed decode. */
export function parseWorkerResponse(data: unknown): Result<DecodedImage, AppError> {
  const failed = err(appError('DECODE_FAILED'))
  if (typeof data !== 'object' || data === null) return failed
  const message = data as Record<string, unknown>

  if (message.ok === false) {
    const error = message.error as Record<string, unknown> | undefined
    if (typeof error !== 'object' || error === null || !isAppErrorCode(error.code)) return failed
    const details = error.details
    return err(
      typeof details === 'object' && details !== null
        ? appError(error.code, details as Record<string, unknown>)
        : appError(error.code),
    )
  }

  const value = message.value as Record<string, unknown> | undefined
  if (message.ok !== true || typeof value !== 'object' || value === null) return failed
  const numbers = ['sourceWidth', 'sourceHeight', 'width', 'height'] as const
  if (
    !value.bitmap ||
    !numbers.every((key) => typeof value[key] === 'number') ||
    !FORMATS.has(value.format as string) ||
    typeof value.animated !== 'boolean' ||
    typeof value.downscaled !== 'boolean'
  ) {
    return failed
  }
  return { ok: true, value: value as unknown as DecodedImage }
}

function parseCapabilities(data: unknown): Capabilities | undefined {
  const value = (data as { capabilities?: Record<string, unknown> } | null)?.capabilities
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof value.appliesOrientation !== 'boolean' ||
    typeof value.decodesHeic !== 'boolean'
  ) {
    return undefined
  }
  return { appliesOrientation: value.appliesOrientation, decodesHeic: value.decodesHeic }
}

/**
 * One worker per open. A new call terminates the previous worker at once and resolves its
 * promise as `Superseded` (AC-16b); a worker is also terminated when its result arrives. Every
 * call settles: a worker that can't start or can't take the request is DECODE_FAILED.
 */
export function createDecoder(createWorker: () => Worker) {
  let current: { worker: Worker; settle: (outcome: DecodeOutcome) => void } | undefined
  // The probes run in the session's first worker; later workers get the cached results.
  let capabilities: Capabilities | undefined

  return function decodeImage(file: Blob): Promise<DecodeOutcome> {
    current?.worker.terminate()
    current?.settle(SUPERSEDED)

    return new Promise((resolve) => {
      let worker: Worker
      try {
        worker = createWorker()
      } catch {
        resolve(err(appError('DECODE_FAILED')))
        return
      }
      const job = {
        worker,
        settle: (outcome: DecodeOutcome) => {
          worker.onmessage = worker.onerror = worker.onmessageerror = null
          if (current === job) current = undefined
          resolve(outcome)
        },
      }
      current = job
      const finish = (outcome: DecodeOutcome) => {
        worker.terminate()
        job.settle(outcome)
      }
      worker.onmessage = (event) => {
        capabilities ??= parseCapabilities(event.data)
        const response = parseWorkerResponse(event.data)
        if (response.ok) bitmapLedger.noteReceived()
        finish(response)
      }
      worker.onerror = () => finish(err(appError('DECODE_FAILED')))
      worker.onmessageerror = () => finish(err(appError('DECODE_FAILED')))
      const request: DecodeRequest = capabilities ? { file, capabilities } : { file }
      try {
        worker.postMessage(request)
      } catch {
        finish(err(appError('DECODE_FAILED')))
      }
    })
  }
}
