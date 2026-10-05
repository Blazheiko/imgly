import type { ImageHeader } from '../image-header'
import { appError, err, ok, type AppError, type Result } from '../result'
import { SIZE_CEILING_BYTES, SIZE_CEILING_PIXELS } from './constants'

/** Refuses an image above the size ceiling from its declared size, before any decode (AC-09). */
export function checkOpenPolicy(header: ImageHeader): Result<ImageHeader, AppError> {
  const pixels = header.width * header.height
  if (pixels <= SIZE_CEILING_PIXELS) return ok(header)
  return err(
    appError('TOO_LARGE', {
      width: header.width,
      height: header.height,
      megapixels: toMegapixels(pixels),
      ceilingMegapixels: toMegapixels(SIZE_CEILING_PIXELS),
    }),
  )
}

/** Refuses a file above the byte ceiling from its size alone, before reading any of it (AC-09). */
export function checkFileBytes(bytes: number): Result<number, AppError> {
  if (bytes <= SIZE_CEILING_BYTES) return ok(bytes)
  return err(
    appError('TOO_LARGE', {
      megabytes: Math.ceil(bytes / 1_000_000),
      ceilingMegabytes: SIZE_CEILING_BYTES / 1_000_000,
    }),
  )
}

/** One decimal, rounded up: 100.01 MP reads 100.1 MP, never the ceiling's own 100 MP. */
function toMegapixels(pixels: number): number {
  return Math.ceil(pixels / 100_000) / 10
}
