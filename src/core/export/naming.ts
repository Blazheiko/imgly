import type { ImageFormat } from '../image-header'

/** The formats the editor can export to. */
export type ExportFormat = Extract<ImageFormat, 'png' | 'jpeg' | 'webp'>

/** The extensions a saved name may carry per format, the first being the one we suggest. AC-01b */
export const EXPORT_EXTENSIONS: Readonly<Record<ExportFormat, readonly string[]>> = {
  jpeg: ['.jpg', '.jpeg', '.jpe', '.jfif'],
  png: ['.png'],
  webp: ['.webp'],
}

/** Image extensions stripped from an opened file's name to get its Source name. AC-07 */
const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'jpe',
  'jfif',
  'png',
  'webp',
  'avif',
  'gif',
  'heic',
  'heif',
])

/** Windows reserved device names, compared upper-cased. AC-07 step 5 */
const RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'CONIN$',
  'CONOUT$',
  ...['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '¹', '²', '³'].flatMap((n) => [
    `COM${n}`,
    `LPT${n}`,
  ]),
])

const MAX_NAME_BYTES = 200
const FALLBACK_NAME = 'image'

// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARS = /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f]/g
const EDGE_DOTS_AND_SPACES = /^[. ]+|[. ]+$/g
const NOTHING_USABLE = /^[_. ]*$/

/** The opened file's name without its last extension, when that is a known image one. AC-07 */
export function sourceNameOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) return fileName
  const extension = fileName.slice(dot + 1).toLowerCase()
  return IMAGE_EXTENSIONS.has(extension) ? fileName.slice(0, dot) : fileName
}

/** The suggested export file name: the cleaned Source name, `-edited` and the format's extension. AC-07 */
export function exportFileName(sourceName: string, format: ExportFormat): string {
  let name = sourceName.replace(FORBIDDEN_CHARS, '_')
  name = name.replace(EDGE_DOTS_AND_SPACES, '')
  name = truncateUtf8(name, MAX_NAME_BYTES)
  name = name.replace(EDGE_DOTS_AND_SPACES, '')
  name = escapeReservedName(name)
  if (NOTHING_USABLE.test(name)) name = FALLBACK_NAME
  return `${name}-edited${EXPORT_EXTENSIONS[format][0]}`
}

/** Whether a name returned by the save dialog carries an extension of `format`, any case. AC-01b */
export function matchesExtension(name: string, format: ExportFormat): boolean {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return false
  return EXPORT_EXTENSIONS[format].includes(name.slice(dot).toLowerCase())
}

function truncateUtf8(text: string, maxBytes: number): string {
  const encoder = new TextEncoder()
  let bytes = 0
  let end = 0
  for (const char of text) {
    bytes += encoder.encode(char).length
    if (bytes > maxBytes) break
    end += char.length
  }
  return text.slice(0, end)
}

function escapeReservedName(name: string): string {
  const dot = name.indexOf('.')
  const stem = (dot < 0 ? name : name.slice(0, dot)).trimEnd()
  if (!RESERVED_NAMES.has(stem.toUpperCase())) return name
  return `${stem}_${name.slice(stem.length)}`
}
