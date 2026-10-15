import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createWork,
  cropToOriginalUv,
  identityGeometry,
  NEUTRAL_ADJUSTMENTS,
  turnedBounds,
  turnedImageToOriginalUv,
  type Geometry,
  type View,
} from '@/core'
import { viewToTransform } from './view-transform'
import {
  createPreviewRenderer,
  THUMBNAIL_LONG_SIDE,
  type PreviewRenderer,
} from './preview-renderer'
import { createFakeCanvas, createFakeFrames, createFakeGl, type FakeGl } from './fake-gl'
import {
  createLayer,
  layerContext,
  setLayerCanvasFactory,
  type CanvasFactory,
  type Layer,
} from './drawing'
import { createFakeCanvas as createFakeLayerCanvas } from './drawing/fake-canvas'

const bitmap = (width: number, height: number) => ({ width, height }) as unknown as ImageBitmap
const uniformCalls = (fake: FakeGl, name: string) =>
  fake.calls.filter(
    ([method, location]) =>
      method.startsWith('uniform') && (location as { uniform?: string })?.uniform === name,
  )
const view = (zoom: number): View => ({ zoom, panX: 0, panY: 0, autoFit: false })

describe('createPreviewRenderer', () => {
  let fake: FakeGl
  let frames: ReturnType<typeof createFakeFrames>
  let mark: ReturnType<typeof vi.fn<(name: string) => void>>
  let renderer: PreviewRenderer

  beforeEach(() => {
    fake = createFakeGl()
    frames = createFakeFrames()
    mark = vi.fn<(name: string) => void>()
    const canvas = createFakeCanvas(fake.gl) as unknown as HTMLCanvasElement
    const result = createPreviewRenderer(canvas, { ...frames, mark })
    if (!result.ok) throw new Error('renderer failed')
    renderer = result.value
    renderer.resize(800, 600)
    renderer.setOriginal(bitmap(4096, 2731))
    renderer.setView(view(0.19))
    frames.flush()
    fake.calls.length = 0
    mark.mockClear()
  })

  it('reports UNSUPPORTED_BROWSER without a WebGL2 context', () => {
    const canvas = createFakeCanvas(null) as unknown as HTMLCanvasElement
    expect(createPreviewRenderer(canvas, frames)).toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED_BROWSER' },
    })
  })

  it('reports DISPLAY_LOST instead of throwing when the program cannot be built (AC-19b)', () => {
    const broken = createFakeGl()
    broken.returns.getProgramParameter = () => false
    const canvas = createFakeCanvas(broken.gl) as unknown as HTMLCanvasElement
    expect(createPreviewRenderer(canvas, frames)).toEqual({
      ok: false,
      error: { code: 'DISPLAY_LOST' },
    })
  })

  it('schedules exactly one frame for several changes before it runs', () => {
    renderer.setView(view(0.5))
    renderer.setView(view(0.6))
    renderer.resize(1024, 768)

    expect(frames.pending).toBe(1)
    frames.flush()
    expect(fake.names().filter((n) => n === 'drawArrays')).toHaveLength(1)
  })

  it('draws nothing while idle', () => {
    frames.flush()
    expect(frames.pending).toBe(0)
    expect(fake.names()).not.toContain('drawArrays')
  })

  it('ignores a View equal to the current one', () => {
    renderer.setView(view(0.19))
    expect(frames.pending).toBe(0)
  })

  it('uploads the new Original before deleting the old texture', () => {
    renderer.setOriginal(bitmap(640, 480))
    frames.flush()

    const names = fake.names()
    const upload = names.indexOf('texImage2D')
    const remove = names.indexOf('deleteTexture')
    expect(upload).toBeGreaterThanOrEqual(0)
    expect(remove).toBeGreaterThan(upload)
    expect(names).toContain('generateMipmap')
  })

  it('marks imgly:first-frame on the first frame after a new Original only', () => {
    renderer.setOriginal(bitmap(640, 480))
    frames.flush()
    expect(mark).toHaveBeenCalledWith('imgly:first-frame')

    mark.mockClear()
    renderer.setView(view(0.7))
    frames.flush()
    expect(mark).not.toHaveBeenCalled()
  })

  it('does not draw on a 0×0 canvas', () => {
    renderer.resize(0, 0)
    frames.flush()
    expect(fake.names()).not.toContain('drawArrays')
  })

  it('samples NEAREST when magnifying at or above 100% and LINEAR below', () => {
    const magFilters = () =>
      fake.calls.filter(([n, , pname]) => n === 'texParameteri' && pname === 'TEXTURE_MAG_FILTER')

    renderer.setView(view(2))
    frames.flush()
    expect(magFilters().at(-1)?.[3]).toBe('NEAREST')

    renderer.setView(view(0.5))
    frames.flush()
    expect(magFilters().at(-1)?.[3]).toBe('LINEAR')
  })

  it('never closes the bitmap it was given', () => {
    const close = vi.fn()
    renderer.setOriginal({ width: 2, height: 2, close } as unknown as ImageBitmap)
    renderer.setOriginal(bitmap(4, 4))
    frames.flush()
    expect(close).not.toHaveBeenCalled()
  })

  it('cancels its pending frame and frees GPU objects on dispose', () => {
    renderer.setView(view(0.3))
    renderer.dispose()
    expect(frames.pending).toBe(0)
    expect(fake.names()).toContain('deleteTexture')
    expect(fake.names()).toContain('deleteProgram')
  })
})

