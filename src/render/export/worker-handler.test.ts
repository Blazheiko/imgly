import { describe, expect, it, vi } from 'vitest'
import { jpeg, png, webpLossy } from '@/core/image-header/test-fixtures'
import { createFakeCanvas, createFakeGl, type FakeGl } from '../fake-gl'
import {
  cropToOriginalUv,
  identityGeometry,
  NEUTRAL_ADJUSTMENTS,
  toUniforms,
  type Geometry,
} from '@/core'
import {
  handleAlpha,
  handleCheck,
  handleExport,
  type ExportEnv,
  type ExportRequest,
} from './worker-handler'

type FakeBitmap = ImageBitmap & { close: ReturnType<typeof vi.fn> }
const bitmap = (width: number, height: number) =>
  ({ width, height, close: vi.fn() }) as unknown as FakeBitmap

/** Bytes the fake encoder returns: by default a real header of the asked format and size. */
type Encoded = Uint8Array | 'reject'

function setup(
  opts: { gl?: FakeGl | null; encoded?: (w: number, h: number, type: string) => Encoded } = {},
) {
  const fake = opts.gl === undefined ? createFakeGl() : opts.gl
  const canvases: {
    width: number
    height: number
    options?: unknown
    kind?: string
    canvas?: unknown
    drawn: unknown[]
    encoded: boolean
  }[] = []
  const encodes: unknown[] = []
  const samples: FakeBitmap[] = []
  const env: ExportEnv = {
    createSample: () => {
      const sample = bitmap(2, 2)
      samples.push(sample)
      return sample
    },
    createCanvas: (width, height) => {
      const canvas = createFakeCanvas(fake?.gl ?? null)
      canvas.width = width
      canvas.height = height
      const getContext = canvas.getContext
      const record = {
        width,
        height,
        options: undefined as unknown,
        kind: undefined as string | undefined,
        canvas: undefined as unknown,
        drawn: [] as unknown[],
        encoded: false,
      }
      canvases.push(record)
      const result = Object.assign(canvas, {
        getContext: (kind: string, options?: unknown) => {
          record.options = options
          record.kind = kind
          if (kind === '2d') {
            return {
              drawImage: (source: unknown) => record.drawn.push(source),
              getImageData: (_x: number, _y: number, w: number, h: number) => ({
                fromCanvas: canvases.indexOf(record),
                width: w,
                height: h,
              }),
            }
          }
          return getContext(kind)
        },
        convertToBlob: async (options: { type: string; quality?: number }) => {
          record.encoded = true
          encodes.push(options)
          const bytes = (opts.encoded ?? defaultEncoded)(width, height, options.type)
          if (bytes === 'reject') throw new DOMException('encode', 'EncodingError')
          return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: options.type })
        },
      })
      record.canvas = result
      return result as unknown as OffscreenCanvas
    },
  }
  return { fake, env, canvases, encodes, samples }
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
  geometry: identityGeometry({ width: 4096, height: 3072 }),
  adjustments: NEUTRAL_ADJUSTMENTS,
  layer: null,
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
    expect(canvases[0]).toMatchObject({ width: 4096, height: 3072, kind: 'webgl2' })
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

  it('uploads the pixels read through a 2D canvas, not the bitmap (engines premultiply bitmaps differently)', async () => {
    const { fake, env, canvases } = setup()
    const req = request()
    await handleExport(req, env)

    const reader = canvases.findIndex((c) => c.kind === '2d' && c.drawn.includes(req.bitmap))
    expect(reader).toBeGreaterThanOrEqual(0)
    expect(canvases[reader]).toMatchObject({ width: 4096, height: 3072 })
    const upload = fake!.calls.find(([name]) => name === 'texImage2D')!
    expect(upload.at(-1)).toEqual({ fromCanvas: reader, width: 4096, height: 3072 })
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

  it('encodes from a 2D copy of the render, which every engine un-premultiplies correctly', async () => {
    const { env, canvases } = setup()
    await handleExport(request({ width: 2048, height: 1536 }), env)

    const render = canvases.find((c) => c.kind === 'webgl2')
    const copy = canvases.find((c) => c.encoded)
    expect(render).toMatchObject({ kind: 'webgl2', encoded: false })
    expect(copy).toMatchObject({ kind: '2d', width: 2048, height: 1536, encoded: true })
    expect(copy!.drawn).toEqual([render!.canvas])
  })

  it('strips metadata blocks the encoder added before returning the file (AC-16)', async () => {
    const exif = Uint8Array.from([0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00])
    const { env } = setup({
      encoded: (w, h) => {
        const plain = jpeg({ width: w, height: h })
        return Uint8Array.from([...plain.subarray(0, 2), ...exif, ...plain.subarray(2)])
      },
    })
    const result = await handleExport(request({ format: 'jpeg' }), env)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const bytes = new Uint8Array(await result.value.arrayBuffer())
    expect(bytes.length).toBe(jpeg({ width: 4096, height: 3072 }).length)
    expect(Array.from(bytes.subarray(2, 4))).not.toEqual([0xff, 0xe1])
    expect(result.value.type).toBe('image/jpeg')
  })

  it('closes the bitmap exactly once on success', async () => {
    const { env } = setup()
    const req = request()
    await handleExport(req, env)
    expect(req.bitmap.close).toHaveBeenCalledTimes(1)
  })
})

