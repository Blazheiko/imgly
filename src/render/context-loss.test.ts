import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { View } from '@/core'
import {
  createPreviewRenderer,
  RESTORE_DEADLINE_MS,
  type PreviewRenderer,
  type RendererStatus,
} from './preview-renderer'
import { createFakeCanvas, createFakeFrames, createFakeGl, type FakeGl } from './fake-gl'

const bitmap = { width: 4096, height: 2731 } as unknown as ImageBitmap
const view: View = { zoom: 0.5, panX: -100, panY: -50, autoFit: false }

describe('preview renderer — context loss (AC-19, AC-19b)', () => {
  let fake: FakeGl
  let canvas: ReturnType<typeof createFakeCanvas>
  let frames: ReturnType<typeof createFakeFrames>
  let renderer: PreviewRenderer
  let statuses: RendererStatus[]

  beforeEach(() => {
    vi.useFakeTimers()
    fake = createFakeGl()
    canvas = createFakeCanvas(fake.gl)
    frames = createFakeFrames()
    const result = createPreviewRenderer(canvas as unknown as HTMLCanvasElement, {
      ...frames,
      mark: () => {},
    })
    if (!result.ok) throw new Error('renderer failed')
    renderer = result.value
    statuses = []
    renderer.onStatus((s) => statuses.push(s))
    renderer.resize(800, 600)
    renderer.setOriginal(bitmap)
    renderer.setView(view)
    frames.flush()
    fake.calls.length = 0
  })
  afterEach(() => vi.useRealTimers())

  it('fixes the restore deadline at 5000 ms', () => {
    expect(RESTORE_DEADLINE_MS).toBe(5000)
  })

  it('starts ready', () => {
    expect(renderer.status).toBe('ready')
  })

  it('blocks the default on loss so the browser may restore, and reports restoring', () => {
    const event = canvas.dispatch('webglcontextlost')
    expect(event.defaultPrevented).toBe(true)
    expect(statuses).toEqual(['restoring'])
  })

  it('goes back to ready on a restore within the deadline, re-uploading from the kept bitmap', () => {
    canvas.dispatch('webglcontextlost')
    vi.advanceTimersByTime(1000)
    canvas.dispatch('webglcontextrestored')
    frames.flush()

    expect(statuses).toEqual(['restoring', 'ready'])
    const names = fake.names()
    expect(names).toContain('linkProgram')
    expect(fake.calls.find(([n]) => n === 'texImage2D')?.at(-1)).toBe(bitmap)
    expect(names).toContain('drawArrays')
    // Same View: the transform uniform is the one for the unchanged View.
    const uniform = fake.calls.filter(([n]) => n === 'uniformMatrix3fv').at(-1)
    expect(Array.from(uniform?.[3] as Float32Array)[6]).toBeCloseTo((2 * -100) / 800 - 1)
  })

  it('reports lost when the deadline passes without a restore', () => {
    canvas.dispatch('webglcontextlost')
    vi.advanceTimersByTime(RESTORE_DEADLINE_MS - 1)
    expect(renderer.status).toBe('restoring')
    vi.advanceTimersByTime(1)
    expect(statuses).toEqual(['restoring', 'lost'])
  })

  it('ignores a restore that arrives after the deadline', () => {
    canvas.dispatch('webglcontextlost')
    vi.advanceTimersByTime(RESTORE_DEADLINE_MS)
    canvas.dispatch('webglcontextrestored')
    frames.flush()

    expect(renderer.status).toBe('lost')
    expect(fake.names()).not.toContain('drawArrays')
  })

  it('reports lost when rebuilding the program fails', () => {
    canvas.dispatch('webglcontextlost')
    fake.returns.getProgramParameter = () => false
    canvas.dispatch('webglcontextrestored')

    expect(statuses).toEqual(['restoring', 'lost'])
  })

  it('restarts the deadline when the context is lost again while restoring', () => {
    canvas.dispatch('webglcontextlost')
    vi.advanceTimersByTime(4000)
    canvas.dispatch('webglcontextlost')
    vi.advanceTimersByTime(4000)
    expect(renderer.status).toBe('restoring')
    vi.advanceTimersByTime(1000)
    expect(renderer.status).toBe('lost')
  })

  it('does not draw while the context is lost', () => {
    canvas.dispatch('webglcontextlost')
    renderer.setView({ ...view, zoom: 1 })
    frames.flush()
    expect(fake.names()).not.toContain('drawArrays')
  })
})

describe('preview renderer — context loss with a Drawing layer (draw ADR-0003)', () => {
  it('re-uploads the layer from its canvas after a restore', async () => {
    const { createLayer, setLayerCanvasFactory } = await import('./drawing')
    const { createFakeCanvas: createFakeLayerCanvas } = await import('./drawing/fake-canvas')
    const previous = setLayerCanvasFactory(
      (w, h) => createFakeLayerCanvas(w, h) as unknown as OffscreenCanvas,
    )
    const fake = createFakeGl()
    const canvas = createFakeCanvas(fake.gl)
    const frames = createFakeFrames()
    const result = createPreviewRenderer(canvas as unknown as HTMLCanvasElement, {
      ...frames,
      mark: () => {},
    })
    if (!result.ok) throw new Error('renderer failed')
    const renderer = result.value
    renderer.resize(800, 600)
    renderer.setOriginal({ width: 16, height: 8 } as unknown as ImageBitmap)
    renderer.setView(view)
    renderer.setLayer(createLayer({ width: 16, height: 8 }))
    frames.flush()
    fake.calls.length = 0

    canvas.dispatch('webglcontextlost')
    canvas.dispatch('webglcontextrestored')
    frames.flush()
    const layerUploads = fake.calls.filter(
      ([n, , , , , , data]) =>
        n === 'texImage2D' && (data as ImageData)?.width === 16 && 'data' in (data as object),
    )
    expect(layerUploads).toHaveLength(1)
    expect(
      fake.calls.filter(([n, unit]) => n === 'activeTexture' && unit === 'TEXTURE1').length,
    ).toBeGreaterThan(0)
    setLayerCanvasFactory(previous)
  })
})
