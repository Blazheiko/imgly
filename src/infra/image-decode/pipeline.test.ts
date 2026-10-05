import { describe, expect, it, vi } from 'vitest'
import { GIF_WALK_MAX_BYTES, HEADER_WINDOW_BYTES } from '@/core'
import { runDecode, type DecodeEnv } from './pipeline'
import type { Capabilities } from './types'

const BROWSER_ORIENTS: Capabilities = { appliesOrientation: true, decodesHeic: false }

// A minimal PNG: signature + IHDR declaring the given size (+ acTL when animated) + IDAT, with
// real chunk CRCs (the parser verifies every chunk inside its window).
function pngBytes(width: number, height: number, animated = false): Uint8Array<ArrayBuffer> {
  const be32 = (n: number) => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]
  const crc = (data: number[]) => {
    let c = 0xffffffff
    for (const byte of data) {
      c ^= byte
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
    }
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: number[]) => {
    const body = [...Array.from(type, (ch) => ch.charCodeAt(0)), ...data]
    return [...be32(data.length), ...body, ...be32(crc(body))]
  }
  return Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunk('IHDR', [...be32(width), ...be32(height), 8, 6, 0, 0, 0]),
    ...(animated ? chunk('acTL', [...be32(2), ...be32(0)]) : []),
    ...chunk('IDAT', [0, 0, 0, 0]),
  ])
}

type FakeBitmap = { width: number; height: number; close: ReturnType<typeof vi.fn> }

function fakeEnv(decodedSize?: { width: number; height: number }, transparent = false) {
  const bitmaps: FakeBitmap[] = []
  const draws: { width: number; height: number; quality: string }[] = []
  const transforms: (string | number)[][] = []
  const make = (width: number, height: number) => {
    const b = { width, height, close: vi.fn() }
    bitmaps.push(b)
    return b
  }
  const scanned: unknown[] = []
  const env: DecodeEnv = {
    hasTransparency: (bitmap) => {
      scanned.push(bitmap)
      return transparent
    },
    createImageBitmap: vi.fn(async () => {
      if (!decodedSize) throw new DOMException('bad', 'InvalidStateError')
      return make(decodedSize.width, decodedSize.height) as unknown as ImageBitmap
    }),
    createCanvas: (width, height) => {
      const ctx = {
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low',
        drawImage: () => draws.push({ width, height, quality: ctx.imageSmoothingQuality }),
        setTransform: (...m: number[]) => transforms.push(['set', ...m]),
        transform: (...m: number[]) => transforms.push(['then', ...m]),
      }
      return {
        width,
        height,
        getContext: () => ctx,
        transferToImageBitmap: () => make(width, height),
      } as unknown as OffscreenCanvas
    },
  }
  return { env, bitmaps, draws, transforms, scanned }
}

