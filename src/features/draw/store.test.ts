import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createWork, ok } from '@/core'
import type { DecodeOutcome } from '@/infra/image-decode'
import { useEditorStore } from '@/features/editor'
import { createLayer, setLayerCanvasFactory, type CanvasFactory, type Layer } from '@/render'
import { createFakeLayerCanvas, getPixel, setPixel, type FakeLayerCanvas } from '@/render/testing'
import { bitmapLedger, resetBitmapLedger } from '@/shared'
import { useDrawStore } from './store'

let ids = 0
const SIZE = { width: 40, height: 30 }
const canvasOf = (layer: Layer) => layer.pixels as unknown as FakeLayerCanvas

function openWork(editor: ReturnType<typeof useEditorStore>) {
  const pixels = { ...SIZE, close() {} } as unknown as ImageBitmap
  editor.work = createWork({ ...SIZE, pixels, hasTransparency: false }, `w-${++ids}`, {
    sourceName: 'a',
    sourceFormat: 'png',
  })
}

/** A layer with one red mark at (2, 3). */
function marked(): Layer {
  const layer = createLayer(SIZE)
  setPixel(canvasOf(layer), 2, 3, [255, 0, 0, 255])
  return layer
}

const retained = () => bitmapLedger.layersCreated - bitmapLedger.layersReleased

