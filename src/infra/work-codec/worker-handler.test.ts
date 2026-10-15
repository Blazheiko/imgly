import { describe, expect, it, vi } from 'vitest'
import { handleCodecRequest, type CodecDeps } from './worker-handler'

/** A bitmap fake that carries its RGBA bytes, so the round trip can be compared byte for byte. */
interface FakeBitmap {
  width: number
  height: number
  data: Uint8ClampedArray
  close: ReturnType<typeof vi.fn>
}

function fakeBitmap(width: number, height: number, data: Uint8ClampedArray): FakeBitmap {
  return { width, height, data, close: vi.fn() }
}

const asBitmap = (b: FakeBitmap) => b as unknown as ImageBitmap

/** Opaque 2x2 RGBA: alpha is 255 everywhere, so a premultiplied canvas keeps every byte. */
const PIXELS = new Uint8ClampedArray([
  255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 12, 34, 56, 255,
])

/** A "PNG" is a 2-number header plus the pixels; the fake canvas writes it, the fake decoder reads it. */
function makeDeps() {
  const post = vi.fn<CodecDeps['post']>()
  const decodeOptions: unknown[] = []
  const created: { width: number; height: number }[] = []
  const deps: CodecDeps = {
    createCanvas: (width, height) => {
      created.push({ width, height })
      let drawn: FakeBitmap | undefined
      return {
        getContext: () => ({
          drawImage: (b: unknown) => {
            drawn = b as FakeBitmap
          },
          getImageData: () => ({ width, height, data: drawn!.data }),
          putImageData: (image: ImageData) => {
            drawn = fakeBitmap(width, height, image.data)
          },
        }),
        transferToImageBitmap: () => asBitmap(drawn!),
      } as unknown as OffscreenCanvas
    },
    encodePng: async (width, height, rgba) =>
      new Blob([new Uint8Array([width, height]), rgba as BlobPart], { type: 'image/png' }),
    // The fakes' "PNG" is never in the app's own format, so it decodes through the browser.
    readRgbaPng: async () => 'other',
    createBitmap: async (blob, options) => {
      decodeOptions.push(options)
      const bytes = new Uint8Array(await blob.arrayBuffer())
      if (bytes.length < 2) throw new DOMException('not an image', 'InvalidStateError')
      return asBitmap(fakeBitmap(bytes[0]!, bytes[1]!, new Uint8ClampedArray(bytes.slice(2))))
    },
    post,
  }
  return { deps, post, decodeOptions, created }
}

describe('handleCodecRequest, encode (AC-04)', () => {
  it('draws the bitmap on a canvas of its size, closes it and posts a PNG Blob', async () => {
    const { deps, post, created } = makeDeps()
    const bitmap = fakeBitmap(2, 2, PIXELS)

    await handleCodecRequest({ kind: 'encode', bitmap: asBitmap(bitmap) }, deps)

    expect(created).toEqual([{ width: 2, height: 2 }])
    expect(bitmap.close).toHaveBeenCalled()
    const message = post.mock.calls[0]![0]
    expect(message.ok).toBe(true)
    if (message.ok) expect(message.value).toBeInstanceOf(Blob)
  })

  it('encodes the straight getImageData bytes, semi-transparent ones unchanged (QG-2)', async () => {
    const { deps } = makeDeps()
    const encodePng = vi.spyOn(deps, 'encodePng')
    const translucent = new Uint8ClampedArray([
      203, 123, 43, 64, 255, 0, 0, 1, 0, 0, 0, 0, 9, 9, 9, 255,
    ])
    await handleCodecRequest(
      { kind: 'encode', bitmap: asBitmap(fakeBitmap(2, 2, translucent)) },
      deps,
    )
    const [width, height, rgba] = encodePng.mock.calls[0]!
    expect([width, height]).toEqual([2, 2])
    expect(Array.from(rgba)).toEqual(Array.from(translucent))
  })

  it('posts an image/png Blob', async () => {
    const { deps, post } = makeDeps()
    await handleCodecRequest({ kind: 'encode', bitmap: asBitmap(fakeBitmap(2, 2, PIXELS)) }, deps)
    const message = post.mock.calls[0]![0]
    if (!message.ok) throw new Error('expected ok')
    expect((message.value as Blob).type).toBe('image/png')
  })

  it('posts STORAGE_FAILED when encoding throws, and still closes the bitmap', async () => {
    const { deps, post } = makeDeps()
    deps.createCanvas = () => {
      throw new Error('no canvas')
    }
    const bitmap = fakeBitmap(2, 2, PIXELS)
    await handleCodecRequest({ kind: 'encode', bitmap: asBitmap(bitmap) }, deps)

    expect(post).toHaveBeenCalledWith({ ok: false, error: { code: 'STORAGE_FAILED' } })
    expect(bitmap.close).toHaveBeenCalled()
  })
})

