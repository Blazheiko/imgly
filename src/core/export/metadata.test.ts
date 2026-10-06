import { describe, expect, it } from 'vitest'
import { pngChunk, PNG_SIGNATURE, bytes as concat, be32 } from '../image-header/test-fixtures'
import { sniffImageHeader } from '../image-header'
import { stripMetadata } from './index'

const segment = (marker: number, body: number[] | Uint8Array | string) => {
  const payload = typeof body === 'string' ? new TextEncoder().encode(body) : Uint8Array.from(body)
  const length = payload.length + 2
  return concat([0xff, marker, length >> 8, length & 0xff], payload)
}

function jpegWith(...extra: Uint8Array[]) {
  return concat(
    [0xff, 0xd8],
    segment(0xe0, 'JFIF\0\x01\x01\0\0H\0H\0\0'),
    ...extra,
    segment(0xdb, new Uint8Array(65)),
    segment(0xc0, [8, 0, 4, 0, 4, 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]),
    segment(0xda, new Uint8Array(10)),
    [0x12, 0x34, 0xff, 0xd9],
  )
}

/** Segment markers before SOS, in order. */
function jpegMarkers(data: Uint8Array): number[] {
  const markers: number[] = []
  for (let at = 2; data[at] === 0xff && data[at + 1] !== 0xda;) {
    markers.push(data[at + 1]!)
    at += 2 + ((data[at + 2]! << 8) | data[at + 3]!)
  }
  return markers
}

function pngWith(...extra: Uint8Array[]) {
  return concat(
    PNG_SIGNATURE,
    pngChunk('IHDR', Uint8Array.from([...be32(4), ...be32(4), 8, 6, 0, 0, 0])),
    pngChunk('sRGB', Uint8Array.from([0])),
    ...extra,
    pngChunk('IDAT', Uint8Array.from([1, 2, 3])),
    pngChunk('IEND'),
  )
}

function pngTypes(data: Uint8Array): string[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const types: string[] = []
  for (let at = 8; at + 8 <= data.length; at += 12 + view.getUint32(at)) {
    types.push(new TextDecoder().decode(data.subarray(at + 4, at + 8)))
  }
  return types
}

const le32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]
const riffChunk = (type: string, payload: number[]) =>
  concat(type, le32(payload.length), payload, payload.length % 2 ? [0] : [])

function webpWith(flags: number, ...extra: Uint8Array[]) {
  // VP8X: flags, 3 reserved bytes, canvas width-1 and height-1 (24-bit LE).
  const vp8x = riffChunk('VP8X', [flags, 0, 0, 0, 3, 0, 0, 3, 0, 0])
  const vp8l = riffChunk('VP8L', [0x2f, 3, 0xc0, 0, 0, 0x07, 0x10, 0x11])
  const body = concat('WEBP', vp8x, vp8l, ...extra)
  return concat('RIFF', le32(body.length), body)
}

function riffTypes(data: Uint8Array): string[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const types: string[] = []
  for (let at = 12; at + 8 <= data.length;) {
    const length = view.getUint32(at + 4, true)
    types.push(new TextDecoder().decode(data.subarray(at, at + 4)))
    at += 8 + length + (length % 2)
  }
  return types
}

describe('stripMetadata (AC-16)', () => {
  it('removes JPEG Exif/XMP, IPTC and comments, keeping JFIF, ICC and the image', () => {
    const input = jpegWith(
      segment(0xe1, 'Exif\0\0MM\0*'),
      segment(0xe1, 'http://ns.adobe.com/xap/1.0/\0<x/>'),
      segment(0xed, 'Photoshop 3.0\x008BIM'),
      segment(0xfe, 'a comment'),
      segment(0xe2, 'ICC_PROFILE\0\x01\x01sRGB'),
    )
    const output = stripMetadata(input)
    expect(jpegMarkers(output)).toEqual([0xe0, 0xe2, 0xdb, 0xc0])
    expect(output.subarray(output.length - 14)).toEqual(input.subarray(input.length - 14))
    expect(sniffImageHeader(output)).toMatchObject({
      ok: true,
      value: { format: 'jpeg', width: 4, height: 4 },
    })
  })

  it('removes PNG eXIf, text and time chunks, keeping sRGB and the image', () => {
    const input = pngWith(
      pngChunk('eXIf', Uint8Array.from([0x4d, 0x4d, 0, 0x2a])),
      pngChunk('tEXt', new TextEncoder().encode('Author\0me')),
      pngChunk('zTXt', Uint8Array.from([1])),
      pngChunk('iTXt', Uint8Array.from([1])),
      pngChunk('tIME', new Uint8Array(7)),
    )
    const output = stripMetadata(input)
    expect(pngTypes(output)).toEqual(['IHDR', 'sRGB', 'IDAT', 'IEND'])
    expect(sniffImageHeader(output)).toMatchObject({
      ok: true,
      value: { format: 'png', width: 4, height: 4 },
    })
  })

  it('removes WebP EXIF and XMP chunks, clears their VP8X flags and fixes the RIFF size', () => {
    const input = webpWith(
      0x08 | 0x04 | 0x10,
      riffChunk('EXIF', [1, 2, 3]),
      riffChunk('XMP ', [4, 5]),
    )
    const output = stripMetadata(input)
    expect(riffTypes(output)).toEqual(['VP8X', 'VP8L'])
    expect(output[20]).toBe(0x10) // only the alpha flag is left
    const view = new DataView(output.buffer, output.byteOffset, output.byteLength)
    expect(view.getUint32(4, true)).toBe(output.length - 8)
  })

  it('returns a file with no metadata unchanged', () => {
    const png = pngWith()
    expect(stripMetadata(png)).toBe(png)
    const jpeg = jpegWith()
    expect(stripMetadata(jpeg)).toBe(jpeg)
  })

  it('leaves anything it does not recognise as is', () => {
    const other = Uint8Array.from([1, 2, 3, 4])
    expect(stripMetadata(other)).toBe(other)
  })
})
