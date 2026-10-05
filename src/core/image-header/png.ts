import { appError, err, ok, type AppError, type Result } from '../result'
import { crc32 } from './crc32'
import { ascii, matches, u32 } from './reader'
import type { ImageHeader } from './types'

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const MAX_CHUNKS = 4096

export function isPng(b: Uint8Array): boolean {
  return matches(b, 0, SIGNATURE)
}

/**
 * IHDR gives the size; an `acTL` chunk before the first `IDAT` makes it an APNG. Every chunk that
 * lies fully inside the window must match its CRC: a damaged file is UNREADABLE (AC-08) on every
 * engine, even those whose decoder would turn it into a blank image.
 */
export function parsePng(b: Uint8Array): Result<ImageHeader, AppError> {
  const unreadable = err(appError('UNREADABLE'))
  if (!matches(b, 12, 'IHDR')) return unreadable
  const width = u32(b, 16)
  const height = u32(b, 20)
  if (width === undefined || height === undefined) return unreadable

  let animated = false
  let beforeImageData = true
  let o = 8
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const length = u32(b, o)
    const type = ascii(b, o + 4, 4)
    if (length === undefined || type === undefined) break
    const end = o + 12 + length
    if (end > b.length) break // runs past the window: not checked
    if (crc32(b, o + 4, o + 8 + length) !== u32(b, o + 8 + length)) return unreadable
    if (type === 'IDAT') beforeImageData = false
    if (type === 'acTL' && beforeImageData) animated = true
    if (type === 'IEND') break
    o = end
  }
  return ok({ format: 'png', width, height, animated, exifOrientation: 1 })
}
