import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cropToOriginalUv,
  identityGeometry,
  NEUTRAL_ADJUSTMENTS,
  turnedBounds,
  turnedImageToOriginalUv,
  type Geometry,
  type View,
} from '@/core'
import { viewToTransform } from './view-transform'
import { createPreviewRenderer, type PreviewRenderer } from './preview-renderer'
import { createFakeCanvas, createFakeFrames, createFakeGl, type FakeGl } from './fake-gl'

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
