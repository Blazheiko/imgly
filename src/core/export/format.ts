import type { ImageFormat } from '../image-header'
import type { ExportFormat } from './naming'

/** What the session format check has confirmed so far; a missing entry is still pending. AC-12 */
export type FormatAvailability = Partial<Record<ExportFormat, boolean>>

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
