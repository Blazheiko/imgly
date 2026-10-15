import { pngRgbaParts, pngUnfilter } from '@/core'

/** A stored PNG read as straight RGBA, or why not. */
export type ReadPng =
  { width: number; height: number; rgba: Uint8Array<ArrayBuffer> } | 'other' | 'damaged'

/**
 * A PNG in the shape `encodeRgbaPng` writes, read back to its straight bytes without the browser's
 * decoder. WebKit on Linux does not keep `premultiplyAlpha: 'none'` through `createImageBitmap` and
 * `drawImage`, so a semi-transparent pixel it decodes no longer matches the pixel that was stored
 * (gallery QG-2). Any other PNG is `'other'`, for the browser to decode.
 */
export async function readRgbaPng(blob: Blob): Promise<ReadPng> {
  const parts = pngRgbaParts(new Uint8Array(await blob.arrayBuffer()))
  if (!parts) return 'other'
  try {
    const inflated = new Blob([parts.zlib as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('deflate'))
    const raw = new Uint8Array(await new Response(inflated).arrayBuffer())
    const rgba = pngUnfilter(parts.width, parts.height, raw)
    return rgba ? { width: parts.width, height: parts.height, rgba } : 'damaged'
  } catch {
    return 'damaged'
  }
}