describe('handleCheck (session format check, AC-12)', () => {
  it('trial-encodes a 2×2 sample per lossy format through the export path', async () => {
    const { env, canvases, encodes, samples } = setup()
    expect(await handleCheck(env)).toEqual({ webgl2: true, jpeg: true, webp: true })
    expect(
      canvases.filter((c) => c.kind === 'webgl2').map(({ width, height }) => [width, height]),
    ).toEqual([
      [1, 1],
      [2, 2],
      [2, 2],
    ])
    expect(encodes).toEqual([
      { type: 'image/jpeg', quality: 0.9 },
      { type: 'image/webp', quality: 0.9 },
    ])
    expect(samples.map((s) => s.close.mock.calls.length)).toEqual([1, 1])
  })

  it('judges by content: WebP encoded as PNG is unavailable', async () => {
    const { env } = setup({
      encoded: (w, h, type) =>
        type === 'image/webp' ? png({ width: w, height: h }) : defaultEncoded(w, h, type),
    })
    expect(await handleCheck(env)).toEqual({ webgl2: true, jpeg: true, webp: false })
  })

  it('counts an encoder error as unavailable', async () => {
    const { env } = setup({ encoded: () => 'reject' })
    expect(await handleCheck(env)).toEqual({ webgl2: true, jpeg: false, webp: false })
  })

  it('counts a sample that cannot be made as unavailable', async () => {
    const { env } = setup()
    env.createSample = () => {
      throw new Error('no 2d canvas')
    }
    expect(await handleCheck(env)).toEqual({ webgl2: true, jpeg: false, webp: false })
  })

  it('reports no WebGL2 without trying a format when no context can be made', async () => {
    const { env, encodes, samples } = setup({ gl: null })
    expect(await handleCheck(env)).toEqual({ webgl2: false, jpeg: false, webp: false })
    expect(encodes).toEqual([])
    expect(samples).toEqual([])
  })
})

describe('handleExport with a Geometry (crop-rotate ADR-0002)', () => {
  const lastMatrix = (fake: FakeGl, name: string) => uniformCalls(fake, name).at(-1)?.[3]
  const lastFilter = (fake: FakeGl, name: string) =>
    fake.calls.filter(([m, , p]) => m === 'texParameteri' && p === name).at(-1)?.[3]

  it('maps the quad through the identity when the Work has no Geometry', async () => {
    const { fake, env } = setup()
    await handleExport(request(), env)
    expect(lastMatrix(fake!, 'u_geometry')).toEqual(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]))
  })

  it('renders only the Crop, turned, at its size, sampling texel centres 1:1 at full size', async () => {
    const { fake, env, canvases } = setup()
    const geometry: Geometry = {
      ...identityGeometry({ width: 4096, height: 3072 }),
      rotation: 90,
      flipH: true,
      crop: { x: 100, y: 200, width: 3000, height: 1000 },
    }
    const result = await handleExport(request({ width: 3000, height: 1000, geometry }), env)

    expect(result.ok).toBe(true)
    expect(canvases[0]).toMatchObject({ width: 3000, height: 1000, kind: 'webgl2' })
    expect(lastMatrix(fake!, 'u_geometry')).toEqual(
      new Float32Array(cropToOriginalUv(geometry, { width: 4096, height: 3072 })),
    )
    expect(lastFilter(fake!, 'TEXTURE_MIN_FILTER')).toBe('NEAREST')
    expect(lastFilter(fake!, 'TEXTURE_MAG_FILTER')).toBe('NEAREST')
  })

  it('magnifies LINEAR at full size while straightened, as the Preview does', async () => {
    const { fake, env } = setup()
    const geometry: Geometry = {
      ...identityGeometry({ width: 4096, height: 3072 }),
      straighten: 100,
      crop: { x: 400, y: 300, width: 3200, height: 2400 },
    }
    await handleExport(request({ width: 3200, height: 2400, geometry }), env)
    expect(lastFilter(fake!, 'TEXTURE_MAG_FILTER')).toBe('LINEAR')
  })
})

