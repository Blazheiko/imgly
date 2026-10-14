import { pngFile, pngScanlines } from '@/core'

/**
 * Straight RGBA to a PNG Blob without a canvas encoder. Firefox's `convertToBlob` un-premultiplies
 * with a different rounding than `getImageData`, so a semi-transparent pixel it writes no longer
 * matches the pixel the Export read before the save (gallery QG-2); these bytes are written as given.
 */
export async function encodeRgbaPng(
  width: number,
  height: number,
  rgba: Uint8Array,
): Promise<Blob> {
  const raw = pngScanlines(width, height, rgba)
  const deflated = new Blob([raw as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate'))
  const zlib = new Uint8Array(await new Response(deflated).arrayBuffer())
  return new Blob([pngFile(width, height, zlib) as BlobPart], { type: 'image/png' })
}
