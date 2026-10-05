import { describe, expect, it, vi } from 'vitest'
import { jpeg, png, webpLossy } from '@/core/image-header/test-fixtures'
import { createFakeCanvas, createFakeGl, type FakeGl } from '../fake-gl'
import { handleExport, type ExportEnv, type ExportRequest } from './worker-handler'

type FakeBitmap = ImageBitmap & { close: ReturnType<typeof vi.fn> }
const bitmap = (width: number, height: number) =>
  ({ width, height, close: vi.fn() }) as unknown as FakeBitmap

/** Bytes the fake encoder returns: by default a real header of the asked format and size. */
type Encoded = Uint8Array | 'reject'

function setup(
  opts: { gl?: FakeGl | null; encoded?: (w: number, h: number, type: string) => Encoded } = {},
) {
  const fake = opts.gl === undefined ? createFakeGl() : opts.gl
  const canvases: { width: number; height: number; options?: unknown }[] = []
  const encodes: unknown[] = []
  const env: ExportEnv = {
    createCanvas: (width, height) => {
      const canvas = createFakeCanvas(fake?.gl ?? null)
      canvas.width = width
      canvas.height = height
      const getContext = canvas.getContext
      const record = { width, height, options: undefined as unknown }
      canvases.push(record)
      return Object.assign(canvas, {
        getContext: (kind: string, options?: unknown) => {
          record.options = options
          return getContext(kind)
        },
        convertToBlob: async (options: { type: string; quality?: number }) => {
          encodes.push(options)
          const bytes = (opts.encoded ?? defaultEncoded)(width, height, options.type)
          if (bytes === 'reject') throw new DOMException('encode', 'EncodingError')
          return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: options.type })
        },
      }) as unknown as OffscreenCanvas
    },
  }
  return { fake, env, canvases, encodes }
}

function defaultEncoded(width: number, height: number, type: string): Uint8Array {
  if (type === 'image/jpeg') return jpeg({ width, height })
  if (type === 'image/webp') return webpLossy(width, height)
  return png({ width, height })
}

const request = (overrides: Partial<ExportRequest> = {}): ExportRequest => ({
  bitmap: bitmap(4096, 3072),
  width: 4096,
  height: 3072,
  format: 'png',
  quality: 90,
  ...overrides,
})

const uniformCalls = (fake: FakeGl, name: string) =>
  fake.calls.filter(
    ([method, location]) =>
      method.startsWith('uniform') && (location as { uniform?: string })?.uniform === name,
  )

