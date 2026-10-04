import { appError, err, ok, type AppError, type Result } from '../result'
import { ascii, matches, u32 } from './reader'
import type { ImageHeader } from './types'

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const MAX_CHUNKS = 4096

export function isPng(b: Uint8Array): boolean {
  return matches(b, 0, SIGNATURE)
}

/** IHDR gives the size; an `acTL` chunk before the first `IDAT` makes it an APNG. */
export function parsePng(b: Uint8Array): Result<ImageHeader, AppError> {
  if (!matches(b, 12, 'IHDR')) return err(appError('UNREADABLE'))
  const width = u32(b, 16)
  const height = u32(b, 20)
  if (width === undefined || height === undefined) return err(appError('UNREADABLE'))

  return ok({ format: 'png', width, height, animated: hasAnimationControl(b), exifOrientation: 1 })
}

function hasAnimationControl(b: Uint8Array): boolean {
  let o = 8
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const length = u32(b, o)
    const type = ascii(b, o + 4, 4)
    if (length === undefined || type === undefined) return false
    if (type === 'acTL') return true
    if (type === 'IDAT' || type === 'IEND') return false
    o += 12 + length
  }
  return false
}