describe('handleCodecRequest, decode (AC-04, AC-08)', () => {
  it('round-trips an opaque RGBA buffer to the same bytes, bitmap transferred back', async () => {
    const { deps, post } = makeDeps()
    await handleCodecRequest({ kind: 'encode', bitmap: asBitmap(fakeBitmap(2, 2, PIXELS)) }, deps)
    const encoded = post.mock.calls[0]![0]
    if (!encoded.ok) throw new Error('encode failed')

    post.mockClear()
    await handleCodecRequest(
      { kind: 'decode', blob: encoded.value as Blob, expected: { width: 2, height: 2 } },
      deps,
    )

    const [message, transfer] = post.mock.calls[0]!
    if (!message.ok) throw new Error('decode failed')
    const out = message.value as unknown as FakeBitmap
    expect([out.width, out.height]).toEqual([2, 2])
    expect(Array.from(out.data)).toEqual(Array.from(PIXELS))
    expect(transfer).toEqual([message.value])
  })

  it('decodes with no colour conversion, no orientation and no premultiply', async () => {
    const { deps, decodeOptions } = makeDeps()
    await handleCodecRequest(
      {
        kind: 'decode',
        blob: new Blob([new Uint8Array([1, 1, 0, 0, 0, 255])]),
        expected: { width: 1, height: 1 },
      },
      deps,
    )
    expect(decodeOptions[0]).toEqual({
      colorSpaceConversion: 'none',
      imageOrientation: 'none',
      premultiplyAlpha: 'none',
    })
  })

  it('refuses a decoded size that differs from the record: WORK_DAMAGED, bitmap closed', async () => {
    const { deps, post } = makeDeps()
    const closed = vi.fn()
    deps.createBitmap = async () =>
      ({ width: 3, height: 2, close: closed }) as unknown as ImageBitmap

    await handleCodecRequest(
      { kind: 'decode', blob: new Blob([new Uint8Array([1])]), expected: { width: 2, height: 2 } },
      deps,
    )

    expect(post).toHaveBeenCalledWith({ ok: false, error: { code: 'WORK_DAMAGED' } })
    expect(closed).toHaveBeenCalled()
  })

  it('returns WORK_DAMAGED for a Blob that is not an image', async () => {
    const { deps, post } = makeDeps()
    await handleCodecRequest(
      { kind: 'decode', blob: new Blob([]), expected: { width: 2, height: 2 } },
      deps,
    )
    expect(post).toHaveBeenCalledWith({ ok: false, error: { code: 'WORK_DAMAGED' } })
  })
})

describe('handleCodecRequest, decode of a PNG the app wrote (AC-04, Linux WebKit)', () => {
  const TRANSLUCENT = new Uint8ClampedArray([
    203, 123, 43, 64, 255, 0, 0, 1, 0, 0, 0, 0, 9, 9, 9, 255,
  ])

  it('puts the straight bytes on a canvas and transfers its bitmap, never createImageBitmap', async () => {
    const { deps, post, decodeOptions, created } = makeDeps()
    deps.readRgbaPng = async () => ({ width: 2, height: 2, rgba: new Uint8Array(TRANSLUCENT) })

    await handleCodecRequest(
      { kind: 'decode', blob: new Blob([new Uint8Array([9])]), expected: { width: 2, height: 2 } },
      deps,
    )

    expect(decodeOptions).toEqual([])
    expect(created).toEqual([{ width: 2, height: 2 }])
    const [message, transfer] = post.mock.calls[0]!
    if (!message.ok) throw new Error('decode failed')
    expect(Array.from((message.value as unknown as FakeBitmap).data)).toEqual(
      Array.from(TRANSLUCENT),
    )
    expect(transfer).toEqual([message.value])
  })

  it('refuses its size when it differs from the record: WORK_DAMAGED, no canvas', async () => {
    const { deps, post, created } = makeDeps()
    deps.readRgbaPng = async () => ({ width: 3, height: 2, rgba: new Uint8Array(24) })

    await handleCodecRequest(
      { kind: 'decode', blob: new Blob([new Uint8Array([9])]), expected: { width: 2, height: 2 } },
      deps,
    )

    expect(post).toHaveBeenCalledWith({ ok: false, error: { code: 'WORK_DAMAGED' } })
    expect(created).toEqual([])
  })

  it('returns WORK_DAMAGED when its pixel data does not inflate or unfilter', async () => {
    const { deps, post, decodeOptions } = makeDeps()
    deps.readRgbaPng = async () => 'damaged'

    await handleCodecRequest(
      { kind: 'decode', blob: new Blob([new Uint8Array([9])]), expected: { width: 2, height: 2 } },
      deps,
    )

    expect(post).toHaveBeenCalledWith({ ok: false, error: { code: 'WORK_DAMAGED' } })
    expect(decodeOptions).toEqual([])
  })
})
