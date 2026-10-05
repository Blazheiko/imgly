import { appError, err, ok, type AppError, type Result } from '../result'
import { matches, u16, u8 } from './reader'
import type { ImageHeader } from './types'

const IMAGE_DESCRIPTOR = 0x2c
const EXTENSION = 0x21

export function isGif(b: Uint8Array): boolean {
  return matches(b, 0, 'GIF87a') || matches(b, 0, 'GIF89a')
}

export function parseGif(b: Uint8Array): Result<ImageHeader, AppError> {
  const width = u16(b, 6, true)
  const height = u16(b, 8, true)
  if (width === undefined || height === undefined || u8(b, 10) === undefined) {
    return err(appError('UNREADABLE'))
  }
  const walk = startGifWalk(b)
  // Without the first frame's bounds the decoded size is unknown, so refuse before decoding (AC-09).
  if (walk.frames === 0) return err(appError('UNREADABLE'))
  // A frame may extend past the logical screen, and decoders size the bitmap to cover it (AC-09).
  return ok({
    format: 'gif',
    width: Math.max(width, walk.firstRight),
    height: Math.max(height, walk.firstBottom),
    animated: walk.frames >= 2,
    exifOrientation: 1,
  })
}

/**
 * Where a walk over a GIF's blocks stands. It reads length fields only, never pixel data, so it can
 * stop at the end of the bytes it was given and resume from `offset` with the next ones (feature
 * ADR 0002: animation detection may skip further than the header window).
 */
export interface GifWalk {
  /** File offset of the next byte the walk needs: a block introducer or a sub-block length. */
  offset: number
  /** Whether `offset` is inside an extension's or a frame's sub-blocks. */
  inSubBlocks: boolean
  frames: number
  /** Where the first frame ends, from its left/top offset plus its width/height. */
  firstRight: number
  firstBottom: number
  /** Nothing more to learn: a second frame, the trailer, or a byte that starts no block. */
  done: boolean
}

/** Walks the blocks of a GIF's first bytes, from just after its global colour table. */
export function startGifWalk(b: Uint8Array): GifWalk {
  const packed = u8(b, 10) ?? 0 // parseGif has already refused a truncated screen descriptor
  const globalTable = packed & 0x80 ? 3 * (1 << ((packed & 0x07) + 1)) : 0
  const start: GifWalk = {
    offset: 13 + globalTable,
    inSubBlocks: false,
    frames: 0,
    firstRight: 0,
    firstBottom: 0,
    done: false,
  }
  return continueGifWalk(start, b.subarray(start.offset))
}

/** The most bytes one step reads: an image descriptor, from its introducer to its packed field. */
export const GIF_WALK_MIN_CHUNK = 10

/**
 * Resumes a walk over `chunk`, the file's bytes from `walk.offset`. Stops at 2 frames or when it
 * needs a byte past the chunk; every step advances, so the work is bounded by the chunk's length.
 * A chunk of at least `GIF_WALK_MIN_CHUNK` bytes always makes progress, so a walk that doesn't
 * advance means the file ends inside a block.
 */
export function continueGifWalk(walk: GifWalk, chunk: Uint8Array): GifWalk {
  const w = { ...walk }
  let o = 0
  while (!w.done) {
    if (w.inSubBlocks) {
      const size = u8(chunk, o)
      if (size === undefined) break
      o += 1 + size
      if (size === 0) w.inSubBlocks = false
      continue
    }
    const introducer = u8(chunk, o)
    if (introducer === undefined) break
    if (introducer === IMAGE_DESCRIPTOR) {
      const packed = u8(chunk, o + GIF_WALK_MIN_CHUNK - 1)
      if (packed === undefined) break
      if (w.frames === 0) {
        w.firstRight = (u16(chunk, o + 1, true) ?? 0) + (u16(chunk, o + 5, true) ?? 0)
        w.firstBottom = (u16(chunk, o + 3, true) ?? 0) + (u16(chunk, o + 7, true) ?? 0)
      }
      w.frames++
      w.done = w.frames >= 2
      const localTable = packed & 0x80 ? 3 * (1 << ((packed & 0x07) + 1)) : 0
      o += 10 + localTable + 1 // +1 for the LZW minimum code size
      w.inSubBlocks = true
    } else if (introducer === EXTENSION) {
      o += 2
      w.inSubBlocks = true
    } else {
      w.done = true // trailer, or a byte that starts no block
    }
  }
  return { ...w, offset: walk.offset + o }
}
