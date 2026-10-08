import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { appError, createWork, err, NEUTRAL_ADJUSTMENTS, ok, type Adjustments } from '@/core'
import { useEditorStore } from '@/features/editor'
import { useAdjustStore } from './store'

let ids = 0

function openWork(editor: ReturnType<typeof useEditorStore>, adjustments?: Partial<Adjustments>) {
  const size = { width: 400, height: 300 }
  const pixels = { ...size, close() {} } as unknown as ImageBitmap
  const work = createWork({ ...size, pixels, hasTransparency: false }, `w-${++ids}`, {
    sourceName: 'a',
    sourceFormat: 'png',
  })
  editor.work = { ...work, adjustments: { ...NEUTRAL_ADJUSTMENTS, ...adjustments } }
}

const decoded = () =>
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
  })

describe('adjust store (sad.md §4, §5)', () => {
  let editor: ReturnType<typeof useEditorStore>
  let tool: ReturnType<typeof useAdjustStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    tool = useAdjustStore()
  })

  describe('open', () => {
    it('returns the editor’s refusal and keeps no Draft', () => {
      expect(tool.open()).toEqual({ ok: false, reason: 'no-work' })
      expect(tool.draft).toBeNull()
      openWork(editor)
      editor.openTool('crop-rotate')
      expect(tool.open()).toEqual({ ok: false, reason: 'tool-open' })
      expect(tool.draft).toBeNull()
      editor.closeTool()
      const snapshot = editor.beginExport()!
      expect(tool.open()).toEqual({ ok: false, reason: 'exporting' })
      editor.finishExport(snapshot, false)
      expect(tool.draft).toBeNull()
    })

    it('copies the Work’s applied values as the Draft and the values at open (AC-10)', () => {
      openWork(editor, { contrast: 30, sepia: 40 })
      expect(tool.open()).toEqual({ ok: true })
      expect(editor.activeTool).toBe('adjust')
      expect(tool.draft).toEqual({ ...NEUTRAL_ADJUSTMENTS, contrast: 30, sepia: 40 })
      expect(tool.atOpen).toEqual(tool.draft)
      expect(editor.previewAdjustments).toEqual(tool.draft)
    })
  })

  describe('changing the Draft', () => {
    beforeEach(() => {
      openWork(editor, { contrast: 30 })
      tool.open()
    })

    it('sends every change to the Preview and never to the Work', () => {
      tool.setValue('brightness', 45)
      expect(tool.draft!.brightness).toBe(45)
      expect(editor.previewAdjustments).toEqual({
        ...NEUTRAL_ADJUSTMENTS,
        contrast: 30,
        brightness: 45,
      })
      expect(editor.work!.adjustments.brightness).toBe(0)
      expect(editor.hasUnsavedEdits).toBe(false)
    })

    it('commits a typed value through the AC-05 rule, only when the field is committed', () => {
      tool.setPending('grayscale', '60%')
      expect(tool.draft!.grayscale).toBe(0)
      tool.commitField('grayscale')
      expect(tool.draft!.grayscale).toBe(60)
      expect(tool.pending.grayscale).toBeUndefined()

      tool.setPending('contrast', '2.5')
      tool.commitField('contrast')
      expect(tool.draft!.contrast).toBe(3)
      tool.setPending('contrast', '150')
      tool.commitField('contrast')
      expect(tool.draft!.contrast).toBe(100)
      tool.setPending('contrast', 'abc')
      tool.commitField('contrast')
      expect(tool.draft!.contrast).toBe(100)
      expect(editor.previewAdjustments!.contrast).toBe(100)
    })

    it('does nothing when a field with no typed text is committed', () => {
      tool.commitField('tint')
      expect(tool.draft).toEqual({ ...NEUTRAL_ADJUSTMENTS, contrast: 30 })
    })

    it('typing 0 or resetting one slider sets only that one to neutral (AC-10)', () => {
      tool.setValue('saturation', 50)
      tool.setPending('contrast', '0')
      tool.commitField('contrast')
      expect(tool.draft).toEqual({ ...NEUTRAL_ADJUSTMENTS, saturation: 50 })
      tool.resetOne('saturation')
      expect(tool.draft).toEqual(NEUTRAL_ADJUSTMENTS)
    })

    it('Reset sets all seven to neutral on the Draft only (AC-10)', () => {
      tool.setValue('tint', -20)
      tool.reset()
      expect(tool.draft).toEqual(NEUTRAL_ADJUSTMENTS)
      expect(editor.previewAdjustments).toEqual(NEUTRAL_ADJUSTMENTS)
      expect(editor.work!.adjustments.contrast).toBe(30)
    })
  })

  describe('apply and cancel (AC-09, AC-11)', () => {
    it('Apply stores the Draft, raises the revision and closes the tool', () => {
      openWork(editor)
      tool.open()
      tool.setValue('sepia', 70)
      tool.apply()
      expect(editor.work!.adjustments.sepia).toBe(70)
      expect(editor.work!.revision).toBe(1)
      expect(editor.activeTool).toBeNull()
      expect(tool.draft).toBeNull()
      expect(editor.previewAdjustments).toBeNull()
    })

    it('Apply after changing a value and changing it back leaves the revision alone', () => {
      openWork(editor, { brightness: 10 })
      tool.open()
      tool.setValue('brightness', 80)
      tool.setPending('brightness', '10')
      tool.commitField('brightness')
      tool.apply()
      expect(editor.work!.revision).toBe(0)
      expect(editor.hasUnsavedEdits).toBe(false)
    })

    it('Apply commits a value still being typed first', () => {
      openWork(editor)
      tool.open()
      tool.setPending('tint', '12')
      tool.apply()
      expect(editor.work!.adjustments.tint).toBe(12)
    })

    it('Reset then Apply on an adjusted Work makes it neutral, as an edit', () => {
      openWork(editor, { grayscale: 100 })
      tool.open()
      tool.reset()
      tool.apply()
      expect(editor.work!.adjustments).toEqual(NEUTRAL_ADJUSTMENTS)
      expect(editor.work!.revision).toBe(1)
    })

    it('Cancel closes the tool and leaves the Work, typed text included, as it was', () => {
      openWork(editor, { contrast: 30 })
      tool.open()
      tool.setValue('contrast', -60)
      tool.reset()
      tool.setPending('tint', '50')
      tool.cancel()
      expect(editor.activeTool).toBeNull()
      expect(editor.work!.adjustments).toEqual({ ...NEUTRAL_ADJUSTMENTS, contrast: 30 })
      expect(editor.work!.revision).toBe(0)
      expect(tool.draft).toBeNull()
      expect(tool.pending).toEqual({})
    })

    it('opens again with the applied values', () => {
      openWork(editor)
      tool.open()
      tool.setValue('saturation', 25)
      tool.apply()
      tool.open()
      expect(tool.draft).toEqual({ ...NEUTRAL_ADJUSTMENTS, saturation: 25 })
    })
  })

  describe('replacing the Work while open (AC-17)', () => {
    it('drops the Draft when the new image replaces the Work, and reopens neutral', async () => {
      editor.setDecoder(async () => decoded())
      openWork(editor, { contrast: 30 })
      tool.open()
      tool.setValue('tint', 40)
      tool.setPending('sepia', '9')
      await editor.openImage(new Blob())
      expect(editor.activeTool).toBeNull()
      expect(tool.draft).toBeNull()
      expect(tool.pending).toEqual({})
      tool.open()
      expect(tool.draft).toEqual(NEUTRAL_ADJUSTMENTS)
    })

    it('keeps the Draft when the read fails or the replace is declined', async () => {
      openWork(editor)
      editor.applyEdit()
      tool.open()
      tool.setValue('tint', 40)
      editor.setDecoder(async () => err(appError('DECODE_FAILED')))
      await editor.openImage(new Blob())
      editor.setDecoder(async () => decoded())
      expect((await editor.openImage(new Blob())).kind).toBe('confirming')
      editor.cancelReplace()
      expect(editor.activeTool).toBe('adjust')
      expect(tool.draft!.tint).toBe(40)
      expect(editor.previewAdjustments!.tint).toBe(40)
    })
  })
})