describe('handleExport (export worker)', () => {
  it('renders the whole Work at the export size and returns the verified PNG (AC-01, AC-03)', async () => {
    const { fake, env, canvases, encodes } = setup()
    const req = request()
    const result = await handleExport(req, env)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toBeInstanceOf(Blob)
    expect(result.value.type).toBe('image/png')
    expect(canvases).toHaveLength(1)
    expect(canvases[0]).toMatchObject({ width: 4096, height: 3072 })
    expect(encodes).toEqual([{ type: 'image/png' }])
    expect(fake!.calls).toContainEqual(['viewport', 0, 0, 4096, 3072])
    expect(fake!.names()).toContain('drawArrays')
    // The whole Work fills the canvas, upright: uv (0,0) is the top-left corner in clip space.
    expect(uniformCalls(fake!, 'u_transform').at(-1)).toEqual([
      'uniformMatrix3fv',
      { uniform: 'u_transform' },
      false,
      new Float32Array([2, 0, 0, 0, -2, 0, -1, 1, 1]),
    ])
  })

  it('uploads premultiplied and samples 1:1 at texel centres at full size', async () => {
    const { fake, env } = setup()
    await handleExport(request(), env)

    expect(fake!.calls).toContainEqual(['pixelStorei', 'UNPACK_PREMULTIPLY_ALPHA_WEBGL', true])
    expect(fake!.calls).toContainEqual([
      'texParameteri',
      'TEXTURE_2D',
      'TEXTURE_MIN_FILTER',
      'NEAREST',
    ])
    expect(fake!.calls).toContainEqual([
      'texParameteri',
      'TEXTURE_2D',
      'TEXTURE_MAG_FILTER',
      'NEAREST',
    ])
  })

  it('uses mipmapped trilinear sampling below full size (AC-05)', async () => {
    const { fake, env, canvases } = setup()
    await handleExport(request({ width: 2048, height: 1536, format: 'webp', quality: 50 }), env)

    expect(canvases[0]).toMatchObject({ width: 2048, height: 1536 })
    const filter = (name: string) =>
      fake!.calls.filter(([method, , pname]) => method === 'texParameteri' && pname === name).at(-1)
    expect(filter('TEXTURE_MIN_FILTER')).toEqual([
      'texParameteri',
      'TEXTURE_2D',
      'TEXTURE_MIN_FILTER',
      'LINEAR_MIPMAP_LINEAR',
    ])
    expect(filter('TEXTURE_MAG_FILTER')![3]).toBe('LINEAR')
  })

  it('flattens onto white only for JPEG, and encodes at quality / 100 (AC-04, AC-15)', async () => {
    const jpg = setup()
    await handleExport(request({ format: 'jpeg', quality: 90 }), jpg.env)
    expect(uniformCalls(jpg.fake!, 'u_flatten').at(-1)).toEqual([
      'uniform1i',
      { uniform: 'u_flatten' },
      1,
    ])
    expect(jpg.encodes).toEqual([{ type: 'image/jpeg', quality: 0.9 }])

    for (const format of ['png', 'webp'] as const) {
      const other = setup()
      await handleExport(request({ format, quality: 50 }), other.env)
      expect(uniformCalls(other.fake!, 'u_flatten').at(-1)).toEqual([
        'uniform1i',
        { uniform: 'u_flatten' },
        0,
      ])
    }
  })

  it('asks for an alpha, non-antialiased, premultiplied context', async () => {
    const { env, canvases } = setup()
    await handleExport(request(), env)
    expect(canvases[0]!.options).toMatchObject({
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
    })
  })

  it('reports EXPORT_FAILED without a WebGL2 context', async () => {
    const { env, encodes } = setup({ gl: null })
    const req = request()
    expect(await handleExport(req, env)).toEqual({ ok: false, error: { code: 'EXPORT_FAILED' } })
    expect(encodes).toEqual([])
    expect(req.bitmap.close).toHaveBeenCalledTimes(1)
  })

  it('reports EXPORT_FAILED when the program cannot be built', async () => {
    const fake = createFakeGl()
    fake.returns.getProgramParameter = () => false
    const { env } = setup({ gl: fake })
    const req = request()
    expect(await handleExport(req, env)).toEqual({ ok: false, error: { code: 'EXPORT_FAILED' } })
    expect(req.bitmap.close).toHaveBeenCalledTimes(1)
  })

  it('reports EXPORT_FAILED when the context was lost during the render (AC-13)', async () => {
    const fake = createFakeGl()
    fake.returns.isContextLost = () => true
    const { env, encodes } = setup({ gl: fake })
    const req = request()
    expect(await handleExport(req, env)).toEqual({ ok: false, error: { code: 'EXPORT_FAILED' } })
    expect(encodes).toEqual([])
    expect(req.bitmap.close).toHaveBeenCalledTimes(1)
  })

  it('reports EXPORT_FAILED when the encoder rejects (AC-13)', async () => {
    const { env } = setup({ encoded: () => 'reject' })
    const req = request()
    expect(await handleExport(req, env)).toEqual({ ok: false, error: { code: 'EXPORT_FAILED' } })
    expect(req.bitmap.close).toHaveBeenCalledTimes(1)
  })

  it('reports EXPORT_FORMAT_MISMATCH when the browser made another format (AC-12)', async () => {
    const { env } = setup({ encoded: (w, h) => png({ width: w, height: h }) })
    const req = request({ format: 'webp' })
    expect(await handleExport(req, env)).toEqual({
      ok: false,
      error: { code: 'EXPORT_FORMAT_MISMATCH', details: { asked: 'webp', produced: 'png' } },
    })
    expect(req.bitmap.close).toHaveBeenCalledTimes(1)
  })

  it('reports EXPORT_FORMAT_MISMATCH when the content is not an image at all', async () => {
    const { env } = setup({ encoded: () => new Uint8Array([1, 2, 3, 4]) })
    expect(await handleExport(request({ format: 'jpeg' }), env)).toEqual({
      ok: false,
      error: { code: 'EXPORT_FORMAT_MISMATCH', details: { asked: 'jpeg', produced: null } },
    })
  })

  it('reports EXPORT_FORMAT_MISMATCH when the produced size differs from the request', async () => {
    const { env } = setup({ encoded: (w, h) => png({ width: w - 1, height: h }) })
    expect(await handleExport(request(), env)).toEqual({
      ok: false,
      error: { code: 'EXPORT_FORMAT_MISMATCH', details: { asked: 'png', produced: 'png' } },
    })
  })

  it('closes the bitmap exactly once on success', async () => {
    const { env } = setup()
    const req = request()
    await handleExport(req, env)
    expect(req.bitmap.close).toHaveBeenCalledTimes(1)
  })
})
