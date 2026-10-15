import { crc32 } from './crc32'

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** The size and the joined IDAT zlib stream of an 8-bit RGBA, non-interlaced PNG. */
export interface PngRgbaParts {
  width: number
  height: number
  zlib: Uint8Array
}

/**
 * Splits a PNG of the shape `pngFile` writes (8-bit RGBA, no interlace) into its size and zlib
 * stream, every chunk's CRC checked. Any other shape, or bytes that are not a whole PNG, is
 * `undefined`: the caller leaves those to the browser's decoder.
 */
export function pngRgbaParts(bytes: Uint8Array): PngRgbaParts | undefined {
  if (bytes.length < SIGNATURE.length || SIGNATURE.some((b, i) => bytes[i] !== b)) return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0
  let height = 0
  const idat: Uint8Array[] = []
  for (let o = SIGNATURE.length; o + 12 <= bytes.length;) {
    const length = view.getUint32(o)
    const end = o + 12 + length
    if (end > bytes.length) return undefined
    if (crc32(bytes, o + 4, o + 8 + length) !== view.getUint32(o + 8 + length)) return undefined
    const type = String.fromCharCode(...bytes.subarray(o + 4, o + 8))
    const data = bytes.subarray(o + 8, o + 8 + length)
    if (type === 'IHDR') {
      if (length !== 13) return undefined
      width = view.getUint32(o + 8)
      height = view.getUint32(o + 12)
      // bit depth 8, colour type 6 (RGBA), deflate, filter method 0, no interlace
      if ([8, 6, 0, 0, 0].some((b, i) => data[8 + i] !== b)) return undefined
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      if (width === 0 || height === 0 || idat.length === 0) return undefined
      const zlib = new Uint8Array(idat.reduce((n, d) => n + d.length, 0))
      let z = 0
      for (const d of idat) {
        zlib.set(d, z)
        z += d.length
      }
      return { width, height, zlib }
    }
    o = end
  }
  return undefined
}

/**
 * Inflated 8-bit RGBA scanlines back to straight RGBA, undoing each row's filter (types 0–4).
 * `undefined` for an unknown filter type or a length that does not match the size.
 */
export function pngUnfilter(
  width: number,
  height: number,
  raw: Uint8Array,
): Uint8Array<ArrayBuffer> | undefined {
  const row = width * 4
  if (raw.length !== height * (row + 1)) return undefined
  const out = new Uint8Array(row * height)
  for (let y = 0; y < height; y++) {
    const type = raw[y * (row + 1)]!
    const src = y * (row + 1) + 1
    const at = y * row
    for (let i = 0; i < row; i++) {
      const a = i >= 4 ? out[at + i - 4]! : 0
      const b = y > 0 ? out[at - row + i]! : 0
      const c = i >= 4 && y > 0 ? out[at - row + i - 4]! : 0
      let predictor: number
      if (type === 0) predictor = 0
      else if (type === 1) predictor = a
      else if (type === 2) predictor = b
      else if (type === 3) predictor = (a + b) >> 1
      else if (type === 4) predictor = paeth(a, b, c)
      else return undefined
      out[at + i] = (raw[src + i]! + predictor) & 0xff
    }
  }
  return out
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}
