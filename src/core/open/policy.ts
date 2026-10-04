import type { ImageHeader } from '../image-header'
import { appError, err, ok, type AppError, type Result } from '../result'
import { SIZE_CEILING_PIXELS } from './constants'

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

function toMegapixels(pixels: number): number {
  return Math.round(pixels / 100_000) / 10
}