describe('handleAlpha (crop transparency check, crop-rotate ADR-0004)', () => {
  const geometry: Geometry = {
    ...identityGeometry({ width: 40, height: 30 }),
    crop: { x: 5, y: 5, width: 10, height: 8 },
  }

  function withPixels(alphaAt: number | null) {
    const ctx = setup()
    ctx.fake!.returns.readPixels = (...args: unknown[]) => {
      const out = args[6] as Uint8Array
      out.fill(255)
      if (alphaAt !== null) out[alphaAt * 4 + 3] = 254
    }
    return ctx
  }

  it('renders the Crop at its size without flattening and answers false when every pixel is opaque', async () => {
    const { fake, env, canvases } = withPixels(null)
    const bmp = bitmap(40, 30)
    await expect(handleAlpha({ bitmap: bmp, geometry, layer: null }, env)).resolves.toEqual({
      ok: true,
      value: false,
    })
    expect(canvases[0]).toMatchObject({ width: 10, height: 8, kind: 'webgl2' })
    expect(uniformCalls(fake!, 'u_flatten').at(-1)?.[2]).toBe(0)
    expect(uniformCalls(fake!, 'u_geometry').at(-1)?.[3]).toEqual(
      new Float32Array(cropToOriginalUv(geometry, { width: 40, height: 30 })),
    )
    expect(bmp.close).toHaveBeenCalledTimes(1)
  })

  it('answers true when any pixel inside the Crop is not fully opaque', async () => {
    const { env } = withPixels(79)
    const bmp = bitmap(40, 30)
    await expect(handleAlpha({ bitmap: bmp, geometry, layer: null }, env)).resolves.toEqual({
      ok: true,
      value: true,
    })
    expect(bmp.close).toHaveBeenCalledTimes(1)
  })

  it('fails and still closes the bitmap without WebGL2 or after a lost context', async () => {
    const none = setup({ gl: null })
    const a = bitmap(40, 30)
    await expect(handleAlpha({ bitmap: a, geometry, layer: null }, none.env)).resolves.toMatchObject({
      ok: false,
    })
    expect(a.close).toHaveBeenCalledTimes(1)

    const lost = withPixels(null)
    lost.fake!.returns.isContextLost = () => true
    const b = bitmap(40, 30)
    await expect(handleAlpha({ bitmap: b, geometry, layer: null }, lost.env)).resolves.toMatchObject({
      ok: false,
    })
    expect(b.close).toHaveBeenCalledTimes(1)
  })
})

describe('handleExport with Adjustments (adjust ADR-0002, AC-14)', () => {
  const adjusted = { ...NEUTRAL_ADJUSTMENTS, contrast: 40, sepia: 30 }
  const draws = (fake: FakeGl) => fake.names().filter((n) => n === 'drawArrays').length
  const adjustOn = (fake: FakeGl) =>
    uniformCalls(fake, 'u_adjust').map(([, , value]) => value as number)

  it('keeps one pass with the colour block off for neutral values, at any size', async () => {
    for (const size of [
      { width: 4096, height: 3072 },
      { width: 2048, height: 1536 },
    ]) {
      const { fake, env } = setup()
      await handleExport(request(size), env)
      expect(draws(fake!)).toBe(1)
      expect(adjustOn(fake!)).toEqual([0])
      expect(fake!.names()).not.toContain('createFramebuffer')
    }
  })

  it('renders a full-size adjusted Export in one pass with the request’s uniforms', async () => {
    const { fake, env } = setup()
    const result = await handleExport(request({ adjustments: adjusted }), env)
    expect(result.ok).toBe(true)
    expect(draws(fake!)).toBe(1)
    expect(adjustOn(fake!)).toEqual([1])
    expect(uniformCalls(fake!, 'u_contrast').at(-1)?.[2]).toBe(toUniforms(adjusted).contrast)
    expect(fake!.names()).not.toContain('createFramebuffer')
  })

  it('adjusts at full size, then reduces with mipmaps, for a smaller adjusted Export', async () => {
    const { fake, env } = setup()
    const req = request({ width: 1024, height: 768, format: 'jpeg', adjustments: adjusted })
    const result = await handleExport(req, env)
    expect(result.ok).toBe(true)
    expect(draws(fake!)).toBe(2)
    // Pass 1 at the Crop's full size with the colour block; pass 2 at the export size without it.
    const viewports = fake!.calls.filter(([n]) => n === 'viewport').map((c) => c.slice(1))
    expect(viewports).toEqual([
      [0, 0, 4096, 3072],
      [0, 0, 1024, 768],
    ])
    expect(adjustOn(fake!)).toEqual([1, 0])
    // The JPEG flatten happens only in the last pass.
    expect(uniformCalls(fake!, 'u_flatten').map(([, , v]) => v)).toEqual([0, 1])
    const passUpload = fake!.calls.find(([n, , , , w, h, , , , data]) => {
      return n === 'texImage2D' && w === 4096 && h === 3072 && data === null
    })
    expect(passUpload).toBeDefined()
    const afterPass1 = fake!.names().slice(fake!.names().indexOf('drawArrays'))
    expect(afterPass1).toContain('generateMipmap')
    expect(fake!.calls).toContainEqual([
      'texParameteri',
      'TEXTURE_2D',
      'TEXTURE_MIN_FILTER',
      'LINEAR_MIPMAP_LINEAR',
    ])
    expect(fake!.calls).toContainEqual(['bindFramebuffer', 'FRAMEBUFFER', null])
  })

  it('frees the pass framebuffer and texture', async () => {
    const { fake, env } = setup()
    await handleExport(request({ width: 1024, height: 768, adjustments: adjusted }), env)
    expect(fake!.names()).toContain('deleteFramebuffer')
    expect(fake!.names()).toContain('deleteTexture')
  })

  it('runs the transparency check without Adjustments', async () => {
    const { fake, env } = setup()
    await handleAlpha(
      { bitmap: bitmap(4, 4), geometry: identityGeometry({ width: 4, height: 4 }), layer: null },
      env,
    )
    expect(adjustOn(fake!)).toEqual([0])
  })
})