describe('PreviewRenderer.setGeometry (crop-rotate ADR-0002)', () => {
  const original = { width: 4096, height: 2731 }
  let fake: FakeGl
  let frames: ReturnType<typeof createFakeFrames>
  let renderer: PreviewRenderer
  let canvas: ReturnType<typeof createFakeCanvas>

  beforeEach(() => {
    fake = createFakeGl()
    frames = createFakeFrames()
    canvas = createFakeCanvas(fake.gl)
    const result = createPreviewRenderer(canvas as unknown as HTMLCanvasElement, frames)
    if (!result.ok) throw new Error('renderer failed')
    renderer = result.value
    renderer.resize(800, 600)
    renderer.setOriginal(bitmap(original.width, original.height))
    renderer.setView(view(2))
    frames.flush()
    fake.calls.length = 0
  })

  const lastMatrix = (name: string) => uniformCalls(fake, name).at(-1)?.[3]
  const lastFilter = () =>
    fake.calls.filter(([n, , p]) => n === 'texParameteri' && p === 'TEXTURE_MAG_FILTER').at(-1)?.[3]

  it('draws the identity Geometry exactly as before when none is set', () => {
    renderer.setView(view(0.5))
    frames.flush()
    expect(lastMatrix('u_geometry')).toEqual(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]))
    expect(lastMatrix('u_transform')).toEqual(
      viewToTransform(view(0.5), original, { width: 800, height: 600 }),
    )
  })

  it("'crop' maps the quad over the Crop and sizes it by the Work's size", () => {
    const g: Geometry = {
      ...identityGeometry(original),
      rotation: 90,
      flipH: true,
      crop: { x: 10, y: 20, width: 300, height: 200 },
    }
    renderer.setGeometry(g, 'crop')
    expect(frames.pending).toBe(1)
    frames.flush()

    expect(lastMatrix('u_geometry')).toEqual(new Float32Array(cropToOriginalUv(g, original)))
    expect(lastMatrix('u_transform')).toEqual(
      viewToTransform(view(2), { width: 300, height: 200 }, { width: 800, height: 600 }),
    )
  })

  it("'whole' maps the quad over the whole turned image and sizes it by its bounds", () => {
    const g: Geometry = { ...identityGeometry(original), straighten: 200 }
    renderer.setGeometry(g, 'whole')
    frames.flush()

    const b = turnedBounds(g, original)
    expect(lastMatrix('u_geometry')).toEqual(new Float32Array(turnedImageToOriginalUv(g, original)))
    expect(lastMatrix('u_transform')).toEqual(
      viewToTransform(view(2), { width: b.width, height: b.height }, { width: 800, height: 600 }),
    )
  })

  it('magnifies LINEAR while straightened and NEAREST again at 0° (zoom ≥ 1)', () => {
    const at = (straighten: number) => {
      renderer.setGeometry({ ...identityGeometry(original), straighten }, 'whole')
      frames.flush()
      return lastFilter()
    }
    expect(at(0)).toBe('NEAREST')
    expect(at(50)).toBe('LINEAR')
    expect(at(0)).toBe('NEAREST')
  })

  it('allocates no texture or buffer per call while dragging', () => {
    for (let i = 1; i <= 20; i++) {
      renderer.setGeometry({ ...identityGeometry(original), straighten: i }, 'whole')
      frames.flush()
    }
    const names = fake.names()
    for (const n of ['createTexture', 'createBuffer', 'texImage2D', 'bufferData']) {
      expect(names).not.toContain(n)
    }
  })

  it('re-applies the last Geometry and mode after the context comes back', () => {
    const g: Geometry = {
      ...identityGeometry(original),
      crop: { x: 0, y: 0, width: 50, height: 40 },
    }
    renderer.setGeometry(g, 'crop')
    frames.flush()
    canvas.dispatch('webglcontextlost')
    canvas.dispatch('webglcontextrestored')
    fake.calls.length = 0
    frames.flush()

    expect(lastMatrix('u_geometry')).toEqual(new Float32Array(cropToOriginalUv(g, original)))
  })

  describe('setAdjustments (adjust ADR-0002)', () => {
    const adjusted = { ...NEUTRAL_ADJUSTMENTS, contrast: 40 }

    it('requests exactly one frame per change and uploads no texture', () => {
      renderer.setAdjustments(adjusted)
      renderer.setAdjustments({ ...adjusted, contrast: 41 })
      expect(frames.pending).toBe(1)
      frames.flush()
      expect(fake.names().filter((n) => n === 'drawArrays')).toHaveLength(1)
      expect(fake.names()).not.toContain('texImage2D')
      expect(fake.names()).not.toContain('createTexture')
    })

    it('draws with the latest values', () => {
      renderer.setAdjustments(adjusted)
      renderer.setAdjustments({ ...adjusted, contrast: 41 })
      frames.flush()
      expect(uniformCalls(fake, 'u_adjust').at(-1)).toEqual([
        'uniform1i',
        { uniform: 'u_adjust' },
        1,
      ])
      expect(uniformCalls(fake, 'u_contrast').at(-1)?.[2]).toBeCloseTo(1 / (1 - 0.75 * 0.41), 10)
    })

    it('requests no frame when the values did not change', () => {
      renderer.setAdjustments(adjusted)
      frames.flush()
      renderer.setAdjustments({ ...adjusted })
      expect(frames.pending).toBe(0)
    })

    it('draws neutral values with u_adjust false, also before any call', () => {
      renderer.setView(view(0.5))
      frames.flush()
      expect(uniformCalls(fake, 'u_adjust').at(-1)).toEqual([
        'uniform1i',
        { uniform: 'u_adjust' },
        0,
      ])
      renderer.setAdjustments(adjusted)
      frames.flush()
      renderer.setAdjustments(NEUTRAL_ADJUSTMENTS)
      frames.flush()
      expect(uniformCalls(fake, 'u_adjust').at(-1)).toEqual([
        'uniform1i',
        { uniform: 'u_adjust' },
        0,
      ])
    })
  })
})

