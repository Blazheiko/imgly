import { describe, expect, it } from 'vitest'
import { encodeRgbaPng } from './png-encode'

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

describe('encodeRgbaPng', () => {
  it('writes an image/png Blob whose pixels are the straight bytes given', async () => {
    const rgba = new Uint8Array([203, 123, 43, 64, 255, 0, 0, 1, 0, 0, 0, 0, 9, 9, 9, 255])
    const blob = await encodeRgbaPng(2, 2, rgba)
    expect(blob.type).toBe('image/png')
    const file = new Uint8Array(await blob.arrayBuffer())
    const idatLength = new DataView(file.buffer).getUint32(33)
    const raw = await through(
      file.subarray(41, 41 + idatLength),
      new DecompressionStream('deflate'),
    )
    expect(Array.from(raw)).toEqual([0, ...rgba.slice(0, 8), 0, ...rgba.slice(8)])
  })
})
