import { describe, expect, it } from 'vitest'
import { HEADER_WINDOW_BYTES, sniffImageHeader } from './index'
import {
  be16,
  be32,
  bytes,
  exifApp1,
  gif,
  jpeg,
  le16,
  le32,
  png,
  PNG_SIGNATURE,
} from './test-fixtures'

function header(input: Uint8Array) {
  const result = sniffImageHeader(input)
  if (!result.ok) throw new Error(`expected a header, got ${JSON.stringify(result.error)}`)
  return result.value
}

function errorOf(input: Uint8Array) {
  const result = sniffImageHeader(input)
  if (result.ok) throw new Error(`expected an error, got ${JSON.stringify(result.value)}`)
  return result.error
}

describe('sniffImageHeader — JPEG', () => {
  it('reads the size from the first SOFn marker, upright by default', () => {
    expect(header(jpeg({ width: 6000, height: 4000 }))).toEqual({
      format: 'jpeg',
      width: 6000,
      height: 4000,
      animated: false,
      exifOrientation: 1,
    })
  })

  it.each([0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])(
    'accepts SOF marker 0x%s',
    (marker) => {
      expect(header(jpeg({ width: 640, height: 480, sofMarker: marker }))).toMatchObject({
        width: 640,
        height: 480,
      })
    },
  )

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('reads EXIF orientation %i (big-endian)', (orientation) => {
    const input = jpeg({ width: 10, height: 20, before: [exifApp1(orientation, 'MM')] })
    expect(header(input).exifOrientation).toBe(orientation)
  })

  it('reads EXIF orientation in little-endian TIFF order', () => {
    const input = jpeg({ width: 10, height: 20, before: [exifApp1(6, 'II')] })
    expect(header(input).exifOrientation).toBe(6)
  })

  it.each([0, 9, 0xffff])('treats out-of-range orientation %i as 1', (orientation) => {
    const input = jpeg({ width: 10, height: 20, before: [exifApp1(orientation)] })
    expect(header(input).exifOrientation).toBe(1)
  })

  it('is UNREADABLE when truncated before its SOFn marker', () => {
    expect(errorOf(jpeg({ width: 10, height: 20, truncateBeforeSof: true })).code).toBe(
      'UNREADABLE',
    )
  })

  it('is UNREADABLE when SOS comes before any SOFn', () => {
    const input = bytes([0xff, 0xd8, 0xff, 0xda], be16(4), [0, 0], [0xff, 0xd9])
    expect(errorOf(input).code).toBe('UNREADABLE')
  })

  it('is UNREADABLE when a segment length points past the end', () => {
    const input = bytes([0xff, 0xd8, 0xff, 0xe1], be16(0xfff0), new Uint8Array(20))
    expect(errorOf(input).code).toBe('UNREADABLE')
  })

  it('is UNREADABLE when the SOFn lies beyond the 1 MiB header window', () => {
    const big = bytes([0xff, 0xe2], be16(0xfffe), new Uint8Array(0xfffc))
    const padding = Array.from(
      { length: Math.ceil(HEADER_WINDOW_BYTES / big.length) + 1 },
      () => big,
    )
    expect(errorOf(jpeg({ width: 10, height: 20, before: padding })).code).toBe('UNREADABLE')
  })

  it('is UNREADABLE when the declared size is zero', () => {
    expect(errorOf(jpeg({ width: 0, height: 20 })).code).toBe('UNREADABLE')
  })
})

describe('sniffImageHeader — PNG and APNG', () => {
  it('reads the IHDR size', () => {
    expect(header(png({ width: 1920, height: 1080 }))).toEqual({
      format: 'png',
      width: 1920,
      height: 1080,
      animated: false,
      exifOrientation: 1,
    })
  })

  it('marks an acTL before the first IDAT as animated', () => {
    expect(header(png({ width: 4, height: 4, animated: true })).animated).toBe(true)
  })

  it('is UNREADABLE when IHDR is missing or truncated', () => {
    expect(errorOf(bytes(PNG_SIGNATURE, be32(13), 'IHDR', [0, 0])).code).toBe('UNREADABLE')
    expect(errorOf(bytes(PNG_SIGNATURE, be32(13), 'IDAT', new Uint8Array(17))).code).toBe(
      'UNREADABLE',
    )
  })

  it('is UNREADABLE when a chunk inside the window fails its CRC (damaged file)', () => {
    const damaged = png({ width: 320, height: 240 })
    // Flip a byte inside the IDAT data; its stored CRC no longer matches.
    const idat = damaged.length - 12 - 4 - 4
    damaged[idat] = damaged[idat]! ^ 0xff
    expect(errorOf(damaged).code).toBe('UNREADABLE')
  })

  it('is UNREADABLE when the IHDR CRC is wrong', () => {
    const damaged = png({ width: 320, height: 240 })
    damaged[29] = damaged[29]! ^ 0x01 // last byte of the IHDR CRC
    expect(errorOf(damaged).code).toBe('UNREADABLE')
  })

  it('does not check a chunk that runs past the window', () => {
    const whole = png({ width: 320, height: 240 })
    expect(header(whole.subarray(0, whole.length - 14)).width).toBe(320) // IDAT cut short
  })

  it('judges by content: PNG bytes are a PNG whatever the name says', () => {
    // The parser never sees a name — it receives bytes only.
    expect(header(png({ width: 2, height: 3 })).format).toBe('png')
  })
})

