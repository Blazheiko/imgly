import { describe, expect, it } from 'vitest'
import { sniffImageHeader } from './index'
import { pngFile, pngScanlines } from './png-write'

const RGBA = new Uint8Array([
  203, 123, 43, 64, 255, 0, 0, 1, 0, 0, 0, 0, 9, 9, 9, 255, 1, 2, 3, 4, 5, 6, 7, 8,
])

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

describe('pngScanlines', () => {
  it('prefixes each row with filter 0 and keeps the bytes as given', () => {
    const raw = pngScanlines(3, 2, RGBA)
    expect(Array.from(raw)).toEqual([0, ...RGBA.slice(0, 12), 0, ...RGBA.slice(12)])
  })

  it('refuses a buffer of the wrong length', () => {
    expect(() => pngScanlines(3, 3, RGBA)).toThrow()
  })
})

describe('pngFile', () => {
  it('is a valid 8-bit RGBA PNG of the size whose IDAT inflates to the scanlines', async () => {
    const raw = pngScanlines(3, 2, RGBA)
    const file = pngFile(3, 2, await through(raw, new CompressionStream('deflate')))
    const header = sniffImageHeader(file)
    expect(header).toEqual({
      ok: true,
      value: { format: 'png', width: 3, height: 2, animated: false, exifOrientation: 1 },
    })
    expect(Array.from(file.subarray(24, 29))).toEqual([8, 6, 0, 0, 0])
    const idatLength = new DataView(file.buffer).getUint32(33)
    const idat = file.subarray(41, 41 + idatLength)
    expect(Array.from(await through(idat, new DecompressionStream('deflate')))).toEqual(
      Array.from(raw),
    )
  })
})
