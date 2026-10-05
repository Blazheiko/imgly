/**
 * Removes the metadata blocks some browser encoders add on their own (WebKit writes Exif and IPTC),
 * so an Export carries pixels only (AC-16). Technical blocks are kept: JFIF, an sRGB marker or
 * profile, pixel density. Returns the input itself when there is nothing to remove or the
 * container is not recognised.
 */
export function stripMetadata(data: Uint8Array): Uint8Array {
  if (data[0] === 0xff && data[1] === 0xd8) return stripJpeg(data)
  if (startsWith(data, 0, [0x89, 0x50, 0x4e, 0x47])) return stripPng(data)
  if (startsWith(data, 0, ascii('RIFF')) && startsWith(data, 8, ascii('WEBP')))
    return stripWebp(data)
  return data
}

/** APP1 (Exif, XMP), APP13 (IPTC), COM. */
const JPEG_METADATA = new Set([0xe1, 0xed, 0xfe])
const PNG_METADATA = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'])
const WEBP_METADATA = new Map([
  ['EXIF', 0x08],
  ['XMP ', 0x04],
])

function stripJpeg(data: Uint8Array): Uint8Array {
  const keep: Uint8Array[] = [data.subarray(0, 2)]
  let removed = false
  let at = 2
  // Segments up to the start of scan; everything from SOS on is entropy-coded image data.
  while (at + 4 <= data.length && data[at] === 0xff && data[at + 1] !== 0xda) {
    const end = at + 2 + ((data[at + 2]! << 8) | data[at + 3]!)
    if (JPEG_METADATA.has(data[at + 1]!)) removed = true
    else keep.push(data.subarray(at, end))
    at = end
  }
  if (!removed) return data
  keep.push(data.subarray(at))
  return join(keep)
}

function stripPng(data: Uint8Array): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const keep: Uint8Array[] = [data.subarray(0, 8)]
  let removed = false
  for (let at = 8; at + 12 <= data.length;) {
    const end = at + 12 + view.getUint32(at)
    if (PNG_METADATA.has(text(data, at + 4, 4))) removed = true
    else keep.push(data.subarray(at, end))
    at = end
  }
  return removed ? join(keep) : data
}

function stripWebp(data: Uint8Array): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const keep: Uint8Array[] = []
  let clearFlags = 0
  for (let at = 12; at + 8 <= data.length;) {
    const length = view.getUint32(at + 4, true)
    const end = Math.min(data.length, at + 8 + length + (length % 2))
    const flag = WEBP_METADATA.get(text(data, at, 4))
    if (flag === undefined) keep.push(data.subarray(at, end))
    else clearFlags |= flag
    at = end
  }
  if (clearFlags === 0) return data
  const body = join([data.subarray(8, 12), ...keep])
  const out = join([data.subarray(0, 4), new Uint8Array(4), body])
  new DataView(out.buffer).setUint32(4, body.length, true)
  if (text(out, 12, 4) === 'VP8X') out[20] = out[20]! & ~clearFlags
  return out
}

function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0))
const text = (data: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...data.subarray(at, at + length))
const startsWith = (data: Uint8Array, at: number, prefix: number[]) =>
  prefix.every((byte, i) => data[at + i] === byte)