describe('runDecode (worker pipeline)', () => {
  it('returns a small image unchanged without any reduction step (AC-06)', async () => {
    const { env, draws } = fakeEnv({ width: 640, height: 480 })
    const result = await runDecode(new Blob([pngBytes(640, 480)]), env, BROWSER_ORIENTS)

    expect(result).toMatchObject({
      ok: true,
      value: { width: 640, height: 480, sourceWidth: 640, sourceHeight: 480, downscaled: false },
    })
    expect(draws).toEqual([])
  })

  it('decodes upright, in sRGB', async () => {
    const { env } = fakeEnv({ width: 640, height: 480 })
    await runDecode(new Blob([pngBytes(640, 480)]), env, BROWSER_ORIENTS)
    expect(env.createImageBitmap).toHaveBeenCalledWith(expect.any(Blob), {
      imageOrientation: 'from-image',
      colorSpaceConversion: 'default',
    })
  })

  it('reduces to the Downscale limit with high-quality steps, closing intermediates (AC-05)', async () => {
    const { env, bitmaps, draws } = fakeEnv({ width: 12000, height: 8000 })
    const result = await runDecode(new Blob([pngBytes(12000, 8000)]), env, BROWSER_ORIENTS)

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
    const result = await runDecode(new Blob([pngBytes(20000, 6000)]), env, BROWSER_ORIENTS)

    expect(result).toMatchObject({ ok: false, error: { code: 'TOO_LARGE' } })
    expect(env.createImageBitmap).not.toHaveBeenCalled()
  })

  it('refuses TOO_LARGE and closes the bitmap when the decode is larger than declared (AC-09)', async () => {
    const { env, bitmaps } = fakeEnv({ width: 20000, height: 6000 })
    const result = await runDecode(new Blob([pngBytes(100, 100)]), env, BROWSER_ORIENTS)

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'TOO_LARGE', details: { width: 20000, height: 6000 } },
    })
    expect(bitmaps).toHaveLength(1)
    expect(bitmaps[0]!.close).toHaveBeenCalled()
  })

  it('refuses a file above the byte ceiling as TOO_LARGE without reading or decoding it', async () => {
    const { env } = fakeEnv({ width: 100, height: 100 })
    const huge = new Blob([pngBytes(100, 100)])
    Object.defineProperty(huge, 'size', { value: 600_000_000 })
    const slice = vi.spyOn(huge, 'slice')

    const result = await runDecode(huge, env, BROWSER_ORIENTS)

    expect(result).toMatchObject({ ok: false, error: { code: 'TOO_LARGE' } })
    expect(slice).not.toHaveBeenCalled()
    expect(env.createImageBitmap).not.toHaveBeenCalled()
  })

  it('refuses NOT_AN_IMAGE by content before decoding (AC-08)', async () => {
    const { env } = fakeEnv({ width: 1, height: 1 })
    const result = await runDecode(new Blob(['just text']), env, BROWSER_ORIENTS)
    expect(result).toEqual({ ok: false, error: { code: 'NOT_AN_IMAGE' } })
    expect(env.createImageBitmap).not.toHaveBeenCalled()
  })

  it('reports DECODE_FAILED when the browser cannot decode the bytes', async () => {
    const { env } = fakeEnv(undefined)
    expect(await runDecode(new Blob([pngBytes(10, 10)]), env, BROWSER_ORIENTS)).toEqual({
      ok: false,
      error: { code: 'DECODE_FAILED' },
    })
  })

  it('reports FILE_NOT_PERMITTED when reading the file is refused (AC-10)', async () => {
    const { env } = fakeEnv({ width: 1, height: 1 })
    const refused = {
      size: 1024,
      slice: () => ({
        arrayBuffer: () => Promise.reject(new DOMException('no', 'NotReadableError')),
      }),
    } as unknown as Blob
    expect(await runDecode(refused, env, BROWSER_ORIENTS)).toEqual({
      ok: false,
      error: { code: 'FILE_NOT_PERMITTED' },
    })
  })

  it('passes the animation flag through (AC-11)', async () => {
    const { env } = fakeEnv({ width: 4, height: 4 })
    const apng = pngBytes(4, 4, true)
    expect(await runDecode(new Blob([apng]), env, BROWSER_ORIENTS)).toMatchObject({
      ok: true,
      value: { animated: true, format: 'png' },
    })
  })

  describe('a GIF whose second frame lies past the header window (AC-11)', () => {
    // An 8×8 GIF whose first frame carries `dataBlocks` 255-byte sub-blocks, then `frames - 1`
    // more frames and, unless `truncated`, the trailer.
    function largeGif(dataBlocks: number, frames: number, truncated = false): Uint8Array {
      const le16 = (n: number) => [n & 255, (n >> 8) & 255]
      const out: number[] = [...Array.from('GIF89a', (c) => c.charCodeAt(0))]
      out.push(...le16(8), ...le16(8), 0x80, 0, 0, 0, 0, 0, 0, 0, 0)
      const frame = (blocks: number) => {
        out.push(0x21, 0xf9, 4, 0, 10, 0, 0, 0)
        out.push(0x2c, ...le16(0), ...le16(0), ...le16(8), ...le16(8), 0, 2)
        for (let n = 0; n < blocks; n++) out.push(255, ...new Array<number>(255).fill(0xaa))
        out.push(3, 0x4c, 0x01, 0x00, 0)
      }
      frame(dataBlocks)
      for (let n = 1; n < frames; n++) frame(0)
      if (!truncated) out.push(0x3b)
      return Uint8Array.from(out)
    }

    /** A Blob that records every slice it is asked for. */
    function recordingBlob(data: Uint8Array) {
      const blob = new Blob([data as Uint8Array<ArrayBuffer>])
      const slices: [number, number][] = []
      const file = {
        size: blob.size,
        slice: (start = 0, end = blob.size) => {
          slices.push([start, end])
          return blob.slice(start, end)
        },
      } as unknown as Blob
      return { file, slices }
    }

    const decodeGif = (data: Uint8Array) => {
      const { env } = fakeEnv({ width: 8, height: 8 })
      const { file, slices } = recordingBlob(data)
      return { result: runDecode(file, env, BROWSER_ORIENTS), slices, env }
    }

    it('reports it animated, reading only bounded slices before decoding', async () => {
      const { result, slices, env } = decodeGif(largeGif(6000, 2)) // ~1.5 MB first frame
      expect(await result).toMatchObject({ ok: true, value: { format: 'gif', animated: true } })
      expect(slices.length).toBeGreaterThan(1)
      for (const [start, end] of slices) expect(end - start).toBeLessThanOrEqual(1 << 20)
      expect(env.createImageBitmap).toHaveBeenCalledOnce()
    })

    it('reports a still GIF with a large frame not animated', async () => {
      const { result } = decodeGif(largeGif(6000, 1))
      expect(await result).toMatchObject({ ok: true, value: { animated: false } })
    })

    it('stops at the end of a file truncated inside its first frame', async () => {
      const { result } = decodeGif(largeGif(6000, 1, true).subarray(0, 1_400_000))
      expect(await result).toMatchObject({ ok: true, value: { animated: false } })
    })

    it('stops reading at GIF_WALK_MAX_BYTES and reports a frame beyond it not animated', async () => {
      // A first frame of 255-byte sub-blocks that runs past the cap, generated per slice so the
      // test never holds the whole file.
      const head = largeGif(0, 1, true).subarray(0, -5) // up to the first frame's LZW code size
      const size = HEADER_WINDOW_BYTES + GIF_WALK_MAX_BYTES + 4 * HEADER_WINDOW_BYTES
      const blocks = Uint8Array.from({ length: HEADER_WINDOW_BYTES + 256 }, (_, i) =>
        i % 256 ? 0xaa : 255,
      )
      const bytes = (start: number, end: number) => {
        const out = new Uint8Array(end - start)
        for (let p = start; p < end;) {
          if (p < head.length) {
            out[p - start] = head[p]!
            p++
            continue
          }
          const phase = (p - head.length) % 256
          const run = Math.min(end - p, blocks.length - phase)
          out.set(blocks.subarray(phase, phase + run), p - start)
          p += run
        }
        return out
      }
      const slices: [number, number][] = []
      const file = {
        size,
        slice: (start = 0, end = size) => {
          slices.push([start, end])
          return new Blob([bytes(start, Math.min(end, size))])
        },
      } as unknown as Blob
      const { env } = fakeEnv({ width: 8, height: 8 })

      expect(await runDecode(file, env, BROWSER_ORIENTS)).toMatchObject({
        ok: true,
        value: { animated: false },
      })
      const pastWindow = slices.filter(([start]) => start > 0)
      const read = pastWindow.reduce((sum, [start, end]) => sum + end - start, 0)
      expect(read).toBeLessThanOrEqual(GIF_WALK_MAX_BYTES)
      expect(env.createImageBitmap).toHaveBeenCalledOnce()
    })
  })

  it('reports whether the final Original has a pixel that is not fully opaque (AC-15)', async () => {
    const clear = fakeEnv({ width: 640, height: 480 }, true)
    const result = await runDecode(new Blob([pngBytes(640, 480)]), clear.env, BROWSER_ORIENTS)
    expect(result).toMatchObject({ ok: true, value: { hasTransparency: true } })
    expect(clear.scanned).toEqual([result.ok && result.value.bitmap])

    const solid = fakeEnv({ width: 640, height: 480 }, false)
    const opaque = await runDecode(new Blob([pngBytes(640, 480)]), solid.env, BROWSER_ORIENTS)
    expect(opaque).toMatchObject({ ok: true, value: { hasTransparency: false } })
  })

  it('never scans a JPEG, which has no alpha channel', async () => {
    const { env, scanned } = fakeEnv({ width: 300, height: 200 }, true)
    const result = await runDecode(new Blob([jpegBytes(300, 200, 1)]), env, BROWSER_ORIENTS)
    expect(result).toMatchObject({ ok: true, value: { hasTransparency: false } })
    expect(scanned).toEqual([])
  })

  it('scans the reduced Original, not the full decode', async () => {
    const { env, scanned } = fakeEnv({ width: 8192, height: 4096 }, false)
    const result = await runDecode(new Blob([pngBytes(8192, 4096)]), env, BROWSER_ORIENTS)
    expect(scanned).toHaveLength(1)
    expect(scanned[0]).toMatchObject({ width: 4096, height: 2048 })
    expect(result.ok && result.value.bitmap).toBe(scanned[0])
  })

  it('refuses HEIC as UNSUPPORTED_FORMAT without decoding where the probe found no support (AC-07)', async () => {
    const { env } = fakeEnv({ width: 8, height: 8 })
    const result = await runDecode(new Blob([heicBytes(4032, 3024)]), env, {
      appliesOrientation: true,
      decodesHeic: false,
    })
    expect(result).toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED_FORMAT', details: { format: 'HEIC' } },
    })
    expect(env.createImageBitmap).not.toHaveBeenCalled()
  })

  it('reports a failed HEIC decode as DECODE_FAILED where HEIC is supported (AC-08)', async () => {
    const { env } = fakeEnv(undefined)
    const result = await runDecode(new Blob([heicBytes(4032, 3024)]), env, {
      appliesOrientation: true,
      decodesHeic: true,
    })
    expect(result).toEqual({ ok: false, error: { code: 'DECODE_FAILED' } })
  })

  it('rotates an orientation-6 photo itself when the browser does not, before the 4096 target', async () => {
    // Stored 6000×4000 landscape; upright it is a 4000×6000 portrait.
    const { env, draws, transforms } = fakeEnv({ width: 6000, height: 4000 })
    const result = await runDecode(new Blob([jpegBytes(6000, 4000, 6)]), env, {
      appliesOrientation: false,
      decodesHeic: false,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { sourceWidth: 4000, sourceHeight: 6000, width: 2731, height: 4096, downscaled: true },
    })
    expect(draws).toEqual([{ width: 2731, height: 4096, quality: 'high' }])
    expect(transforms).toContainEqual(['then', 0, 1, -1, 0, 4000, 0])
  })

  it('applies orientation even when no reduction is needed', async () => {
    const { env, draws } = fakeEnv({ width: 300, height: 200 })
    const result = await runDecode(new Blob([jpegBytes(300, 200, 8)]), env, {
      appliesOrientation: false,
      decodesHeic: false,
    })
    expect(result).toMatchObject({
      ok: true,
      value: { width: 200, height: 300, downscaled: false },
    })
    expect(draws).toEqual([{ width: 200, height: 300, quality: 'high' }])
  })

  it('never rotates twice when the browser already applied orientation', async () => {
    // The browser hands back the upright 4000×6000 bitmap itself.
    const { env, transforms } = fakeEnv({ width: 4000, height: 6000 })
    const result = await runDecode(new Blob([jpegBytes(6000, 4000, 6)]), env, BROWSER_ORIENTS)
    expect(result).toMatchObject({ ok: true, value: { width: 2731, height: 4096 } })
    expect(transforms.filter(([kind]) => kind === 'then')).toEqual([])
  })
})