describe('sniffImageHeader — GIF', () => {
  it('reads the logical screen size of a single-frame GIF', () => {
    expect(header(gif({ width: 300, height: 200 }))).toEqual({
      format: 'gif',
      width: 300,
      height: 200,
      animated: false,
      exifOrientation: 1,
    })
  })

  it('declares the first frame bounds when they extend past the logical screen (AC-09)', () => {
    const bomb = gif({
      width: 1,
      height: 1,
      frame: { left: 10, top: 20, width: 30000, height: 9000 },
    })
    expect(header(bomb)).toMatchObject({ width: 30010, height: 9020 })
  })

  it('marks a GIF with two image descriptors as animated', () => {
    expect(header(gif({ width: 300, height: 200, frames: 3 })).animated).toBe(true)
  })

  it('is not animated when the second descriptor lies beyond the window', () => {
    const one = gif({ width: 8, height: 8, frames: 2 })
    // Cut right after the first frame's terminator, before the second frame's extension block.
    const cut = one.subarray(0, one.length - 25)
    expect(header(cut).animated).toBe(false)
  })

  it('is UNREADABLE when the logical screen descriptor is truncated', () => {
    expect(errorOf(bytes('GIF89a', le16(10))).code).toBe('UNREADABLE')
  })
})

describe('sniffImageHeader — refused formats (AC-07)', () => {
  const cases: [string, Uint8Array, string][] = [
    ['SVG', bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'SVG'],
    [
      'SVG with an XML prolog',
      bytes('<?xml version="1.0"?>\n<!-- c -->\n<svg viewBox="0 0 1 1"/>'),
      'SVG',
    ],
    ['SVG with BOM and whitespace', bytes([0xef, 0xbb, 0xbf], '  \n<svg/>'), 'SVG'],
    ['BMP', bytes('BM', le32(70), le32(0), le32(54), le32(40), le32(2), le32(2)), 'BMP'],
    ['ICO', bytes([0, 0, 1, 0], le16(1), new Uint8Array(16)), 'ICO'],
    ['TIFF little-endian', bytes('II', [42, 0], le32(8), new Uint8Array(8)), 'TIFF or camera RAW'],
    ['TIFF big-endian', bytes('MM', [0, 42], be32(8), new Uint8Array(8)), 'TIFF or camera RAW'],
    ['PSD', bytes('8BPS', [0, 1], new Uint8Array(20)), 'PSD'],
    ['Canon CRW', bytes('II', [0x1a, 0, 0, 0], 'HEAPCCDR', new Uint8Array(8)), 'camera RAW'],
    ['Canon CR3', bytes(be32(24), 'ftyp', 'crx ', be32(1), 'crx isom'), 'camera RAW'],
    ['Fujifilm RAF', bytes('FUJIFILMCCD-RAW 0201', new Uint8Array(8)), 'camera RAW'],
    ['Olympus ORF', bytes('IIRO', [8, 0, 0, 0], new Uint8Array(8)), 'camera RAW'],
    ['Panasonic RW2', bytes('IIU', [0], [8, 0, 0, 0], new Uint8Array(8)), 'camera RAW'],
  ]

  it.each(cases)('names %s', (_label, input, format) => {
    expect(errorOf(input)).toEqual({ code: 'UNSUPPORTED_FORMAT', details: { format } })
  })
})

describe('sniffImageHeader — not an image (AC-08)', () => {
  it.each([
    ['empty input', new Uint8Array(0)],
    ['three bytes', bytes('abc')],
    ['plain text', bytes('hello, this is not an image at all')],
    ['an HTML page', bytes('<!doctype html><html><body></body></html>')],
    ['a PDF', bytes('%PDF-1.7\n%')],
    ['a "BM" text without a DIB header', bytes('BMW is a car maker, not a bitmap')],
  ])('%s is NOT_AN_IMAGE', (_label, input) => {
    expect(errorOf(input).code).toBe('NOT_AN_IMAGE')
  })
})

describe('sniffImageHeader — hardening', () => {
  const samples = [
    jpeg({ width: 100, height: 50, before: [exifApp1(6)] }),
    png({ width: 100, height: 50, animated: true }),
    gif({ width: 100, height: 50, frames: 2 }),
  ]

  it('never throws on any truncation of a valid sample', () => {
    for (const sample of samples) {
      for (let n = 0; n <= sample.length; n++) {
        expect(() => sniffImageHeader(sample.subarray(0, n))).not.toThrow()
      }
    }
  })

  it('never throws when any single byte is mutated', () => {
    for (const sample of samples) {
      for (let i = 0; i < sample.length; i++) {
        for (const value of [0x00, 0xff, 0x7f]) {
          const mutated = sample.slice()
          mutated[i] = value
          expect(() => sniffImageHeader(mutated)).not.toThrow()
        }
      }
    }
  })
})