describe('PreviewRenderer.sampleCrop (adjust ADR-0004)', () => {
  let fake: FakeGl
  let frames: ReturnType<typeof createFakeFrames>
  let canvas: ReturnType<typeof createFakeCanvas>
  let renderer: PreviewRenderer

  const crop = (width: number, height: number, over: Partial<Geometry> = {}): Geometry => ({
    ...identityGeometry({ width: 4096, height: 4096 }),
    crop: { x: 0, y: 0, width, height },
    ...over,
  })

  beforeEach(() => {
    fake = createFakeGl()
    frames = createFakeFrames()
    canvas = createFakeCanvas(fake.gl)
    const result = createPreviewRenderer(canvas as unknown as HTMLCanvasElement, frames)
    if (!result.ok) throw new Error('renderer failed')
    renderer = result.value
    renderer.resize(800, 600)
    renderer.setOriginal(bitmap(4096, 4096))
    renderer.setView(view(0.19))
    renderer.setAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 50 })
    frames.flush()
    fake.calls.length = 0
  })

  const targetUpload = () =>
    fake.calls.find(([name, , , , , , , , , data]) => name === 'texImage2D' && data === null)

  it.each([
    [300, 200, 300, 200],
    [4096, 1024, 512, 128],
    [1000, 3000, 171, 512],
    [512, 512, 512, 512],
  ])('samples a %d×%d Crop at %d×%d, keeping its proportion', (w, h, sw, sh) => {
    const result = renderer.sampleCrop(crop(w, h), 512)
    expect(result.ok && { width: result.value.width, height: result.value.height }).toEqual({
      width: sw,
      height: sh,
    })
    expect(result.ok && result.value.data.length).toBe(sw * sh * 4)
    expect(targetUpload()?.slice(4, 6)).toEqual([sw, sh])
    expect(fake.calls).toContainEqual(['viewport', 0, 0, sw, sh])
    expect(fake.calls).toContainEqual([
      'readPixels',
      0,
      0,
      sw,
      sh,
      'RGBA',
      'UNSIGNED_BYTE',
      expect.any(Uint8Array),
    ])
  })

  it('maps the quad through the Crop with exact texels and no Adjustments or flatten', () => {
    const g = crop(300, 200, { crop: { x: 40, y: 50, width: 300, height: 200 } })
    renderer.sampleCrop(g, 512)
    expect(uniformCalls(fake, 'u_geometry').at(-1)?.[3]).toEqual(
      new Float32Array(cropToOriginalUv(g, { width: 4096, height: 4096 })),
    )
    expect(fake.calls).toContainEqual([
      'texParameteri',
      'TEXTURE_2D',
      'TEXTURE_MIN_FILTER',
      'NEAREST',
    ])
    expect(fake.calls).toContainEqual([
      'texParameteri',
      'TEXTURE_2D',
      'TEXTURE_MAG_FILTER',
      'NEAREST',
    ])
    expect(uniformCalls(fake, 'u_adjust').at(-1)).toEqual(['uniform1i', { uniform: 'u_adjust' }, 0])
    expect(uniformCalls(fake, 'u_flatten').at(-1)).toEqual([
      'uniform1i',
      { uniform: 'u_flatten' },
      0,
    ])
  })

  it('frees the framebuffer and its texture and restores the filter before the next frame', () => {
    renderer.sampleCrop(crop(300, 200), 512)
    const names = fake.names()
    expect(names).toContain('deleteFramebuffer')
    expect(names.filter((n) => n === 'deleteTexture')).toHaveLength(1)
    expect(fake.calls.at(-1)).toEqual([
      'texParameteri',
      'TEXTURE_2D',
      'TEXTURE_MIN_FILTER',
      'LINEAR_MIPMAP_LINEAR',
    ])
    expect(fake.calls).toContainEqual(['bindFramebuffer', 'FRAMEBUFFER', null])

    renderer.setView(view(0.5))
    fake.calls.length = 0
    frames.flush()
    expect(uniformCalls(fake, 'u_adjust').at(-1)).toEqual(['uniform1i', { uniform: 'u_adjust' }, 1])
  })

  it('frees everything and reports DISPLAY_LOST when the readback throws', () => {
    fake.returns.readPixels = () => {
      throw new Error('lost')
    }
    expect(renderer.sampleCrop(crop(300, 200), 512)).toEqual({
      ok: false,
      error: { code: 'DISPLAY_LOST' },
    })
    expect(fake.names()).toContain('deleteFramebuffer')
    expect(fake.names()).toContain('deleteTexture')
  })

  it('reports DISPLAY_LOST and allocates nothing while the context is lost or after dispose', () => {
    canvas.dispatch('webglcontextlost')
    expect(renderer.sampleCrop(crop(300, 200), 512)).toEqual({
      ok: false,
      error: { code: 'DISPLAY_LOST' },
    })
    expect(fake.names()).not.toContain('createFramebuffer')
    canvas.dispatch('webglcontextrestored')
    renderer.dispose()
    expect(renderer.sampleCrop(crop(300, 200), 512).ok).toBe(false)
    expect(fake.names()).not.toContain('createFramebuffer')
  })
})