describe('draw store (draw ADR-0004, sad.md §4)', () => {
  let editor: ReturnType<typeof useEditorStore>
  let draw: ReturnType<typeof useDrawStore>
  let previous: CanvasFactory

  beforeEach(() => {
    setActivePinia(createPinia())
    previous = setLayerCanvasFactory(
      (w, h) => createFakeLayerCanvas(w, h) as unknown as OffscreenCanvas,
    )
    resetBitmapLedger()
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    draw = useDrawStore()
  })
  afterEach(() => {
    setLayerCanvasFactory(previous)
  })

  describe('open (AC-01)', () => {
    it('returns the editor’s refusal and keeps no Draft', () => {
      expect(draw.open()).toEqual({ ok: false, reason: 'no-work' })
      expect(draw.isOpen).toBe(false)
      expect(draw.draft).toBeNull()
    })

    it('first open in the session: Brush, #E53935, 12 px, an empty Draft for a new Work', () => {
      openWork(editor)
      expect(draw.open()).toEqual({ ok: true })
      expect(draw.isOpen).toBe(true)
      expect(draw.mode).toBe('brush')
      expect(draw.colour).toBe('#E53935')
      expect(draw.width).toBe(12)
      expect(draw.draft).toBeNull()
      expect(editor.previewLayer).toBeNull()
    })

    it('copies the Work’s applied layer into the Draft and shows it', () => {
      openWork(editor)
      const applied = marked()
      editor.applyDrawing(applied, true)
      draw.open()
      const draft = draw.draft!
      expect(draft.pixels).not.toBe(applied.pixels)
      expect(getPixel(canvasOf(draft), 2, 3)).toEqual([255, 0, 0, 255])
      expect(editor.previewLayer).toBe(draft)
    })

    it('opens on the Brush again, keeping colour and width chosen before a Cancel (AC-02)', () => {
      openWork(editor)
      draw.open()
      draw.setMode('eraser')
      draw.setColour('#1e88e5')
      draw.setWidth(40)
      draw.cancel()
      draw.open()
      expect(draw.mode).toBe('brush')
      expect(draw.colour).toBe('#1E88E5')
      expect(draw.width).toBe(40)
    })

    it('keeps colour and width after an Apply and on a new image, and never counts them as edits', () => {
      openWork(editor)
      draw.open()
      draw.setColour('#43A047')
      draw.setWidth(7)
      draw.apply()
      expect(editor.hasUnsavedEdits).toBe(false)
      openWork(editor)
      draw.open()
      expect(draw.colour).toBe('#43A047')
      expect(draw.width).toBe(7)
    })
  })

  describe('width (AC-02, AC-03, AC-19)', () => {
    beforeEach(() => {
      openWork(editor)
      draw.open()
    })

    it('rounds and clamps a slider value', () => {
      draw.setWidth(0)
      expect(draw.width).toBe(1)
      draw.setWidth(250)
      expect(draw.width).toBe(200)
      draw.setWidth(2.5)
      expect(draw.width).toBe(3)
    })

    it('commits a field’s text by the AC-03 rule and answers the width', () => {
      expect(draw.commitWidthText('20 px')).toBe(20)
      expect(draw.commitWidthText('abc')).toBe(20)
      expect(draw.commitWidthText('1e2')).toBe(20)
      expect(draw.commitWidthText('999')).toBe(200)
      expect(draw.width).toBe(200)
    })

    it('steps by [ and ], clamped', () => {
      draw.setWidth(195)
      draw.stepWidth(10)
      expect(draw.width).toBe(200)
      draw.setWidth(3)
      draw.stepWidth(-10)
      expect(draw.width).toBe(1)
    })

    it('accepts only a full #RRGGBB colour, stored upper case', () => {
      draw.setColour('#abcdef')
      expect(draw.colour).toBe('#ABCDEF')
      draw.setColour('red')
      draw.setColour('#12345680')
      expect(draw.colour).toBe('#ABCDEF')
    })
  })

  describe('Clear (AC-05, AC-12)', () => {
    it('empties the Draft and the Preview at once, and counts as a change when it had a mark', () => {
      openWork(editor)
      editor.applyDrawing(marked(), false)
      draw.open()
      draw.clear()
      expect(draw.draft).toBeNull()
      expect(editor.previewLayer).toBeNull()
      draw.apply()
      expect(editor.work!.drawing).toBeNull()
      expect(editor.hasUnsavedEdits).toBe(true)
    })

    it('on a null Draft changes nothing: Apply leaves Unsaved edits as they were', () => {
      openWork(editor)
      draw.open()
      draw.clear()
      draw.apply()
      expect(editor.hasUnsavedEdits).toBe(false)
    })

    it('of a Draft with no mark is no change', () => {
      openWork(editor)
      editor.applyDrawing(createLayer(SIZE), false)
      draw.open()
      draw.clear()
      draw.apply()
      expect(editor.hasUnsavedEdits).toBe(false)
    })

    it('then a new mark keeps only the new mark; the applied marks are gone', () => {
      openWork(editor)
      editor.applyDrawing(marked(), false)
      draw.open()
      draw.clear()
      const fresh = draw.ensureDraft()
      setPixel(canvasOf(fresh), 9, 9, [0, 0, 255, 255])
      draw.markChanged()
      expect(editor.previewLayer).toBe(fresh)
      draw.apply()
      const applied = canvasOf(editor.work!.drawing as Layer)
      expect(getPixel(applied, 9, 9)).toEqual([0, 0, 255, 255])
      expect(getPixel(applied, 2, 3)).toEqual([0, 0, 0, 0])
    })

    it('Cancel after Clear brings back the applied marks and balances the ledger', () => {
      openWork(editor)
      const applied = marked()
      editor.applyDrawing(applied, true)
      const before = editor.work!.revision
      draw.open()
      draw.clear()
      draw.cancel()
      expect(editor.work!.drawing!.pixels).toBe(applied.pixels)
      expect(editor.work!.revision).toBe(before)
      expect(retained()).toBe(1)
    })
  })

  describe('Apply and Cancel (AC-01, AC-06, AC-12)', () => {
    it('Apply with no change hands over the Draft without raising the revision', () => {
      openWork(editor)
      editor.applyDrawing(marked(), false)
      draw.open()
      const draft = draw.draft!
      draw.apply()
      expect(draw.isOpen).toBe(false)
      expect(editor.work!.drawing!.pixels).toBe(draft.pixels)
      expect(editor.hasUnsavedEdits).toBe(false)
      expect(retained()).toBe(1)
    })

    it('Apply after a change raises the revision and keeps exactly one layer', () => {
      openWork(editor)
      draw.open()
      draw.ensureDraft()
      draw.markChanged()
      draw.apply()
      expect(editor.work!.drawing).not.toBeNull()
      expect(editor.hasUnsavedEdits).toBe(true)
      expect(retained()).toBe(1)
    })

    it('a refused Apply leaves the Draft with the open tool, so nothing leaks', () => {
      openWork(editor)
      draw.open()
      const draft = draw.ensureDraft()
      draw.markChanged()
      vi.spyOn(editor, 'applyDrawing').mockReturnValue(false)
      draw.apply()
      expect(draw.isOpen).toBe(true)
      expect(draw.draft).toBe(draft)
      draw.cancel()
      expect(retained()).toBe(0) // released with the tool, not lost
    })

    it('Cancel keeps the Work’s layer and Unsaved edits, releasing the Draft', () => {
      openWork(editor)
      draw.open()
      draw.ensureDraft()
      draw.markChanged()
      draw.cancel()
      expect(draw.isOpen).toBe(false)
      expect(editor.work!.drawing).toBeNull()
      expect(editor.hasUnsavedEdits).toBe(false)
      expect(retained()).toBe(0)
    })

    it('the change flag starts false on every open', () => {
      openWork(editor)
      draw.open()
      draw.ensureDraft()
      draw.markChanged()
      draw.cancel()
      draw.open()
      draw.apply()
      expect(editor.hasUnsavedEdits).toBe(false)
    })
  })

  describe('replacing the Work while open (AC-13)', () => {
    function decoder() {
      const answers: ((o: DecodeOutcome) => void)[] = []
      editor.setDecoder(() => new Promise<DecodeOutcome>((resolve) => answers.push(resolve)))
      return () =>
        answers.at(-1)!(
          ok({
            bitmap: { width: 10, height: 10, close() {} } as unknown as ImageBitmap,
            sourceWidth: 10,
            sourceHeight: 10,
            width: 10,
            height: 10,
            format: 'png' as const,
            animated: false,
            downscaled: false,
            hasTransparency: false,
          }),
        )
    }

    it('a confirmed replace releases the Draft and closes the tool', async () => {
      const answer = decoder()
      openWork(editor)
      editor.applyEdit()
      draw.open()
      draw.ensureDraft()
      const opening = editor.openImage(new Blob())
      answer()
      await opening
      expect(draw.isOpen).toBe(true)
      editor.confirmReplace()
      expect(draw.isOpen).toBe(false)
      expect(draw.draft).toBeNull()
      expect(retained()).toBe(0)
    })

    it('a declined replace keeps the Draft', async () => {
      const answer = decoder()
      openWork(editor)
      editor.applyEdit()
      draw.open()
      const draft = draw.ensureDraft()
      const opening = editor.openImage(new Blob())
      answer()
      await opening
      editor.cancelReplace()
      expect(draw.isOpen).toBe(true)
      expect(draw.draft).toBe(draft)
      expect(retained()).toBe(1)
    })
  })

  describe('Strokes (AC-01, AC-04, AC-12, AC-18)', () => {
    const view = { zoom: 1, panX: 0, panY: 0, autoFit: false }

    beforeEach(() => {
      openWork(editor)
      draw.open()
    })

    it('a Brush Stroke creates the Draft, shows it, sets the change flag and holds input', () => {
      draw.beginStroke({ x: 5, y: 5 }, view)
      expect(draw.strokeActive).toBe(true)
      draw.moveStroke([{ x: 15, y: 10 }], view)
      draw.endStroke()
      expect(draw.strokeActive).toBe(false)
      expect(draw.draft).not.toBeNull()
      expect(editor.previewLayer).toBe(draw.draft)
      draw.apply()
      expect(editor.hasUnsavedEdits).toBe(true)
    })

    it('paints with the style at the Stroke’s start; a change mid-Stroke applies from the next', () => {
      draw.beginStroke({ x: 5, y: 5 }, view)
      draw.setColour('#1E88E5')
      draw.setWidth(30)
      draw.endStroke()
      const calls = (draw.draft!.pixels as unknown as FakeLayerCanvas).calls
      expect(calls).toContainEqual(['set fillStyle', '#E53935'])
      expect(calls).toContainEqual(['arc', 5, 5, 6, 0, Math.PI * 2])
      draw.beginStroke({ x: 20, y: 20 }, view)
      draw.endStroke()
      expect(calls).toContainEqual(['set fillStyle', '#1E88E5'])
      expect(calls).toContainEqual(['arc', 20, 20, 15, 0, Math.PI * 2])
    })

    it('Enter mid-Stroke applies right after the release', () => {
      draw.beginStroke({ x: 5, y: 5 }, view)
      draw.apply()
      expect(draw.isOpen).toBe(true)
      draw.endStroke()
      expect(draw.isOpen).toBe(false)
      expect(editor.work!.drawing).not.toBeNull()
      expect(editor.hasUnsavedEdits).toBe(true)
    })

    it('Escape mid-Stroke cancels at once, the partial Stroke included', () => {
      draw.beginStroke({ x: 5, y: 5 }, view)
      draw.moveStroke(
        [
          { x: 15, y: 10 },
          { x: 25, y: 12 },
        ],
        view,
      )
      draw.cancel()
      expect(draw.isOpen).toBe(false)
      expect(draw.strokeActive).toBe(false)
      expect(editor.work!.drawing).toBeNull()
      expect(retained()).toBe(0)
      draw.moveStroke([{ x: 35, y: 15 }], view)
      draw.endStroke()
      expect(retained()).toBe(0)
    })

    it('an end (pointer cancel, blur, second touch) keeps what was drawn so far', () => {
      draw.beginStroke({ x: 5, y: 5 }, view)
      draw.moveStroke(
        [
          { x: 15, y: 10 },
          { x: 25, y: 12 },
        ],
        view,
      )
      draw.endStroke()
      expect(draw.draft).not.toBeNull()
      expect(draw.isOpen).toBe(true)
    })

    it('an Eraser Stroke on an empty Draft changes nothing', () => {
      draw.setMode('eraser')
      draw.beginStroke({ x: 5, y: 5 }, view)
      draw.moveStroke([{ x: 15, y: 10 }], view)
      draw.endStroke()
      expect(draw.draft).toBeNull()
      draw.apply()
      expect(editor.hasUnsavedEdits).toBe(false)
    })

    it('hands each pointer event’s dirty rectangle to the editor, which forwards it', () => {
      const layerChanged = vi.spyOn(editor, 'layerChanged')
      draw.beginStroke({ x: 5, y: 5 }, view)
      draw.moveStroke(
        [
          { x: 15, y: 10 },
          { x: 25, y: 12 },
          { x: 35, y: 14 },
        ],
        view,
      )
      expect(layerChanged).toHaveBeenCalledTimes(1)
    })
  })
})
