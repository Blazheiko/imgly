/** Formats the editor can open. Everything else is refused by name or as not an image. */
export type ImageFormat = 'jpeg' | 'png' | 'gif' | 'webp' | 'avif' | 'heic'

/** EXIF orientation 1–8; 1 means the stored pixels are already upright. */
export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/** What the first bytes of a file declare, read before any pixel is decoded (feature ADR 0002). */
export interface ImageHeader {
  format: ImageFormat
  /** Stored width, before any EXIF orientation is applied. */
  width: number
  /** Stored height, before any EXIF orientation is applied. */
  height: number
  animated: boolean
  exifOrientation: ExifOrientation
}

/** The parser never looks further than this; declared sizes beyond it mean UNREADABLE. */
export const HEADER_WINDOW_BYTES = 1024 * 1024

/** Display names used in the UNSUPPORTED_FORMAT notice (AC-07). */
export type RefusedFormatName =
  'SVG' | 'BMP' | 'ICO' | 'TIFF or camera RAW' | 'camera RAW' | 'PSD' | 'HEIC/HEIF'
