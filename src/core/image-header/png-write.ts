import { crc32 } from './crc32'

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * Straight 8-bit RGBA as PNG scanlines, before compression: each row is filter byte 0 (None)
 * followed by the row's bytes unchanged. The bytes are never premultiplied, so a straight value
 * written here decodes to the same value (gallery QG-2).
 */
export function pngScanlines(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const row = width * 4
  if (rgba.length !== row * height) throw new Error('rgba length does not match the size')
  const out = new Uint8Array(height * (row + 1))
  for (let y = 0; y < height; y++) out.set(rgba.subarray(y * row, (y + 1) * row), y * (row + 1) + 1)
  return out
}

/** A PNG file (8-bit RGBA, no interlace) around the zlib stream of `pngScanlines`. */
export function pngFile(width: number, height: number, zlib: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr.set([8, 6, 0, 0, 0], 8) // bit depth 8, colour type 6 (RGBA), deflate, filter 0, no interlace
  const chunks = [chunk('IHDR', ihdr), chunk('IDAT', zlib), chunk('IEND', new Uint8Array())]
  const out = new Uint8Array(SIGNATURE.length + chunks.reduce((n, c) => n + c.length, 0))
  out.set(SIGNATURE, 0)
  let o = SIGNATURE.length
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out, 4, 8 + data.length))
  return out
}