describe('PreviewRenderer.setLayer / updateLayer (draw ADR-0003)', () => {
  const original = { width: 64, height: 32 }
  let fake: FakeGl
  let frames: ReturnType<typeof createFakeFrames>
  let renderer: PreviewRenderer
  let previousFactory: CanvasFactory
  let layer: Layer

  beforeEach(() => {
    previousFactory = setLayerCanvasFactory(
      (w, h) => createFakeLayerCanvas(w, h) as unknown as OffscreenCanvas,
    )
    layer = createLayer(original)
    fake = createFakeGl()
    frames = createFakeFrames()
    const canvas = createFakeCanvas(fake.gl) as unknown as HTMLCanvasElement
    const result = createPreviewRenderer(canvas, frames)
    if (!result.ok) throw new Error('renderer failed')
    renderer = result.value
    renderer.resize(800, 600)
    renderer.setOriginal(bitmap(original.width, original.height))
    renderer.setView(view(0.5))
    frames.flush()
    fake.calls.length = 0
  })
  afterEach(() => {
    setLayerCanvasFactory(previousFactory)
  })

  const drawFlag = () => uniformCalls(fake, 'u_draw').at(-1)?.[2]
  const uploads = () =>
    fake.calls.filter(([n, , , , , , data]) => n === 'texImage2D' && data !== null)

  it('draws with u_draw off when no layer is set, exactly as before', () => {
    renderer.setView(view(0.6))
    frames.flush()
    expect(drawFlag()).toBe(0)
    expect(fake.calls).not.toContainEqual(['activeTexture', 'TEXTURE1'])
  })

  it('uploads the whole layer premultiplied on unit 1 and draws with u_draw on', () => {
    layerContext(layer) // drawn into: not a blank layer
    renderer.setLayer(layer)
    expect(frames.pending).toBe(1)
    frames.flush()
    const at = fake.calls.findIndex(([n, unit]) => n === 'activeTexture' && unit === 'TEXTURE1')
    expect(at).toBeGreaterThanOrEqual(0)
    expect(fake.calls).toContainEqual(['pixelStorei', 'UNPACK_PREMULTIPLY_ALPHA_WEBGL', true])
    const upload = uploads().at(-1)!
    expect((upload.at(-1) as ImageData).width).toBe(64)
    expect(drawFlag()).toBe(1)
  })

  it('allocates a blank layer zero-filled: no readback and no pixel upload (spec §6 latency)', () => {
    const pixels = layer.pixels as unknown as ReturnType<typeof createFakeLayerCanvas>
    pixels.calls.length = 0
    renderer.setLayer(layer)
    frames.flush()
    expect(pixels.calls.filter((c) => c[0] === 'getImageData')).toEqual([])
    const pixelUploads = fake.calls.filter(
      (c) => (c[0] === 'texImage2D' || c[0] === 'texSubImage2D') && c.at(-1) !== null,
    )
    expect(pixelUploads).toEqual([])
    const blank = fake.calls.find(
      ([n, , , , , , , , , data]) => n === 'texImage2D' && data === null,
    )
    expect(blank?.slice(4, 6)).toEqual([64, 32])
    expect(drawFlag()).toBe(1)
  })

  it('sets the same magnification filter on both units', () => {
    renderer.setLayer(layer)
    renderer.setView(view(2))
    frames.flush()
    const mags = fake.calls.filter(
      ([n, , p]) => n === 'texParameteri' && p === 'TEXTURE_MAG_FILTER',
    )
    expect(mags.slice(-2).map((c) => c[3])).toEqual(['NEAREST', 'NEAREST'])
  })

  it('setLayer(null) turns u_draw off and frees the texture', () => {
    renderer.setLayer(layer)
    frames.flush()
    fake.calls.length = 0
    renderer.setLayer(null)
    frames.flush()
    expect(fake.names()).toContain('deleteTexture')
    expect(drawFlag()).toBe(0)
  })

  it('uploads nothing for the same canvas with a new id (Apply), and requests one frame', () => {
    renderer.setLayer(layer)
    frames.flush()
    fake.calls.length = 0
    renderer.setLayer({ ...layer, id: 'applied' })
    expect(frames.pending).toBe(1)
    frames.flush()
    expect(uploads()).toHaveLength(0)
    expect(drawFlag()).toBe(1)
  })

  it('updateLayer at 100% or above uploads only the rectangle, no mipmaps', () => {
    renderer.setLayer(layer)
    renderer.setView(view(1))
    frames.flush()
    fake.calls.length = 0
    renderer.updateLayer({ x: 4, y: 2, width: 8, height: 6 })
    expect(frames.pending).toBe(1)
    frames.flush()
    const sub = fake.calls.find(([n]) => n === 'texSubImage2D')!
    expect(sub.slice(1, 4)).toEqual(['TEXTURE_2D', 0, 4])
    expect(sub[4]).toBe(2)
    expect((sub.at(-1) as ImageData).width).toBe(8)
    expect(fake.names()).not.toContain('generateMipmap')
  })

  it('uploads several updateLayer calls in one frame once, covering their union', () => {
    renderer.setLayer(layer)
    renderer.setView(view(1))
    frames.flush()
    fake.calls.length = 0
    renderer.updateLayer({ x: 4, y: 2, width: 2, height: 2 })
    renderer.updateLayer({ x: 10, y: 8, width: 2, height: 2 })
    expect(fake.names()).not.toContain('texSubImage2D')
    expect(frames.pending).toBe(1)
    frames.flush()
    const subs = fake.calls.filter(([n]) => n === 'texSubImage2D')
    expect(subs).toHaveLength(1)
    expect(subs[0]!.slice(3, 5)).toEqual([4, 2])
    expect((subs[0]!.at(-1) as ImageData).width).toBe(8)
    expect((subs[0]!.at(-1) as ImageData).height).toBe(8)
  })

  it('updateLayer below 100% regenerates the mipmaps', () => {
    renderer.setLayer(layer)
    frames.flush()
    fake.calls.length = 0
    renderer.updateLayer({ x: 0, y: 0, width: 4, height: 4 })
    frames.flush()
    expect(fake.names()).toContain('texSubImage2D')
    expect(fake.names()).toContain('generateMipmap')
  })

  it('below 100% regenerates the mipmaps at most every other frame, and once more after (T9 fallback 1)', () => {
    renderer.setLayer(layer)
    frames.flush()
    const regens = () => fake.names().filter((n) => n === 'generateMipmap').length
    fake.calls.length = 0
    renderer.updateLayer({ x: 0, y: 0, width: 4, height: 4 })
    frames.flush()
    expect(regens()).toBe(1)
    renderer.updateLayer({ x: 4, y: 0, width: 4, height: 4 })
    frames.flush()
    expect(regens()).toBe(1) // skipped: the frame before regenerated
    expect(fake.names().filter((n) => n === 'texSubImage2D')).toHaveLength(2)
    expect(frames.pending).toBe(1) // a follow-up frame catches the mipmaps up
    frames.flush()
    expect(regens()).toBe(2)
    expect(frames.pending).toBe(0)
  })

  it('regenerates stale mipmaps once the View goes below 100% after updates at 100%', () => {
    renderer.setLayer(layer)
    renderer.setView(view(1))
    frames.flush()
    renderer.updateLayer({ x: 0, y: 0, width: 4, height: 4 })
    frames.flush()
    fake.calls.length = 0
    renderer.setView(view(0.5))
    frames.flush()
    expect(fake.names()).toContain('generateMipmap')
  })

  it('ignores an updateLayer wholly outside the layer or with no layer', () => {
    renderer.updateLayer({ x: 0, y: 0, width: 4, height: 4 })
    renderer.setLayer(layer)
    frames.flush()
    fake.calls.length = 0
    renderer.updateLayer({ x: 100, y: 100, width: 4, height: 4 })
    expect(fake.names()).not.toContain('texSubImage2D')
  })

  it('keeps marks out of Auto’s sample (u_draw false)', () => {
    renderer.setLayer(layer)
    frames.flush()
    fake.calls.length = 0
    renderer.sampleCrop(identityGeometry(original), 512)
    expect(drawFlag()).toBe(0)
  })
})

