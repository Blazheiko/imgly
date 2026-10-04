import { describe, expect, it, vi } from 'vitest'
import { runDecode, type DecodeEnv } from './pipeline'

// A minimal valid PNG header: signature + IHDR declaring the given size.
function pngBytes(width: number, height: number): Uint8Array<ArrayBuffer> {
  const be32 = (n: number) => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]
  return Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...be32(13),
    0x49,
    0x48,
    0x44,
    0x52,
    ...be32(width),
    ...be32(height),
    8,
    6,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    ...be32(0),
    0x49,
    0x44,
    0x41,
    0x54,
    0,
    0,
    0,
    0,
  ])
}

type FakeBitmap = { width: number; height: number; close: ReturnType<typeof vi.fn> }

function fakeEnv(decodedSize?: { width: number; height: number }) {
  const bitmaps: FakeBitmap[] = []
  const draws: { width: number; height: number; quality: string }[] = []
  const make = (width: number, height: number) => {
    const b = { width, height, close: vi.fn() }
    bitmaps.push(b)
    return b
  }
  const env: DecodeEnv = {
    createImageBitmap: vi.fn(async () => {
      if (!decodedSize) throw new DOMException('bad', 'InvalidStateError')
      return make(decodedSize.width, decodedSize.height) as unknown as ImageBitmap
    }),
    createCanvas: (width, height) => {
      const ctx = {
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low',
        drawImage: () => draws.push({ width, height, quality: ctx.imageSmoothingQuality }),
      }
      return {
        width,
        height,
        getContext: () => ctx,
        transferToImageBitmap: () => make(width, height),
      } as unknown as OffscreenCanvas
    },
  }
  return { env, bitmaps, draws }
}

describe('runDecode (worker pipeline)', () => {
  it('returns a small image unchanged without any reduction step (AC-06)', async () => {
    const { env, draws } = fakeEnv({ width: 640, height: 480 })
    const result = await runDecode(new Blob([pngBytes(640, 480)]), env)

    expect(result).toMatchObject({
      ok: true,
      value: { width: 640, height: 480, sourceWidth: 640, sourceHeight: 480, downscaled: false },
    })
    expect(draws).toEqual([])
  })

  it('decodes upright, in sRGB', async () => {
    const { env } = fakeEnv({ width: 640, height: 480 })
    await runDecode(new Blob([pngBytes(640, 480)]), env)
    expect(env.createImageBitmap).toHaveBeenCalledWith(expect.any(Blob), {
      imageOrientation: 'from-image',
      colorSpaceConversion: 'default',
    })
  })

  it('reduces to the Downscale limit with high-quality steps, closing intermediates (AC-05)', async () => {
    const { env, bitmaps, draws } = fakeEnv({ width: 12000, height: 8000 })
    const result = await runDecode(new Blob([pngBytes(12000, 8000)]), env)

    expect(draws).toEqual([
      { width: 6000, height: 4000, quality: 'high' },
      { width: 4096, height: 2731, quality: 'high' },
    ])
    expect(result).toMatchObject({
      ok: true,
      value: {
        width: 4096,
        height: 2731,
        sourceWidth: 12000,
        sourceHeight: 8000,
        downscaled: true,
      },
    })
    const final = bitmaps.at(-1)!
    for (const b of bitmaps) {
      if (b === final) expect(b.close).not.toHaveBeenCalled()
      else expect(b.close).toHaveBeenCalled()
    }
  })

  it('refuses TOO_LARGE before createImageBitmap is called (AC-09)', async () => {
    const { env } = fakeEnv({ width: 1, height: 1 })
    const result = await runDecode(new Blob([pngBytes(20000, 6000)]), env)

    expect(result).toMatchObject({ ok: false, error: { code: 'TOO_LARGE' } })
    expect(env.createImageBitmap).not.toHaveBeenCalled()
  })

  it('refuses NOT_AN_IMAGE by content before decoding (AC-08)', async () => {
    const { env } = fakeEnv({ width: 1, height: 1 })
    const result = await runDecode(new Blob(['just text']), env)
    expect(result).toEqual({ ok: false, error: { code: 'NOT_AN_IMAGE' } })
    expect(env.createImageBitmap).not.toHaveBeenCalled()
  })

  it('reports DECODE_FAILED when the browser cannot decode the bytes', async () => {
    const { env } = fakeEnv(undefined)
    expect(await runDecode(new Blob([pngBytes(10, 10)]), env)).toEqual({
      ok: false,
      error: { code: 'DECODE_FAILED' },
    })
  })

  it('reports FILE_NOT_PERMITTED when reading the file is refused (AC-10)', async () => {
    const { env } = fakeEnv({ width: 1, height: 1 })
    const refused = {
      slice: () => ({
        arrayBuffer: () => Promise.reject(new DOMException('no', 'NotReadableError')),
      }),
    } as unknown as Blob
    expect(await runDecode(refused, env)).toEqual({
      ok: false,
      error: { code: 'FILE_NOT_PERMITTED' },
    })
  })

  it('passes the animation flag through (AC-11)', async () => {
    const { env } = fakeEnv({ width: 4, height: 4 })
    const apng = pngBytes(4, 4)
    // Rename the IDAT chunk to acTL: an animation control before image data.
    apng.set([0x61, 0x63, 0x54, 0x4c], 37)
    expect(await runDecode(new Blob([apng]), env)).toMatchObject({
      ok: true,
      value: { animated: true, format: 'png' },
    })
  })
})
