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
  const { frames, firstRight, firstBottom } = scanImageDescriptors(b, 13 + globalTable)
  // Without the first frame's bounds the decoded size is unknown, so refuse before decoding (AC-09).
  if (frames === 0) return err(appError('UNREADABLE'))
  // A frame may extend past the logical screen, and decoders size the bitmap to cover it (AC-09).
  return ok({
    format: 'gif',
    width: Math.max(width, firstRight),
    height: Math.max(height, firstBottom),
    animated: frames >= 2,
    exifOrientation: 1,
  })
}

interface DescriptorScan {
  frames: number
  firstRight: number
  firstBottom: number
}

/**
 * Walks blocks by their length fields only — never decodes — and stops at 2 frames or at the end.
 * Records where the first frame ends, from its left/top offset plus its width/height.
 */
function scanImageDescriptors(b: Uint8Array, start: number): DescriptorScan {
  let o = start
  const found: DescriptorScan = { frames: 0, firstRight: 0, firstBottom: 0 }
  for (let i = 0; i < MAX_BLOCKS && found.frames < 2; i++) {
    const introducer = u8(b, o)
    if (introducer === IMAGE_DESCRIPTOR) {
      const packed = u8(b, o + 9)
      if (packed === undefined) return found
      if (found.frames === 0) {
        found.firstRight = (u16(b, o + 1, true) ?? 0) + (u16(b, o + 5, true) ?? 0)
        found.firstBottom = (u16(b, o + 3, true) ?? 0) + (u16(b, o + 7, true) ?? 0)
      }
      found.frames++
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