describe('PreviewRenderer.renderThumbnail (gallery ADR-0005, AC-01, AC-03)', () => {
  type EditorWork = ReturnType<typeof createWork<ImageBitmap, OffscreenCanvas>>
  const PREVIEW = { width: 800, height: 600 }
  let fake: FakeGl
  let frames: ReturnType<typeof createFakeFrames>
  let renderer: PreviewRenderer
  let canvas: ReturnType<typeof createFakeCanvas>
  let previousFactory: CanvasFactory

  const workOf = (width: number, height: number, over: Partial<EditorWork> = {}): EditorWork => ({
    ...createWork<ImageBitmap, OffscreenCanvas>(
      { width, height, pixels: bitmap(width, height), hasTransparency: false },
      'w1',
      { sourceName: 'a.jpg', sourceFormat: 'jpeg' },
      0,
    ),
    ...over,
  })

  function open(width: number, height: number) {
    renderer.setOriginal(bitmap(width, height))
    renderer.setView(view(0.19))
    frames.flush()
    fake.calls.length = 0
  }

  // Calls made by renderThumbnail itself (the fake's saved Preview state is not a pass size).
  const passSizes = () =>
    fake.calls
      .filter(
        ([n, x, y, w, h]) =>
          n === 'viewport' && !(x === 0 && y === 0 && w === PREVIEW.width && h === PREVIEW.height),
      )
      .map(([, , , w, h]) => [w as number, h as number])

  beforeEach(() => {
    previousFactory = setLayerCanvasFactory(
      (w, h) => createFakeLayerCanvas(w, h) as unknown as OffscreenCanvas,
    )
    fake = createFakeGl()
    fake.returns.getParameter = (pname) =>
      pname === 'VIEWPORT' ? new Int32Array([0, 0, PREVIEW.width, PREVIEW.height]) : null
    frames = createFakeFrames()
    canvas = createFakeCanvas(fake.gl)
    const result = createPreviewRenderer(canvas as unknown as HTMLCanvasElement, frames)
    if (!result.ok) throw new Error('renderer failed')
    renderer = result.value
    renderer.resize(PREVIEW.width, PREVIEW.height)
  })
  afterEach(() => {
    setLayerCanvasFactory(previousFactory)
  })

  it('has a long side of 320 px', () => {
    expect(THUMBNAIL_LONG_SIDE).toBe(320)
  })

  it('reduces 4096×3072 in passes of at most 2:1 down to exactly 320×240, read back as ImageData', () => {
    open(4096, 3072)
    const image = renderer.renderThumbnail(workOf(4096, 3072))

    expect(image).not.toBeNull()
    expect({ width: image!.width, height: image!.height }).toEqual({ width: 320, height: 240 })
    expect(image!.data.length).toBe(320 * 240 * 4)
    const sizes = passSizes()
    expect(sizes[0]).toEqual([4096, 3072])
    expect(sizes.at(-1)).toEqual([320, 240])
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i - 1]![0]! / sizes[i]![0]!).toBeLessThanOrEqual(2)
      expect(sizes[i - 1]![1]! / sizes[i]![1]!).toBeLessThanOrEqual(2)
      expect(sizes[i]![0]).toBeLessThan(sizes[i - 1]![0]!)
    }
    expect(fake.calls).toContainEqual([
      'readPixels',
      0,
      0,
      320,
      240,
      'RGBA',
      'UNSIGNED_BYTE',
      expect.any(Uint8Array),
    ])
  })

  it('makes a 4096×4096 Original 320×320', () => {
    open(4096, 4096)
    const image = renderer.renderThumbnail(workOf(4096, 4096))
    expect([image?.width, image?.height]).toEqual([320, 320])
    const sizes = passSizes()
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i - 1]![0]! / sizes[i]![0]!).toBeLessThanOrEqual(2)
    }
  })

  it('never upscales: a 1×1 Work is one pass at 1×1', () => {
    open(1, 1)
    const image = renderer.renderThumbnail(workOf(1, 1))
    expect([image?.width, image?.height]).toEqual([1, 1])
    expect(passSizes()).toEqual([[1, 1]])
  })

  it('honours maxSide: min(maxSide, output long side)', () => {
    open(4096, 3072)
    const image = renderer.renderThumbnail(workOf(4096, 3072), 512)
    expect([image?.width, image?.height]).toEqual([512, 384])
  })

  it('follows the cropped, turned output aspect', () => {
    open(4096, 3072)
    const g: Geometry = {
      ...identityGeometry({ width: 4096, height: 3072 }),
      rotation: 90,
      crop: { x: 0, y: 0, width: 1000, height: 500 },
    }
    const image = renderer.renderThumbnail(workOf(4096, 3072, { geometry: g }))
    expect([image?.width, image?.height]).toEqual([320, 160])
  })

  it('draws the applied Work, never the Draft shown in a tool', () => {
    open(4096, 3072)
    const draftGeometry = { ...identityGeometry({ width: 4096, height: 3072 }), straighten: 200 }
    renderer.setGeometry(draftGeometry, 'whole')
    renderer.setAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 90 })
    frames.flush()
    fake.calls.length = 0

    const applied: Geometry = {
      ...identityGeometry({ width: 4096, height: 3072 }),
      crop: { x: 10, y: 20, width: 2000, height: 1000 },
    }
    const adjusted = { ...NEUTRAL_ADJUSTMENTS, contrast: 40 }
    renderer.renderThumbnail(workOf(4096, 3072, { geometry: applied, adjustments: adjusted }))

    expect(uniformCalls(fake, 'u_geometry').map((c) => c[3])).toContainEqual(
      new Float32Array(cropToOriginalUv(applied, { width: 4096, height: 3072 })),
    )
    expect(uniformCalls(fake, 'u_geometry').map((c) => c[3])).not.toContainEqual(
      new Float32Array(turnedImageToOriginalUv(draftGeometry, { width: 4096, height: 3072 })),
    )
    expect(uniformCalls(fake, 'u_adjust')).toContainEqual(['uniform1i', { uniform: 'u_adjust' }, 1])
    const contrasts = uniformCalls(fake, 'u_contrast').map((c) => c[2] as number)
    expect(contrasts).toContainEqual(expect.closeTo(1 / (1 - 0.75 * 0.4), 10))
    expect(contrasts).not.toContainEqual(expect.closeTo(1 / (1 - 0.75 * 0.9), 10))
  })

  it("draws the Work's applied layer over the image, not the Preview's Draft layer", () => {
    open(64, 32)
    const draft = createLayer({ width: 64, height: 32 })
    layerContext(draft)
    renderer.setLayer(draft)
    frames.flush()
    fake.calls.length = 0

    const applied = createLayer({ width: 64, height: 32 })
    layerContext(applied)
    const drawing = { id: applied.id, width: 64, height: 32, pixels: applied.pixels }
    renderer.renderThumbnail(
      workOf(64, 32, { drawing: drawing as unknown as EditorWork['drawing'] }),
    )

    expect(uniformCalls(fake, 'u_draw')).toContainEqual(['uniform1i', { uniform: 'u_draw' }, 1])
    expect(fake.calls).toContainEqual(['activeTexture', 'TEXTURE1'])
  })

  it('draws without a layer texture when the Work has no Drawing, as the Preview does', () => {
    open(64, 32)
    renderer.renderThumbnail(workOf(64, 32))
    expect(uniformCalls(fake, 'u_draw')).not.toContainEqual(['uniform1i', { uniform: 'u_draw' }, 1])
  })

  it('draws into offscreen framebuffers and frees every texture and framebuffer it made', () => {
    open(4096, 3072)
    renderer.renderThumbnail(workOf(4096, 3072))
    const count = (n: string) => fake.names().filter((x) => x === n).length
    expect(count('createFramebuffer')).toBeGreaterThan(0)
    expect(count('framebufferTexture2D')).toBeGreaterThan(0)
    expect(count('deleteFramebuffer')).toBe(count('createFramebuffer'))
    expect(count('deleteTexture')).toBe(count('createTexture'))
  })

  it('restores the framebuffer, viewport and filter so the next Preview draw is unchanged', () => {
    open(4096, 3072)
    const previewFrame = () => {
      renderer.setView(view(0.6))
      frames.flush()
      renderer.setView(view(0.5))
      fake.calls.length = 0
      frames.flush()
      return fake.calls.map((c) => JSON.stringify(c))
    }
    const before = previewFrame()

    fake.calls.length = 0
    renderer.renderThumbnail(workOf(4096, 3072))
    const bindings = fake.calls.filter(([n, target]) => n === 'bindFramebuffer' && target)
    expect(bindings.at(-1)).toEqual(['bindFramebuffer', 'FRAMEBUFFER', null])
    expect(fake.calls.filter(([n]) => n === 'viewport').at(-1)).toEqual([
      'viewport',
      0,
      0,
      PREVIEW.width,
      PREVIEW.height,
    ])
    const minFilters = fake.calls.filter(
      ([n, , p]) => n === 'texParameteri' && p === 'TEXTURE_MIN_FILTER',
    )
    if (minFilters.length) expect(minFilters.at(-1)?.[3]).toBe('LINEAR_MIPMAP_LINEAR')

    expect(previewFrame()).toEqual(before)
  })

  it('returns null and allocates nothing while the display is lost or restoring', () => {
    open(4096, 3072)
    canvas.dispatch('webglcontextlost')
    expect(renderer.status).toBe('restoring')
    expect(renderer.renderThumbnail(workOf(4096, 3072))).toBeNull()
    expect(fake.names()).not.toContain('createFramebuffer')
    expect(fake.names()).not.toContain('drawArrays')
  })
})
