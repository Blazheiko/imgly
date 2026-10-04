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
  'nef',
  'arw',
  'orf',
  'rw2',
  'raf',
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
