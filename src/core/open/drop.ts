import type { AppError } from '../result'

/** Extensions of formats the editor opens or names when it refuses them (AC-07). */
const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'jfif',
  'png',
  'apng',
  'gif',
  'webp',
  'avif',
  'heic',
  'heif',
  'svg',
  'bmp',
  'ico',
  'tif',
  'tiff',
  'psd',
  'dng',
  'cr2',
  'cr3',
  'crw',
  'nef',
  'arw',
  'orf',
  'rw2',
  'raf',
  'x3f',
])

/**
 * Whether a dropped file presents itself as an image, by MIME type or extension (AC-03, AC-08).
 * Such a file that turns out not to be one gets the unreadable reason, not "Only image files".
 */
export function looksLikeImageFile(file: { name: string; type: string }): boolean {
  if (file.type.startsWith('image/')) return true
  const dot = file.name.lastIndexOf('.')
  return dot > 0 && IMAGE_EXTENSIONS.has(file.name.slice(dot + 1).toLowerCase())
}

/**
 * Whether a dropped file's refusal is an image file's reason (AC-03, AC-04). Refusals judged from
 * the content always are, except NOT_AN_IMAGE. The byte ceiling and a refused read fire before the
 * content is looked at, so like NOT_AN_IMAGE they count only for a file that looks like an image.
 */
export function isImageRefusal(error: AppError, file: { name: string; type: string }): boolean {
  const judgedBeforeContent =
    error.code === 'NOT_AN_IMAGE' ||
    error.code === 'FILE_NOT_PERMITTED' ||
    (error.code === 'TOO_LARGE' && error.details?.megabytes !== undefined)
  return !judgedBeforeContent || looksLikeImageFile(file)
}
