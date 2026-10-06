import {
  EXPORT_EXTENSIONS,
  isExportFormat,
  type AppError,
  type ExportFormat,
  type ImageFormat,
} from '@/core'

/**
 * The one catalog of user-facing copy for exporting (screens.md §Message catalog). File names are
 * shown here, unlike open-and-view, because the Editor chose them and needs them to find the file.
 * No raw browser error text is ever shown.
 */

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  png: 'PNG',
  jpeg: 'JPEG',
  webp: 'WebP',
}

/** A format named in error details, which crossed a worker boundary untyped. */
function formatIn(value: unknown): ExportFormat | null {
  return typeof value === 'string' && isExportFormat(value as ImageFormat)
    ? (value as ExportFormat)
    : null
}

const label = (value: unknown) => {
  const format = formatIn(value)
  return format ? FORMAT_LABELS[format] : 'That'
}

const mainExtension = (value: unknown) => {
  const format = formatIn(value)
  return format ? EXPORT_EXTENSIONS[format][0]! : 'the right extension'
}

export function infoSaved(file: string): string {
  return `Saved ${file}.`
}

export function infoDownloaded(file: string): string {
  return `${file} is in your browser's downloads.`
}

export function infoNoImage(): string {
  return 'Open an image first to export it.'
}

const FAILURES: Partial<Record<AppError['code'], (details: Record<string, unknown>) => string>> = {
  EXPORT_FAILED: () => 'The export failed. Try again, or choose a smaller size.',
  EXPORT_FORMAT_MISMATCH: ({ asked }) =>
    `This browser didn't make a real ${label(asked)} file, so nothing was saved. ${label(asked)} is turned off for now; PNG is selected.`,
  EXPORT_EXTENSION_MISMATCH: ({ name, format }) =>
    `"${String(name)}" doesn't end in ${mainExtension(format)}, so nothing was written. Save again with a ${mainExtension(format)} name.`,
  EXPORT_NOT_PERMITTED: () => "The app wasn't allowed to save there. Choose another folder.",
}

/**
 * The failure notice for an export error. `touchedFile` is the name the "Save as…" dialog returned
 * when it had already emptied or created that file (AC-13).
 */
export function failureMessage(error: AppError, opts: { touchedFile?: string } = {}): string {
  const text = (FAILURES[error.code] ?? FAILURES.EXPORT_FAILED!)(error.details ?? {})
  return opts.touchedFile === undefined
    ? text
    : `${text} A file named "${opts.touchedFile}" there may now be empty or missing.`
}

export function hintUnavailable(format: ExportFormat): string {
  return `${FORMAT_LABELS[format]} isn't available in this browser.`
}

export function hintChecking(): string {
  return 'Checking this browser…'
}

export function hintTransparency(): string {
  return 'JPEG has no transparency: transparent areas become white. PNG or WebP keep them.'
}

export function lineSaveDialog(): string {
  return "You'll choose where to save it."
}

export function lineDownloads(): string {
  return "It goes to your browser's downloads."
}

export function lineFileReady(): string {
  return 'Your file is ready.'
}
