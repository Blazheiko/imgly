import { appError, err, ok, type AppError, type Result } from '../result'
import { matches, u16, u32 } from './reader'
import type { ExifOrientation, ImageHeader } from './types'

const MAX_MARKERS = 4096
const MAX_IFD_ENTRIES = 512
const ORIENTATION_TAG = 0x0112
const SOS = 0xda

export function isJpeg(b: Uint8Array): boolean {
  return matches(b, 0, [0xff, 0xd8, 0xff])
}

/** SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC). */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
}

/** Markers that stand alone, without a length field: TEM and RST0–RST7. */
function isStandalone(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)
}

export function parseJpeg(b: Uint8Array): Result<ImageHeader, AppError> {
  const unreadable = err(appError('UNREADABLE'))
  let orientation: ExifOrientation = 1
  let o = 2

  for (let i = 0; i < MAX_MARKERS; i++) {
    if (b[o] !== 0xff) return unreadable
    while (b[o] === 0xff) o++ // fill bytes
    const marker = b[o]
    if (marker === undefined) return unreadable
    o++
    if (isStandalone(marker)) continue
    if (marker === SOS || marker === 0xd9) return unreadable

    const length = u16(b, o)
    if (length === undefined || length < 2 || o + length > b.length) return unreadable

    if (isStartOfFrame(marker)) {
      const height = u16(b, o + 3)
      const width = u16(b, o + 5)
      if (width === undefined || height === undefined) return unreadable
      return ok({ format: 'jpeg', width, height, animated: false, exifOrientation: orientation })
    }
    if (marker === 0xe1 && orientation === 1) {
      orientation = readExifOrientation(b.subarray(o + 2, o + length))
    }
    o += length
  }
  return unreadable
}

/** Reads tag 0x0112 from IFD0 of an APP1 "Exif" payload; 1 when missing or out of range. */
function readExifOrientation(app1: Uint8Array): ExifOrientation {
  if (!matches(app1, 0, 'Exif\0\0')) return 1
  const tiff = app1.subarray(6)
  const le = matches(tiff, 0, 'II')
  if (!le && !matches(tiff, 0, 'MM')) return 1
  if (u16(tiff, 2, le) !== 42) return 1

  const ifd = u32(tiff, 4, le)
  if (ifd === undefined) return 1
  const count = u16(tiff, ifd, le)
  if (count === undefined) return 1

  for (let i = 0; i < Math.min(count, MAX_IFD_ENTRIES); i++) {
    const entry = ifd + 2 + i * 12
    const tag = u16(tiff, entry, le)
    if (tag === undefined) return 1
    if (tag !== ORIENTATION_TAG) continue
    const value = u16(tiff, entry + 8, le)
    return value !== undefined && value >= 1 && value <= 8 ? (value as ExifOrientation) : 1
  }
  return 1
}
