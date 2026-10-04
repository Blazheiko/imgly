import { describe, expect, it } from 'vitest'
import { sniffImageHeader } from './index'
import {
  be32,
  box,
  bytes,
  fullBox,
  heif,
  ispe,
  webpExtended,
  webpLossless,
  webpLossy,
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

describe('sniffImageHeader — WebP', () => {
  it('reads a lossy VP8 frame header', () => {
    expect(header(webpLossy(1024, 768))).toEqual({
      format: 'webp',
      width: 1024,
      height: 768,
      animated: false,
      exifOrientation: 1,
    })
  })

  it('reads the 14-bit packed size of a lossless VP8L image', () => {
    expect(header(webpLossless(16383, 2))).toMatchObject({ width: 16383, height: 2 })
  })

  it('reads the VP8X canvas size and its animation flag', () => {
    expect(header(webpExtended(5000, 3000, false))).toMatchObject({
      width: 5000,
      height: 3000,
      animated: false,
    })
    expect(header(webpExtended(400, 300, true))).toMatchObject({ animated: true })
  })

  it('reads a simple-format frame whose chunk runs past the header window', () => {
    // A >1 MiB VP8/VP8L image: only the window is read, so the chunk's tail is never seen.
    const declare = (b: Uint8Array) => {
      new DataView(b.buffer, b.byteOffset).setUint32(16, 5_000_000, true)
      return b
    }
    expect(header(declare(webpLossy(4000, 3000)))).toMatchObject({ width: 4000, height: 3000 })
    expect(header(declare(webpLossless(4000, 3000)))).toMatchObject({ width: 4000, height: 3000 })
  })

  it('is UNREADABLE when the first chunk is truncated', () => {
    const cut = webpLossy(10, 10).subarray(0, 24)
    expect(errorOf(cut).code).toBe('UNREADABLE')
  })

  it('is UNREADABLE when the VP8 start code is wrong', () => {
    const broken = webpLossy(10, 10)
    broken[23] = 0x00
    expect(errorOf(broken).code).toBe('UNREADABLE')
  })

  it('is NOT_AN_IMAGE for a RIFF that is not WebP', () => {
    expect(errorOf(bytes('RIFF', [4, 0, 0, 0], 'WAVE', new Uint8Array(16))).code).toBe(
      'NOT_AN_IMAGE',
    )
  })
})

describe('sniffImageHeader — AVIF', () => {
  it('reads the size from ispe', () => {
    expect(
      header(heif({ major: 'avif', compatible: ['mif1', 'miaf'], sizes: [[3840, 2160]] })),
    ).toEqual({ format: 'avif', width: 3840, height: 2160, animated: false, exifOrientation: 1 })
  })

  it('marks the avis brand as animated', () => {
    expect(header(heif({ major: 'avis', compatible: ['avif'], sizes: [[64, 64]] }))).toMatchObject({
      format: 'avif',
      animated: true,
    })
  })

  it('uses the largest ispe when thumbnails or grid tiles carry smaller ones', () => {
    const input = heif({
      major: 'avif',
      sizes: [
        [512, 512],
        [8000, 6000],
        [256, 192],
      ],
    })
    expect(header(input)).toMatchObject({ width: 8000, height: 6000 })
  })

  it('is UNREADABLE when ispe is missing', () => {
    expect(errorOf(heif({ major: 'avif', sizes: [] })).code).toBe('UNREADABLE')
  })

  it('returns the declared size of a tiny file declaring 50000×50000', () => {
    const input = heif({ major: 'avif', sizes: [[50000, 50000]] })
    expect(input.length).toBeLessThan(200)
    expect(header(input)).toMatchObject({ width: 50000, height: 50000 })
  })
})

describe('sniffImageHeader — HEIC/HEIF', () => {
  it.each(['heic', 'heix', 'mif1', 'msf1'])('recognises the %s brand as heic', (brand) => {
    expect(header(heif({ major: brand, sizes: [[4032, 3024]] }))).toEqual({
      format: 'heic',
      width: 4032,
      height: 3024,
      animated: false,
      exifOrientation: 1,
    })
  })

  it('recognises HEIC from a compatible brand', () => {
    expect(
      header(heif({ major: 'abcd', compatible: ['mif1', 'heic'], sizes: [[10, 20]] })).format,
    ).toBe('heic')
  })

  it('is not refused by the parser — support is the worker probe’s call', () => {
    expect(sniffImageHeader(heif({ major: 'heic', sizes: [[10, 10]] })).ok).toBe(true)
  })
})

describe('sniffImageHeader — hostile ISOBMFF', () => {
  const ftyp = box('ftyp', 'avif', be32(0), 'mif1')

  it('is UNREADABLE when a box claims more than the window holds', () => {
    const input = bytes(ftyp, be32(0x7fffffff), 'meta', new Uint8Array(32))
    expect(errorOf(input).code).toBe('UNREADABLE')
  })

  it('is UNREADABLE for a 64-bit largesize beyond the window', () => {
    const input = bytes(ftyp, be32(1), 'meta', be32(1), be32(0), new Uint8Array(32))
    expect(errorOf(input).code).toBe('UNREADABLE')
  })

  it('reads a size-0 box as running to the end of the window', () => {
    const meta = fullBox('meta', box('iprp', box('ipco', ispe(10, 20))))
    const open = bytes(be32(0), meta.subarray(4))
    expect(header(bytes(ftyp, open))).toMatchObject({ width: 10, height: 20 })
  })

  it('finds meta even when the mdat after it runs past the window, as in real files', () => {
    const meta = fullBox('meta', box('iprp', box('ipco', ispe(4032, 3024))))
    const mdat = bytes(be32(50_000_000), 'mdat', new Uint8Array(64))
    expect(header(bytes(ftyp, meta, mdat))).toMatchObject({ width: 4032, height: 3024 })
  })

  it('is UNREADABLE when a box is smaller than its own header (crafted loop)', () => {
    const input = bytes(ftyp, be32(4), 'free', new Uint8Array(64))
    expect(errorOf(input).code).toBe('UNREADABLE')
  })

  it('is UNREADABLE when thousands of empty boxes precede meta', () => {
    const filler = Array.from({ length: 5000 }, () => box('free'))
    const meta = fullBox('meta', box('iprp', box('ipco', ispe(10, 20))))
    expect(errorOf(bytes(ftyp, ...filler, meta)).code).toBe('UNREADABLE')
  })
})
