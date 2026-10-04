import { appError, err, type AppError, type Result } from '../result'
import { isGif, parseGif } from './gif'
import { isJpeg, parseJpeg } from './jpeg'
import { isPng, parsePng } from './png'
import { detectRefusedFormat } from './refused'
import { HEADER_WINDOW_BYTES, type ImageHeader } from './types'

export * from './types'

/**
 * Judges a file by its first bytes (feature ADR 0002): the format, declared size, animation and
 * EXIF orientation, or the named refusal. Reads at most `HEADER_WINDOW_BYTES` and never throws.
 */
export function sniffImageHeader(bytes: Uint8Array): Result<ImageHeader, AppError> {
  const b = bytes.subarray(0, HEADER_WINDOW_BYTES)
  const result = parseSupported(b)
  if (result === undefined) {
    const format = detectRefusedFormat(b)
    return err(format ? appError('UNSUPPORTED_FORMAT', { format }) : appError('NOT_AN_IMAGE'))
  }
  if (result.ok && (result.value.width === 0 || result.value.height === 0)) {
    return err(appError('UNREADABLE'))
  }
  return result
}

function parseSupported(b: Uint8Array): Result<ImageHeader, AppError> | undefined {
  if (isJpeg(b)) return parseJpeg(b)
  if (isPng(b)) return parsePng(b)
  if (isGif(b)) return parseGif(b)
  return undefined
}
