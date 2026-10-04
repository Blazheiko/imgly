import { appError, err, ok, type AppError, type Result } from '../result'
import { matches, u16, u8 } from './reader'
import type { ImageHeader } from './types'

const MAX_BLOCKS = 1 << 16
const IMAGE_DESCRIPTOR = 0x2c
const EXTENSION = 0x21

export function isGif(b: Uint8Array): boolean {
  return matches(b, 0, 'GIF87a') || matches(b, 0, 'GIF89a')
}

export function parseGif(b: Uint8Array): Result<ImageHeader, AppError> {
  const width = u16(b, 6, true)
  const height = u16(b, 8, true)
  const packed = u8(b, 10)
  if (width === undefined || height === undefined || packed === undefined) {
    return err(appError('UNREADABLE'))
  }
  const globalTable = packed & 0x80 ? 3 * (1 << ((packed & 0x07) + 1)) : 0
  const animated = countImageDescriptors(b, 13 + globalTable) >= 2
  return ok({ format: 'gif', width, height, animated, exifOrientation: 1 })
}

/** Walks blocks by their length fields only — never decodes — and stops at 2 or at the end. */
function countImageDescriptors(b: Uint8Array, start: number): number {
  let o = start
  let found = 0
  for (let i = 0; i < MAX_BLOCKS && found < 2; i++) {
    const introducer = u8(b, o)
    if (introducer === IMAGE_DESCRIPTOR) {
      const packed = u8(b, o + 9)
      if (packed === undefined) return found
      found++
      const localTable = packed & 0x80 ? 3 * (1 << ((packed & 0x07) + 1)) : 0
      o = skipSubBlocks(b, o + 10 + localTable + 1) // +1 for the LZW minimum code size
    } else if (introducer === EXTENSION) {
      o = skipSubBlocks(b, o + 2)
    } else {
      return found // trailer, junk, or end of window
    }
    if (o < 0) return found
  }
  return found
}

/** Returns the offset after the zero-length terminator, or -1 if the window ends first. */
function skipSubBlocks(b: Uint8Array, start: number): number {
  let o = start
  for (let i = 0; i < MAX_BLOCKS; i++) {
    const size = u8(b, o)
    if (size === undefined) return -1
    o += 1 + size
    if (size === 0) return o
  }
  return -1
}