function heicBytes(width: number, height: number): Uint8Array<ArrayBuffer> {
  const be32 = (n: number) => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]
  const str = (s: string) => Array.from(s, (c) => c.charCodeAt(0))
  const box = (type: string, body: number[]) => [...be32(body.length + 8), ...str(type), ...body]
  const ispe = box('ispe', [0, 0, 0, 0, ...be32(width), ...be32(height)])
  const meta = box('meta', [0, 0, 0, 0, ...box('iprp', box('ipco', ispe))])
  return Uint8Array.from([...box('ftyp', [...str('heic'), 0, 0, 0, 0, ...str('mif1')]), ...meta])
}

function jpegBytes(width: number, height: number, orientation: number): Uint8Array<ArrayBuffer> {
  const be16 = (n: number) => [(n >> 8) & 255, n & 255]
  const str = (s: string) => Array.from(s, (c) => c.charCodeAt(0))
  const tiff = [
    ...str('MM'),
    0,
    42,
    0,
    0,
    0,
    8,
    0,
    1,
    0x01,
    0x12,
    0,
    3,
    0,
    0,
    0,
    1,
    ...be16(orientation),
    0,
    0,
    0,
    0,
    0,
    0,
  ]
  const exif = [...str('Exif'), 0, 0, ...tiff]
  const app1 = [0xff, 0xe1, ...be16(exif.length + 2), ...exif]
  const sof = [0xff, 0xc0, 0, 11, 8, ...be16(height), ...be16(width), 1, 1, 0x11, 0]
  return Uint8Array.from([0xff, 0xd8, ...app1, ...sof, 0xff, 0xda, 0, 2, 0xff, 0xd9])
}
