import { matches, u16, u32 } from './reader'
import type { RefusedFormatName } from './types'

const SVG_SCAN_BYTES = 4096
const BMP_DIB_HEADER_SIZES = new Set([12, 40, 52, 56, 64, 108, 124])

/**
 * Recognises image formats the editor refuses by name (AC-07). Returns the display name, or
 * `undefined` when the bytes match none of them.
 */
export function detectRefusedFormat(b: Uint8Array): RefusedFormatName | undefined {
  if (isCameraRaw(b)) return 'Camera RAW'
  if (matches(b, 0, 'II*\0') || matches(b, 0, 'MM\0*')) return 'TIFF or camera RAW'
  if (matches(b, 0, 'II+\0') || matches(b, 0, 'MM\0+')) return 'TIFF or camera RAW' // BigTIFF
  if (matches(b, 0, '8BPS')) return 'PSD'
  if (isBmp(b)) return 'BMP'
  if (matches(b, 0, [0, 0, 1, 0]) && (u16(b, 4, true) ?? 0) > 0) return 'ICO'
  if (isSvg(b)) return 'SVG'
  return undefined
}

function isCameraRaw(b: Uint8Array): boolean {
  return (
    matches(b, 0, 'FUJIFILMCCD-RAW') || // Fujifilm RAF
    matches(b, 0, 'IIRO') || // Olympus ORF
    matches(b, 0, 'IIRS') ||
    matches(b, 0, 'MMOR') ||
    matches(b, 0, 'IIU\0') || // Panasonic RW2
    matches(b, 0, 'FOVb') || // Sigma X3F
    (matches(b, 0, 'II\x1a\0\0\0') && matches(b, 6, 'HEAPCCDR')) || // Canon CRW
    (matches(b, 4, 'ftyp') && matches(b, 8, 'crx ')) // Canon CR3
  )
}

function isBmp(b: Uint8Array): boolean {
  if (!matches(b, 0, 'BM')) return false
  const dibSize = u32(b, 14, true)
  return dibSize !== undefined && BMP_DIB_HEADER_SIZES.has(dibSize)
}

/** `<svg`, or an XML prolog with `<svg` somewhere in the first few KiB. */
function isSvg(b: Uint8Array): boolean {
  let o = matches(b, 0, [0xef, 0xbb, 0xbf]) ? 3 : 0
  while (o < b.length && isSpace(b[o]!)) o++
  if (matches(b, o, '<svg')) return true
  if (!matches(b, o, '<?xml')) return false
  const end = Math.min(b.length, SVG_SCAN_BYTES)
  for (let i = o; i < end; i++) if (matches(b, i, '<svg')) return true
  return false
}

function isSpace(c: number): boolean {
  return c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d
}
