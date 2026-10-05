import {
  appError,
  err,
  EXPORT_EXTENSIONS,
  EXPORT_MIME_TYPES,
  ok,
  type AppError,
  type ExportFormat,
  type Result,
} from '@/core'

/** The parts of a `FileSystemFileHandle` the save path uses; `remove()` is Chromium-only. */
export interface SaveFileHandle {
  readonly name: string
  createWritable(): Promise<{
    write(data: Blob): Promise<void>
    close(): Promise<void>
    abort(): Promise<void>
  }>
  remove?(): Promise<void>
}

/** How the "Save as…" dialog ended; a cancel is not an error (AC-10). */
export type SaveTarget =
  | { kind: 'picked'; handle: SaveFileHandle; name: string }
  | { kind: 'cancelled' }
  /** The user activation expired while encoding; the panel offers "File ready — Save…". */
  | { kind: 'activationLapsed' }

interface SaveFilePickerOptions {
  suggestedName: string
  types: { description: string; accept: Record<string, string[]> }[]
  excludeAcceptAllOption: boolean
}

type PickerWindow = {
  showSaveFilePicker?: (options: SaveFilePickerOptions) => Promise<SaveFileHandle>
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  png: 'PNG image',
  jpeg: 'JPEG image',
  webp: 'WebP image',
}

/** How long a download's object URL lives after `click()` (sad.md §8 Resource lifetime). */
export const DOWNLOAD_URL_LIFETIME_MS = 60_000

const NOT_PERMITTED = new Set(['NotAllowedError', 'SecurityError', 'NoModificationAllowedError'])

const errorName = (error: unknown) => (error instanceof DOMException ? error.name : undefined)

/** Whether the browser has a "Save as…" dialog; by feature, never by user agent. */
export function hasSaveDialog(): boolean {
  return 'showSaveFilePicker' in window
}

/** Opens "Save as…" with the suggested name and only the chosen format's type (AC-01b). */
export async function pickSaveTarget(
  suggestedName: string,
  format: ExportFormat,
): Promise<Result<SaveTarget, AppError>> {
  const picker = (window as unknown as PickerWindow).showSaveFilePicker
  if (!picker) return err(appError('EXPORT_FAILED'))
  try {
    const handle = await picker.call(window, {
      suggestedName,
      types: [
        {
          description: FORMAT_LABELS[format],
          accept: { [EXPORT_MIME_TYPES[format]]: [...EXPORT_EXTENSIONS[format]] },
        },
      ],
      excludeAcceptAllOption: true,
    })
    return ok({ kind: 'picked', handle, name: handle.name })
  } catch (error) {
    if (errorName(error) === 'AbortError') return ok({ kind: 'cancelled' })
    if (errorName(error) === 'SecurityError') return ok({ kind: 'activationLapsed' })
    return err(appError('EXPORT_FAILED'))
  }
}

/**
 * Writes the verified file; the target is replaced only on `close()`. A refused write is
 * EXPORT_NOT_PERMITTED (AC-14), anything else EXPORT_FAILED; the writable is aborted either way.
 */
export async function writeFile(
  handle: SaveFileHandle,
  blob: Blob,
): Promise<Result<void, AppError>> {
  let writable: Awaited<ReturnType<SaveFileHandle['createWritable']>> | undefined
  try {
    writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return ok(undefined)
  } catch (error) {
    await writable?.abort().catch(() => {})
    const name = errorName(error)
    return err(appError(name && NOT_PERMITTED.has(name) ? 'EXPORT_NOT_PERMITTED' : 'EXPORT_FAILED'))
  }
}

/**
 * Removes a file the dialog emptied or created before a refusal, where the browser allows it
 * (AC-13). Returns whether it was removed; never throws.
 */
export async function discardEmptyTarget(handle: SaveFileHandle): Promise<boolean> {
  if (typeof handle.remove !== 'function') return false
  try {
    await handle.remove()
    return true
  } catch {
    return false
  }
}

/** Hands the verified file to the browser's downloads under `name` (AC-02). */
export function downloadFile(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  link.hidden = true
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS)
}
