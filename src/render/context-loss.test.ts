import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { View } from '@/core'
import {
  createPreviewRenderer,
  RESTORE_DEADLINE_MS,
  type PreviewRenderer,
  type RendererStatus,
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
  let fake: FakeGl
  let canvas: ReturnType<typeof createFakeCanvas>
  let frames: ReturnType<typeof createFakeFrames>
  let renderer: PreviewRenderer
  let previous: CanvasFactory

  beforeEach(() => {
    previous = setLayerCanvasFactory(
      (w, h) => createFakeLayerCanvas(w, h) as unknown as OffscreenCanvas,
    )
    fake = createFakeGl()
    canvas = createFakeCanvas(fake.gl)
    frames = createFakeFrames()
    const result = createPreviewRenderer(canvas as unknown as HTMLCanvasElement, {
      ...frames,
      mark: () => {},
    })
    if (!result.ok) throw new Error('renderer failed')
    renderer = result.value
    renderer.resize(800, 600)
    renderer.setOriginal({ width: 16, height: 8 } as unknown as ImageBitmap)
    renderer.setView(view)
    frames.flush()
  })
  afterEach(() => setLayerCanvasFactory(previous))

  /** A layer that has been drawn into, so it is uploaded from its canvas, not allocated blank. */
  function marked(width = 16, height = 8): Layer {
    const layer = createLayer({ width, height })
    layerContext(layer)
    return layer
  }
  /** Full uploads of a layer's pixels, by their width. */
  const layerUploads = () =>
    fake.calls
      .filter(
        ([n, , , , , , data]) => n === 'texImage2D' && data instanceof Object && 'data' in data,
      )
      .map(([, , , , , , data]) => (data as ImageData).width)
  const subUploads = () => fake.calls.filter(([n]) => n === 'texSubImage2D')
  const blankAllocations = () =>
    fake.calls.filter(([n, , , , , , , , , data]) => n === 'texImage2D' && data === null)

  it('re-uploads the layer from its canvas after a restore', () => {
    renderer.setLayer(marked())
    frames.flush()
    fake.calls.length = 0

    canvas.dispatch('webglcontextlost')
    canvas.dispatch('webglcontextrestored')
    frames.flush()
    expect(layerUploads()).toEqual([16])
    expect(
      fake.calls.filter(([n, unit]) => n === 'activeTexture' && unit === 'TEXTURE1').length,
    ).toBeGreaterThan(0)
  })

  it('a layer set while restoring is uploaded once, on restore, and not before', () => {
    renderer.setLayer(marked())
    frames.flush()
    canvas.dispatch('webglcontextlost')
    fake.calls.length = 0
    renderer.setLayer(marked(12, 6)) // e.g. Apply or a new Draft during the loss
    frames.flush()
    expect(layerUploads()).toEqual([])

    canvas.dispatch('webglcontextrestored')
    frames.flush()
    expect(layerUploads()).toEqual([12])
  })

  it('a dirty rectangle reported during the loss is dropped for one full upload on restore', () => {
    renderer.setLayer(marked())
    frames.flush()
    canvas.dispatch('webglcontextlost')
    fake.calls.length = 0
    renderer.updateLayer({ x: 1, y: 1, width: 4, height: 4 }) // the stale texture handle
    frames.flush()
    canvas.dispatch('webglcontextrestored')
    frames.flush()
    expect(layerUploads()).toEqual([16])
    expect(subUploads()).toEqual([])
  })

  it('a blank layer is allocated zero-filled again on restore', () => {
    renderer.setLayer(createLayer({ width: 16, height: 8 }))
    frames.flush()
    fake.calls.length = 0
    canvas.dispatch('webglcontextlost')
    canvas.dispatch('webglcontextrestored')
    frames.flush()
    expect(layerUploads()).toEqual([])
    expect(blankAllocations()).toHaveLength(1)
  })
})
