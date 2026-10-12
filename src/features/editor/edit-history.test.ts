import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { shallowRef, type ShallowRef } from 'vue'
import { createWork, hasUnsavedEdits, type Work } from '@/core'
import {
  createLayer,
  releaseLayer,
  setLayerCanvasFactory,
  type CanvasFactory,
  type Layer,
} from '@/render'
import { createFakeLayerCanvas } from '@/render/testing'
import { bitmapLedger, resetBitmapLedger } from '@/shared'
import { createEditHistory } from './edit-history'

type EditorWork = Work<ImageBitmap, OffscreenCanvas>

const SIZE = { width: 40, height: 30 }
let ids = 0

function opened(): EditorWork {
  const pixels = { ...SIZE, close() {} } as unknown as ImageBitmap
  return createWork({ ...SIZE, pixels, hasTransparency: false }, `w-${++ids}`, {
    sourceName: 'a',
    sourceFormat: 'png',
  })
}

const retained = () => bitmapLedger.layersCreated - bitmapLedger.layersReleased

describe('edit-history composable (undo-redo ADR-0003, ADR-0004)', () => {
  let previous: CanvasFactory
  let work: ShallowRef<EditorWork | null>
  let edits: ReturnType<typeof createEditHistory>

  beforeEach(() => {
    previous = setLayerCanvasFactory(
      (w, h) => createFakeLayerCanvas(w, h) as unknown as OffscreenCanvas,
    )
    resetBitmapLedger()
    work = shallowRef<EditorWork | null>(null)
    edits = createEditHistory({ work })
    const first = opened()
    work.value = first
    edits.clear(first, null)
  })
  afterEach(() => {
    setLayerCanvasFactory(previous)
  })

  /** A counting Apply of `tool` that changes the Adjustments (or the layer for 'draw'). */
  function step(tool: 'adjust' | 'crop-rotate' | 'draw', layer?: Layer | null) {
    const current = work.value!
    const updated =
      tool === 'draw'
        ? { ...current, drawing: layer ?? createLayer(SIZE) }
        : { ...current, adjustments: { ...current.adjustments, contrast: current.revision + 1 } }
    return edits.commit(tool, current, updated)
  }

  const exportNow = () => (work.value = { ...work.value!, cleanRevision: work.value!.revision })
  const rev = () => work.value!.revision
  const unsaved = () => hasUnsavedEdits(work.value!)

  it('starts with one entry, the Work at open, and its revision as the high-water mark', () => {
    expect(edits.history.value!.entries).toHaveLength(1)
    expect(edits.history.value!.cursor).toBe(0)
    step('adjust')
    expect(rev()).toBe(1)
  })

  it('follows the AC-09 sequence through the save point', () => {
    step('crop-rotate') // A
    step('adjust') // B
    expect(rev()).toBe(2)
    exportNow() // clean 2
    step('draw') // C
    expect([rev(), unsaved()]).toEqual([3, true])

    edits.undo()
    expect([rev(), unsaved()]).toEqual([2, false])
    edits.undo()
    expect([rev(), unsaved()]).toEqual([1, true])
    edits.redo()
    expect([rev(), unsaved()]).toEqual([2, false])
  })

  it('reaches the state at open with no Unsaved edits when every Step of a never-exported Work is undone', () => {
    step('adjust')
    step('draw')
    edits.undo()
    edits.undo()
    expect([rev(), unsaved()]).toEqual([0, false])
  })

  it('keeps Unsaved edits when undoing past an Export back to the state at open', () => {
    step('adjust')
    step('adjust')
    exportNow()
    edits.undo()
    edits.undo()
    expect([rev(), unsaved()]).toEqual([0, true])
  })

  it('never issues a revision twice: Export at 1, Undo to 0, a new Step takes 2', () => {
    step('adjust')
    exportNow()
    edits.undo()
    step('crop-rotate')
    expect(rev()).toBe(2)
    expect(unsaved()).toBe(true)
  })

  it('touch takes a fresh revision without a Step, and Undo then Redo return to it', () => {
    step('adjust')
    edits.touch(work.value!)
    expect(rev()).toBe(2)
    expect(edits.history.value!.entries).toHaveLength(2)
    edits.undo()
    expect(rev()).toBe(0)
    edits.redo()
    expect(rev()).toBe(2)
    step('adjust')
    expect(rev()).toBe(3)
  })

  it('records the tool of each Step as its label', () => {
    step('crop-rotate')
    step('draw')
    expect(edits.history.value!.entries.map((e) => e.label)).toEqual([null, 'crop-rotate', 'draw'])
  })

  it('restores the very objects of each state', () => {
    const atOpen = work.value!
    const drawn = step('draw')
    step('adjust')
    edits.undo()
    expect(work.value!.drawing).toBe(drawn.drawing)
    expect(work.value!.adjustments).toBe(drawn.adjustments)
    edits.undo()
    expect(work.value!.geometry).toBe(atOpen.geometry)
    expect(work.value!.adjustments).toBe(atOpen.adjustments)
    expect(work.value!.drawing).toBeNull()
  })

  it('says whether it moved, and does nothing at the ends', () => {
    expect(edits.undo()).toBe(false)
    expect(edits.redo()).toBe(false)
    step('adjust')
    expect(edits.redo()).toBe(false)
    expect(edits.undo()).toBe(true)
    expect(edits.undo()).toBe(false)
    expect(rev()).toBe(0)
  })

  describe('one release path (ADR-0002)', () => {
    it('keeps the layer a new drawing Step replaces, for Undo', () => {
      const first = step('draw').drawing!
      step('draw')
      expect(retained()).toBe(2)
      edits.undo()
      expect(work.value!.drawing).toBe(first)
      expect(first.pixels.width).toBe(SIZE.width)
    })

    it('releases the discarded redoable layers on a new Step: 0 retained besides the kept ones (AC-04)', () => {
      const first = step('draw').drawing!
      const second = step('draw').drawing!
      edits.undo()
      edits.undo()
      step('adjust')
      expect(second.pixels.width).toBe(0)
      expect(first.pixels.width).toBe(0)
      expect(retained()).toBe(0)
    })

    it('does not release a discarded entry’s layer that a kept entry still holds', () => {
      const layer = step('draw').drawing!
      step('adjust') // shares the layer
      edits.undo()
      step('crop-rotate') // discards the Adjust entry, which held the same layer
      expect(layer.pixels.width).toBe(SIZE.width)
      expect(retained()).toBe(1)
    })

    it('releases the oldest layers dropped by the bound (AC-11)', () => {
      // Canvases without pixels: twelve real 4096 × 3072 ones would hold 600 MB in the test.
      setLayerCanvasFactory((w, h) => ({ width: w, height: h, getContext: () => ({}) }) as never)
      const big = { width: 4096, height: 3072 }
      const pixels = { ...big, close() {} } as unknown as ImageBitmap
      const large = createWork<ImageBitmap, OffscreenCanvas>(
        { ...big, pixels, hasTransparency: false },
        'w-big',
        { sourceName: 'big', sourceFormat: 'png' },
      )
      work.value = large
      edits.clear(large, null)
      const layers: Layer[] = []
      for (let i = 0; i < 12; i++) {
        const current = work.value!
        layers.push(
          edits.commit('draw', current, { ...current, drawing: createLayer(big) }).drawing!,
        )
      }
      expect(edits.history.value!.entries.length - 1).toBe(10)
      expect(layers[0]!.pixels.width).toBe(0)
      expect(layers[1]!.pixels.width).toBe(4096)
      expect(retained()).toBe(11)
    })

    it('clear starts an empty history and releases every old layer (AC-10)', () => {
      step('draw')
      step('draw')
      edits.undo()
      const old = work.value!
      const next = opened()
      work.value = next
      edits.clear(next, old)

      expect(edits.history.value!.entries).toHaveLength(1)
      expect(edits.undo()).toBe(false)
      expect(edits.redo()).toBe(false)
      expect(retained()).toBe(0)
    })

    it('clear releases the old Work’s layer even when the history never saw it', () => {
      const stray = { ...work.value!, drawing: createLayer(SIZE) }
      const next = opened()
      work.value = next
      edits.clear(next, stray)
      expect(retained()).toBe(0)
    })

    it('a second release of one layer is a no-op', () => {
      const layer = step('draw').drawing!
      edits.undo()
      step('adjust') // discards and releases the layer
      const old = work.value!
      work.value = opened()
      edits.clear(work.value, { ...old, drawing: layer })
      expect(bitmapLedger.layersReleased).toBe(1)
    })

    it('in DEV, refuses to go on when a kept entry’s layer was released elsewhere', () => {
      const layer = step('draw').drawing!
      step('adjust')
      releaseLayer(layer)
      expect(() => step('adjust')).toThrow(/released layer/)
    })
  })

  it('starts afresh for a Work it has not followed', () => {
    step('adjust')
    const other = opened()
    work.value = other
    step('crop-rotate')
    expect(edits.history.value!.entries).toHaveLength(2)
    expect(edits.history.value!.entries[0]!.state.revision).toBe(0)
    expect(rev()).toBe(1)
  })
})
