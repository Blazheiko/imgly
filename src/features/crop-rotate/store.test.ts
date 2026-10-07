import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createWork, geometryEquals, identityGeometry, ok, type Geometry } from '@/core'
import { useEditorStore } from '@/features/editor'
import { useCropRotateStore } from './store'

const original = { width: 4000, height: 3000 }
let ids = 0

function openWork(editor: ReturnType<typeof useEditorStore>, size = original) {
  const pixels = { ...size, close() {} } as unknown as ImageBitmap
  editor.work = createWork({ ...size, pixels, hasTransparency: false }, `w-${++ids}`, {
    sourceName: 'a',
    sourceFormat: 'png',
  })
}

describe('crop-rotate store (ADR-0003)', () => {
  let editor: ReturnType<typeof useEditorStore>
  let tool: ReturnType<typeof useCropRotateStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    tool = useCropRotateStore()
  })

  describe('open', () => {
    it('returns the editor’s refusal and keeps no Draft (AC-15, AC-18)', () => {
      expect(tool.open()).toEqual({ ok: false, reason: 'no-work' })
      expect(tool.draft).toBeNull()
      openWork(editor)
      editor.beginExport()
      expect(tool.open()).toEqual({ ok: false, reason: 'exporting' })
      expect(tool.draft).toBeNull()
    })

    it('copies the Work’s Geometry as the Draft, with the frame where the Crop is (AC-12)', () => {
      openWork(editor)
      const applied: Geometry = {
        ...identityGeometry(original),
        rotation: 90,
        crop: { x: 10, y: 20, width: 300, height: 400 },
      }
      editor.applyGeometry(applied)
      expect(tool.open()).toEqual({ ok: true })
      expect(tool.draft).toEqual(applied)
      expect(editor.previewGeometry).toEqual(applied)
      expect(tool.proportion).toEqual({ kind: 'free', orientation: 'landscape' })
    })
  })

  describe('editing the Draft', () => {
    beforeEach(() => {
      openWork(editor)
      tool.open()
    })

    it('every action changes the Draft and the preview, never the Work', () => {
      const work = editor.work!
      tool.rotate('cw')
      tool.flip('horizontal')
      tool.setAngle(50)
      tool.moveBy(-5, 3)
      tool.resizeBy('se', -100, -100)
      expect(tool.draft!.rotation).toBe(90)
      expect(tool.draft!.straighten).toBe(50)
      expect(editor.previewGeometry).toEqual(tool.draft)
      expect(editor.work).toBe(work)
      expect(editor.hasUnsavedEdits).toBe(false)
    })

    it('a drag counts from where it started, so a pointer that goes back gives the start back', () => {
      const start = tool.draft!
      tool.resizeBy('nw', 200, 200) // shrink first, so the drag has room
      const shrunk = tool.draft!
      tool.beginDrag()
      tool.dragResize('se', 50, 50)
      tool.dragResize('se', 0, 0)
      expect(tool.draft).toEqual(shrunk)
      tool.dragMove(-30, 0)
      tool.endDrag()
      expect(tool.draft!.crop.x).toBe(shrunk.crop.x - 30)
      expect(start).not.toEqual(shrunk)
    })

    it('a locked proportion turns with a quarter turn (AC-03)', () => {
      tool.chooseProportion({ kind: '4:3', orientation: 'landscape' })
      tool.rotate('ccw')
      expect(tool.proportion).toEqual({ kind: '4:3', orientation: 'portrait' })
    })

    it('keeps a locked proportion while resizing (AC-08)', () => {
      tool.chooseProportion({ kind: '1:1', orientation: 'landscape' })
      expect(tool.draft!.crop).toMatchObject({ width: 3000, height: 3000 })
      tool.resizeBy('e', -1000, 0)
      expect(tool.draft!.crop.width).toBe(tool.draft!.crop.height)
    })
  })

  describe('fields (AC-07, AC-09, AC-10)', () => {
    beforeEach(() => {
      openWork(editor)
      tool.open()
    })

    it('keeps typed text pending until committed, then applies the core rules', () => {
      tool.setPending('angle', '-3,46')
      expect(tool.pending.angle).toBe('-3,46')
      expect(tool.draft!.straighten).toBe(0)
      tool.commitField('angle')
      expect(tool.draft!.straighten).toBe(-35)
      expect(tool.pending.angle).toBeNull()

      const widthBefore = tool.draft!.crop.width
      tool.setPending('width', '1e2')
      tool.commitField('width')
      expect(tool.draft!.crop.width).toBe(widthBefore) // not a number: reverted

      tool.setPending('width', '1000.4')
      tool.commitField('width')
      expect(tool.draft!.crop.width).toBe(1000)
    })

    it('reverts a non-number to the previous value', () => {
      const before = tool.draft!
      tool.setPending('height', 'abc')
      tool.commitField('height')
      expect(tool.draft).toEqual(before)
    })
  })

  describe('apply, cancel and reset', () => {
    beforeEach(() => openWork(editor))

    it('Apply stores the Draft as an edit and closes the tool (AC-01, AC-13)', () => {
      tool.open()
      tool.rotate('cw')
      tool.apply()
      expect(editor.activeTool).toBeNull()
      expect(editor.work!.geometry.rotation).toBe(90)
      expect(editor.hasUnsavedEdits).toBe(true)
      expect(tool.draft).toBeNull()
    })

    it('Apply with no change leaves the Unsaved edits as they were (AC-13)', () => {
      tool.open()
      tool.rotate('cw')
      tool.rotate('ccw')
      tool.apply()
      expect(editor.hasUnsavedEdits).toBe(false)
    })

    it('Cancel keeps the Work’s Geometry and revision and drops pending text (AC-11)', () => {
      tool.open()
      tool.flip('vertical')
      tool.setPending('width', '12')
      tool.cancel()
      expect(editor.activeTool).toBeNull()
      expect(geometryEquals(editor.work!.geometry, identityGeometry(original))).toBe(true)
      expect(editor.work!.revision).toBe(0)
      expect(tool.pending.width).toBeNull()
    })

    it('Reset changes only the Draft, to no Geometry and Free; Apply makes it count (AC-12)', () => {
      editor.applyGeometry({
        ...identityGeometry(original),
        flipH: true,
        crop: { x: 100, y: 100, width: 500, height: 500 },
      })
      tool.open()
      tool.chooseProportion({ kind: '16:9', orientation: 'landscape' })
      tool.reset()
      expect(tool.draft).toEqual(identityGeometry(original))
      expect(tool.proportion.kind).toBe('free')
      expect(editor.work!.geometry.flipH).toBe(true)

      tool.cancel()
      expect(editor.work!.geometry.flipH).toBe(true)

      tool.open()
      tool.reset()
      tool.apply()
      expect(editor.work!.geometry).toEqual(identityGeometry(original))
    })
  })

  describe('the remembered proportion (AC-08)', () => {
    beforeEach(() => openWork(editor))

    it('is remembered as soon as it is chosen, even after Cancel', () => {
      tool.open()
      tool.chooseProportion({ kind: '4:3', orientation: 'portrait' })
      tool.cancel()
      tool.open()
      expect(tool.proportion).toEqual({ kind: '4:3', orientation: 'portrait' })
    })

    it('starts at Free for a new Work', async () => {
      tool.open()
      tool.chooseProportion({ kind: '1:1', orientation: 'landscape' })
      tool.cancel()
      openWork(editor, { width: 300, height: 200 })
      await nextTick()
      tool.open()
      expect(tool.proportion.kind).toBe('free')
      expect(tool.draft).toEqual(identityGeometry({ width: 300, height: 200 }))
    })
  })

  describe('a replace while the tool is open (AC-17)', () => {
    it('drops the Draft only when the editor closes the slot', async () => {
      let answer!: (v: unknown) => void
      editor.setDecoder(() => new Promise((resolve) => (answer = resolve as (v: unknown) => void)))
      openWork(editor)
      tool.open()
      tool.flip('horizontal')
      const pending = editor.openImage(new Blob())
      await nextTick()
      expect(tool.draft!.flipH).toBe(true) // still reading: the Draft stays

      answer(
        ok({
          bitmap: { width: 20, height: 10, close() {} },
          sourceWidth: 20,
          sourceHeight: 10,
          width: 20,
          height: 10,
          format: 'png',
          animated: false,
          downscaled: false,
          hasTransparency: false,
        }),
      )
      await pending
      await nextTick()
      expect(editor.activeTool).toBeNull()
      expect(tool.draft).toBeNull()
    })
  })
})
