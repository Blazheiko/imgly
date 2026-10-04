import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { View } from '@/core'
import { createPreviewRenderer, type PreviewRenderer } from './preview-renderer'
import { createFakeCanvas, createFakeFrames, createFakeGl, type FakeGl } from './fake-gl'

const bitmap = (width: number, height: number) => ({ width, height }) as unknown as ImageBitmap
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