describe('handleExport with a Drawing layer (draw ADR-0003, AC-10)', () => {
  const marks = (width: number, height: number) =>
    ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) as unknown as ImageData
  const draws = (fake: FakeGl) => fake.names().filter((n) => n === 'drawArrays').length
  const drawOn = (fake: FakeGl) =>
    uniformCalls(fake, 'u_draw').map(([, , value]) => value as number)

  it('uploads the layer premultiplied on unit 1 and composites it at full size in one pass', async () => {
    const { fake, env } = setup()
    const layer = marks(4096, 3072)
    const result = await handleExport(request({ layer }), env)
    expect(result.ok).toBe(true)
    expect(draws(fake!)).toBe(1)
    // u_draw starts off in buildProgram, then the pass turns it on.
    expect(drawOn(fake!)).toEqual([0, 1])
    const unit1 = fake!.calls.findIndex(([n, u]) => n === 'activeTexture' && u === 'TEXTURE1')
    expect(unit1).toBeGreaterThanOrEqual(0)
    const upload = fake!.calls.find(([n, , , , , , data]) => n === 'texImage2D' && data === layer)
    expect(upload).toBeDefined()
    expect(fake!.calls).toContainEqual(['pixelStorei', 'UNPACK_PREMULTIPLY_ALPHA_WEBGL', true])
  })

  it('takes two passes for a smaller Export with a layer, neutral Adjustments included', async () => {
    const { fake, env } = setup()
    const result = await handleExport(
      request({ width: 1024, height: 768, layer: marks(4096, 3072) }),
      env,
    )
    expect(result.ok).toBe(true)
    expect(draws(fake!)).toBe(2)
    // The layer is composited in the first pass only, at full size.
    expect(drawOn(fake!)).toEqual([0, 1, 0])
  })

  it('keeps one pass for a smaller Export with no layer and neutral Adjustments', async () => {
    const { fake, env } = setup()
    await handleExport(request({ width: 1024, height: 768 }), env)
    expect(draws(fake!)).toBe(1)
    expect(drawOn(fake!)).toEqual([0, 0])
  })

  it('frees the layer texture', async () => {
    const { fake, env } = setup()
    const layer = marks(4096, 3072)
    await handleExport(request({ layer }), env)
    const upload = fake!.calls.findIndex(
      ([n, , , , , , data]) => n === 'texImage2D' && data === layer,
    )
    const bound = fake!.calls
      .slice(0, upload)
      .filter(([n]) => n === 'bindTexture')
      .at(-1)![2]
    expect(fake!.calls).toContainEqual(['deleteTexture', bound])
  })

  it('checks the Crop’s transparency with the layer composited', async () => {
    const { fake, env } = setup()
    await handleAlpha(
      {
        bitmap: bitmap(4, 4),
        geometry: identityGeometry({ width: 4, height: 4 }),
        layer: marks(4, 4),
      },
      env,
    )
    expect(drawOn(fake!)).toEqual([0, 1])
  })
})
