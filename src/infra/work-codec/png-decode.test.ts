import { describe, expect, it } from 'vitest'
import { pngFile, pngScanlines } from '@/core'
import { encodeRgbaPng } from './png-encode'
import { readRgbaPng } from './png-decode'

const RGBA = new Uint8Array([203, 123, 43, 64, 255, 0, 0, 1, 0, 0, 0, 0, 9, 9, 9, 255])

describe('readRgbaPng', () => {
  it('reads what encodeRgbaPng wrote back to the very bytes, semi-transparent ones too', async () => {
    const read = await readRgbaPng(await encodeRgbaPng(2, 2, RGBA))
    expect(read).toEqual({ width: 2, height: 2, rgba: RGBA })
  })

  it("is 'other' for bytes that are not a PNG in the app's own shape", async () => {
    expect(await readRgbaPng(new Blob([new Uint8Array([1, 2, 3])]))).toBe('other')
  })

  it("is 'damaged' when the pixel data does not inflate to the size", async () => {
    const notZlib = pngFile(2, 2, new Uint8Array([1, 2, 3, 4]))
    expect(await readRgbaPng(new Blob([notZlib as BlobPart]))).toBe('damaged')
    const deflated = new Blob([pngScanlines(1, 1, RGBA.subarray(0, 4)) as BlobPart])
      .stream()
      .pipeThrough(new CompressionStream('deflate'))
    const tooShort = pngFile(2, 2, new Uint8Array(await new Response(deflated).arrayBuffer()))
    expect(await readRgbaPng(new Blob([tooShort as BlobPart]))).toBe('damaged')
  })
})
