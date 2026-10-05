/** Rows read per `getImageData` call, so the scan holds at most one strip of pixels at a time. */
const STRIP_ROWS = 256

/**
 * Whether any pixel of `bitmap` is not fully opaque (export AC-15). Reads the bitmap back in row
 * strips and stops at the first such pixel.
 */
export function hasTransparentPixel(
  bitmap: ImageBitmap,
  createCanvas: (width: number, height: number) => OffscreenCanvas,
): boolean {
  const { width, height } = bitmap
  const ctx = createCanvas(width, height).getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(bitmap, 0, 0)
  for (let y = 0; y < height; y += STRIP_ROWS) {
    const { data } = ctx.getImageData(0, y, width, Math.min(STRIP_ROWS, height - y))
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! < 255) return true
    }
  }
  return false
}
