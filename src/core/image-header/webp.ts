import { appError, err, ok, type AppError, type Result } from '../result'
import { ascii, matches, u16, u32, u8 } from './reader'
import type { ImageHeader } from './types'

const VP8X_ANIMATION = 0x02
/** Bytes of each first chunk that hold the size; the rest of the chunk may lie past the window. */
const FRAME_HEADER_BYTES: Record<string, number> = { 'VP8 ': 10, VP8L: 5, VP8X: 10 }

export function isWebp(b: Uint8Array): boolean {
  return matches(b, 0, 'RIFF') && matches(b, 8, 'WEBP')
}

/**
 * The first chunk decides: VP8 (lossy), VP8L (lossless) or VP8X (extended, may animate). Only the
 * chunk's frame header must be inside the window, since a simple-format image is one large chunk.
 */
export function parseWebp(b: Uint8Array): Result<ImageHeader, AppError> {
  const unreadable = err(appError('UNREADABLE'))
  const type = ascii(b, 12, 4)
  const length = u32(b, 16, true)
  const d = 20
  if (type === undefined || length === undefined) return unreadable
  const needed = FRAME_HEADER_BYTES[type]
  if (needed === undefined || length < needed || d + needed > b.length) return unreadable

  const header = (width: number, height: number, animated = false) =>
    ok<ImageHeader>({ format: 'webp', width, height, animated, exifOrientation: 1 })

  if (type === 'VP8 ') {
    if (!matches(b, d + 3, [0x9d, 0x01, 0x2a])) return unreadable
    const w = u16(b, d + 6, true)
    const h = u16(b, d + 8, true)
    return w === undefined || h === undefined ? unreadable : header(w & 0x3fff, h & 0x3fff)
  }
  if (type === 'VP8L') {
    const bits = u32(b, d + 1, true)
    if (u8(b, d) !== 0x2f || bits === undefined) return unreadable
    return header((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)
  }
  if (type === 'VP8X') {
    const flags = u8(b, d)
    const w = u24(b, d + 4)
    const h = u24(b, d + 7)
    if (flags === undefined || w === undefined || h === undefined) return unreadable
    return header(w + 1, h + 1, (flags & VP8X_ANIMATION) !== 0)
  }
  return unreadable
}

function u24(b: Uint8Array, o: number): number | undefined {
  const low = u16(b, o, true)
  const high = u8(b, o + 2)
  return low === undefined || high === undefined ? undefined : low | (high << 16)
}
