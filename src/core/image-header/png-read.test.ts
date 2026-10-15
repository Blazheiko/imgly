import { describe, expect, it } from 'vitest'
import { crc32 } from './crc32'
import { pngRgbaParts, pngUnfilter } from './png-read'
import { pngFile, pngScanlines } from './png-write'

const RGBA = new Uint8Array([
  203, 123, 43, 64, 255, 0, 0, 1, 0, 0, 0, 0, 9, 9, 9, 255, 1, 2, 3, 4, 5, 6, 7, 8,
])

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

/** `pngFile`'s bytes with other IHDR format bytes (bit depth, colour type, …), CRC re-signed. */
function withIhdrBytes(file: Uint8Array, bytes: number[]): Uint8Array {
  const out = file.slice()
  out.set(bytes, 8 + 8 + 8)
  new DataView(out.buffer).setUint32(8 + 8 + 13, crc32(out, 8 + 4, 8 + 8 + 13))
  return out
}

describe('pngRgbaParts', () => {
  it('reads the size and the zlib stream of a PNG the app wrote, round trip exact', async () => {
    const zlib = await through(pngScanlines(3, 2, RGBA), new CompressionStream('deflate'))
    const parts = pngRgbaParts(pngFile(3, 2, zlib))
    expect(parts).toBeDefined()
    expect([parts!.width, parts!.height]).toEqual([3, 2])
    const raw = await through(parts!.zlib, new DecompressionStream('deflate'))
    expect(Array.from(pngUnfilter(3, 2, raw)!)).toEqual(Array.from(RGBA))
  })

  it('joins several IDAT chunks in order', async () => {
    const zlib = await through(pngScanlines(3, 2, RGBA), new CompressionStream('deflate'))
    const one = pngFile(3, 2, zlib)
    // Split the one IDAT into two by writing a file whose IDAT data is the first half, then
    // splicing a second IDAT with the rest before IEND.
    const half = Math.floor(zlib.length / 2)
    const head = pngFile(3, 2, zlib.subarray(0, half))
    const tail = pngFile(3, 2, zlib.subarray(half))
    const idatOf = (file: Uint8Array) => file.subarray(8 + 25, file.length - 12)
    const two = new Uint8Array([
      ...head.subarray(0, head.length - 12),
      ...idatOf(tail),
      ...one.subarray(one.length - 12),
    ])
    expect(Array.from(pngRgbaParts(two)!.zlib)).toEqual(Array.from(zlib))
  })

  it('is undefined for a PNG of another shape: palette, 16-bit, RGB or interlaced', async () => {
    const file = pngFile(
      3,
      2,
      await through(pngScanlines(3, 2, RGBA), new CompressionStream('deflate')),
    )
    expect(pngRgbaParts(withIhdrBytes(file, [8, 6, 0, 0, 0]))).toBeDefined()
    expect(pngRgbaParts(withIhdrBytes(file, [8, 3]))).toBeUndefined()
    expect(pngRgbaParts(withIhdrBytes(file, [16, 6]))).toBeUndefined()
    expect(pngRgbaParts(withIhdrBytes(file, [8, 2]))).toBeUndefined()
    expect(pngRgbaParts(withIhdrBytes(file, [8, 6, 0, 0, 1]))).toBeUndefined()
  })

  it('is undefined for bytes that are not a whole PNG', async () => {
    const file = pngFile(
      3,
      2,
      await through(pngScanlines(3, 2, RGBA), new CompressionStream('deflate')),
    )
    expect(pngRgbaParts(new Uint8Array([1, 2, 3]))).toBeUndefined()
    expect(pngRgbaParts(file.subarray(0, file.length - 20))).toBeUndefined()
    const badCrc = file.slice()
    badCrc[8 + 8 + 13] = badCrc[8 + 8 + 13]! ^ 0xff
    expect(pngRgbaParts(badCrc)).toBeUndefined()
  })
})

describe('pngUnfilter', () => {
  // Two rows of 2 RGBA pixels; each row's filter applied by hand from these straight bytes.
  const W = 2
  const ROW0 = [10, 20, 30, 40, 50, 60, 70, 80]
  const ROW1 = [15, 25, 35, 45, 200, 100, 250, 5]
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  const filterRow = (type: number, row: number[], prior: number[]) =>
    row.map((x, i) => {
      const a = i >= 4 ? row[i - 4]! : 0
      const b = prior[i] ?? 0
      const c = i >= 4 ? (prior[i - 4] ?? 0) : 0
      const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][type]!
      return (x - predictor + 256) & 0xff
    })

  for (const type of [0, 1, 2, 3, 4]) {
    it(`undoes filter type ${type} exactly`, () => {
      const raw = new Uint8Array([
        type,
        ...filterRow(type, ROW0, []),
        type,
        ...filterRow(type, ROW1, ROW0),
      ])
      expect(Array.from(pngUnfilter(W, 2, raw)!)).toEqual([...ROW0, ...ROW1])
    })
  }

  it('is undefined for an unknown filter type or the wrong length', () => {
    expect(pngUnfilter(W, 2, new Uint8Array([5, ...ROW0, 0, ...ROW1]))).toBeUndefined()
    expect(pngUnfilter(W, 2, new Uint8Array([0, ...ROW0]))).toBeUndefined()
  })
})
