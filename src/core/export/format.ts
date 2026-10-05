import type { ImageFormat } from '../image-header'
import type { ExportFormat } from './naming'

/** What the session format check has confirmed so far; a missing entry is still pending. AC-12 */
export type FormatAvailability = Partial<Record<ExportFormat, boolean>>

/** The MIME type each export format is encoded and saved as. */
export const EXPORT_MIME_TYPES: Readonly<Record<ExportFormat, string>> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export function isExportFormat(format: ImageFormat | null): format is ExportFormat {
  return format === 'png' || format === 'jpeg' || format === 'webp'
}

/**
 * The format a Work's first export panel starts on: its Source format when exportable and confirmed
 * by the check, else PNG. AC-19
 */
export function defaultFormat(
  sourceFormat: ImageFormat | null,
  available: FormatAvailability,
): ExportFormat {
  if (!isExportFormat(sourceFormat)) return 'png'
  return available[sourceFormat] === true ? sourceFormat : 'png'
}
