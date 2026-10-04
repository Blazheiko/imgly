/**
 * Byte-array builders for the header-parser tests. Test-only: nothing in production imports this.
 * Each builder writes just enough of the format for the parser to read, never real pixel data.
 */

export function bytes(...parts: (number[] | Uint8Array | string)[]): Uint8Array {
  const chunks = parts.map((p) =>
    typeof p === 'string' ? Uint8Array.from(p, (c) => c.charCodeAt(0)) : Uint8Array.from(p),
  )
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

export const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff]
export const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff]
export const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
export const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]

// ---- JPEG ---------------------------------------------------------------------------------------

function segment(marker: number, payload: Uint8Array): Uint8Array {
  return bytes([0xff, marker], be16(payload.length + 2), payload)
}

/** An APP1 Exif segment with IFD0 holding one Orientation (0x0112) entry. */
export function exifApp1(orientation: number, byteOrder: 'II' | 'MM' = 'MM'): Uint8Array {
  const le = byteOrder === 'II'
  const u16 = le ? le16 : be16
  const u32 = le ? le32 : be32
  const tiff = bytes(
    byteOrder,
    u16(42),
    u32(8), // IFD0 right after the TIFF header
    u16(1), // one entry
    u16(0x0112),
    u16(3), // SHORT
    u32(1),
    u16(orientation),
    [0, 0],
    u32(0), // no next IFD
  )
  return segment(0xe1, bytes('Exif', [0, 0], tiff))
}

export function jpeg(opts: {
  width: number
  height: number
  sofMarker?: number
  before?: Uint8Array[]
  truncateBeforeSof?: boolean
}): Uint8Array {
  const sof = segment(
    opts.sofMarker ?? 0xc0,
    bytes([8], be16(opts.height), be16(opts.width), [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]),
  )
  const app0 = segment(0xe0, bytes('JFIF', [0, 1, 1, 0, 0, 1, 0, 1, 0, 0]))
  const dqt = segment(0xdb, new Uint8Array(65))
  const head = bytes([0xff, 0xd8], app0, ...(opts.before ?? []), dqt)
  if (opts.truncateBeforeSof) return head
  return bytes(head, sof, segment(0xda, new Uint8Array(10)), [0x12, 0x34, 0xff, 0xd9])
}

// ---- PNG ----------------------------------------------------------------------------------------

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function pngChunk(type: string, data: Uint8Array = new Uint8Array(0)): Uint8Array {
  return bytes(be32(data.length), type, data, [0, 0, 0, 0]) // CRC is never checked by the parser
}

export function png(opts: { width: number; height: number; animated?: boolean }): Uint8Array {
  const ihdr = pngChunk('IHDR', bytes(be32(opts.width), be32(opts.height), [8, 6, 0, 0, 0]))
  const actl = opts.animated ? [pngChunk('acTL', bytes(be32(2), be32(0)))] : []
  return bytes(PNG_SIGNATURE, ihdr, ...actl, pngChunk('IDAT', new Uint8Array(4)), pngChunk('IEND'))
}

// ---- GIF ----------------------------------------------------------------------------------------

function gifFrame(width: number, height: number): Uint8Array {
  const gce = bytes([0x21, 0xf9, 4, 0, 10, 0, 0, 0])
  const descriptor = bytes([0x2c], le16(0), le16(0), le16(width), le16(height), [0])
  const data = bytes([2], [3, 0x4c, 0x01, 0x00], [0])
  return bytes(gce, descriptor, data)
}

export function gif(opts: { width: number; height: number; frames?: number }): Uint8Array {
  const screen = bytes('GIF89a', le16(opts.width), le16(opts.height), [0x80, 0, 0])
  const palette = new Uint8Array(6) // 2-entry global colour table
  const netscape = bytes([0x21, 0xff, 11], 'NETSCAPE2.0', [3, 1, 0, 0, 0])
  const frames = Array.from({ length: opts.frames ?? 1 }, () => gifFrame(opts.width, opts.height))
  return bytes(screen, palette, netscape, ...frames, [0x3b])
}
