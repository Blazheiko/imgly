import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  ADJUSTMENT_RANGES,
  appError,
  autoAdjust,
  createWork,
  err,
  NEUTRAL_ADJUSTMENTS,
  ok,
  toUniforms,
  workSize,
  type Adjustments,
  type ImageSample,
} from '@/core'
import { useEditorStore } from '@/features/editor'
import { createFakeRenderer } from '@/features/editor/testing'
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

    it('commits a field’s text through the AC-05 rule and answers the value the Draft holds', () => {
      expect(tool.commitText('grayscale', '60%')).toBe(60)
      expect(tool.draft!.grayscale).toBe(60)
      expect(tool.commitText('contrast', '2.5')).toBe(3)
      expect(tool.commitText('contrast', '150')).toBe(100)
      expect(tool.commitText('contrast', 'abc')).toBe(100)
      expect(tool.draft!.contrast).toBe(100)
      expect(editor.previewAdjustments!.contrast).toBe(100)
    })

    it('answers neutral and changes nothing with the tool closed', () => {
      tool.cancel()
      expect(tool.commitText('tint', '40')).toBe(0)
      expect(tool.draft).toBeNull()
    })

    it('typing 0 or resetting one slider sets only that one to neutral (AC-10)', () => {
      tool.setValue('saturation', 50)
      tool.commitText('contrast', '0')
      expect(tool.draft).toEqual({ ...NEUTRAL_ADJUSTMENTS, saturation: 50 })
      // A slider's double-click reset sends its neutral value (SliderField `neutral`).
      tool.setValue('saturation', ADJUSTMENT_RANGES.saturation.neutral)
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
      tool.commitText('brightness', '10')
      tool.apply()
      expect(editor.work!.revision).toBe(0)
      expect(editor.hasUnsavedEdits).toBe(false)
    })

    it('Reset then Apply on an adjusted Work makes it neutral, as an edit', () => {
      openWork(editor, { grayscale: 100 })
      tool.open()
      tool.reset()
      tool.apply()
      expect(editor.work!.adjustments).toEqual(NEUTRAL_ADJUSTMENTS)
      expect(editor.work!.revision).toBe(1)
    })

    it('Cancel closes the tool and leaves the Work as it was', () => {
      openWork(editor, { contrast: 30 })
      tool.open()
      tool.setValue('contrast', -60)
      tool.reset()
      tool.commitText('tint', '50')
      tool.cancel()
      expect(editor.activeTool).toBeNull()
      expect(editor.work!.adjustments).toEqual({ ...NEUTRAL_ADJUSTMENTS, contrast: 30 })
      expect(editor.work!.revision).toBe(0)
      expect(tool.draft).toBeNull()
    })

    it('Apply keeps the Work’s size and Geometry (AC-06)', () => {
      openWork(editor)
      const geometry = {
        ...editor.work!.geometry,
        rotation: 90 as const,
        crop: { x: 10, y: 20, width: 200, height: 150 },
      }
      editor.applyGeometry(geometry)
      const size = workSize(editor.work!)
      tool.open()
      tool.setValue('sepia', 80)
      tool.setValue('brightness', -40)
      tool.apply()
      expect(editor.work!.adjustments).toMatchObject({ sepia: 80, brightness: -40 })
      expect(editor.work!.geometry).toEqual(geometry)
      expect(workSize(editor.work!)).toEqual(size)
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

  describe('the same values by any path (AC-07)', () => {
    it('gives equal Drafts and equal Preview uniforms in any order, or after a drag out and back', () => {
      openWork(editor)
      const paths = [
        () => {
          tool.setValue('contrast', 40)
          tool.setValue('brightness', -20)
        },
        () => {
          tool.setValue('brightness', -20)
          tool.setValue('contrast', 40)
        },
        () => {
          tool.setValue('brightness', -20)
          for (let v = 0; v <= 100; v += 7) tool.setValue('contrast', v)
          tool.setValue('contrast', 100)
          for (let v = 100; v >= 40; v -= 3) tool.setValue('contrast', v)
        },
      ]
      const results = paths.map((path) => {
        tool.open()
        path()
        const result = { draft: tool.draft, uniforms: toUniforms(editor.previewAdjustments!) }
        tool.cancel()
        return result
      })
      expect(results[0]!.draft).toEqual({ ...NEUTRAL_ADJUSTMENTS, contrast: 40, brightness: -20 })
      expect(results[1]).toEqual(results[0])
      expect(results[2]).toEqual(results[0])
    })
  })

  describe('replacing the Work while open (AC-17)', () => {
    it('drops the Draft when the new image replaces the Work, and reopens neutral', async () => {
      editor.setDecoder(async () => decoded())
      openWork(editor, { contrast: 30 })
      tool.open()
      tool.setValue('tint', 40)
      tool.commitText('sepia', '9')
      await editor.openImage(new Blob())
      expect(editor.activeTool).toBeNull()
      expect(tool.draft).toBeNull()
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

  describe('Compare (AC-08)', () => {
    beforeEach(() => {
      openWork(editor, { contrast: 30 })
      tool.open()
      tool.setValue('sepia', 50)
    })

    const draftNow = () => ({ ...NEUTRAL_ADJUSTMENTS, contrast: 30, sepia: 50 })

    it('previews neutral values while held, and the Draft again on release', () => {
      tool.startCompare()
      expect(tool.comparing).toBe(true)
      expect(editor.previewAdjustments).toEqual(NEUTRAL_ADJUSTMENTS)
      expect(tool.draft).toEqual(draftNow())
      tool.endCompare()
      expect(tool.comparing).toBe(false)
      expect(editor.previewAdjustments).toEqual(draftNow())
    })

    it('never changes the Work, the Draft or the Unsaved edits', () => {
      tool.startCompare()
      tool.endCompare()
      expect(editor.work!.adjustments).toEqual({ ...NEUTRAL_ADJUSTMENTS, contrast: 30 })
      expect(editor.work!.revision).toBe(0)
      expect(tool.draft).toEqual(draftNow())
    })

    it('keeps showing Before for Draft changes while held, and shows them on release', () => {
      tool.startCompare()
      tool.setValue('brightness', 20)
      tool.commitText('tint', '7')
      tool.setValue('contrast', ADJUSTMENT_RANGES.contrast.neutral)
      expect(editor.previewAdjustments).toEqual(NEUTRAL_ADJUSTMENTS)
      tool.reset()
      tool.setValue('grayscale', 10)
      expect(editor.previewAdjustments).toEqual(NEUTRAL_ADJUSTMENTS)
      tool.endCompare()
      expect(editor.previewAdjustments).toEqual({ ...NEUTRAL_ADJUSTMENTS, grayscale: 10 })
    })

    it('ends when the tool closes, by Apply or by Cancel', () => {
      tool.startCompare()
      tool.cancel()
      expect(tool.comparing).toBe(false)
      expect(editor.previewAdjustments).toBeNull()

      tool.open()
      tool.setValue('tint', 5)
      tool.startCompare()
      tool.apply()
      expect(tool.comparing).toBe(false)
      expect(editor.work!.adjustments.tint).toBe(5)
    })

    it('does nothing with the tool closed', () => {
      tool.cancel()
      tool.startCompare()
      expect(tool.comparing).toBe(false)
      expect(editor.previewAdjustments).toBeNull()
    })
  })

  describe('Auto (AC-12, AC-13)', () => {
    let fake: ReturnType<typeof createFakeRenderer>

    /** A dark grey ramp with a blue cast: Auto has something to correct. */
    function castSample(): ImageSample {
      const data = new Uint8Array(256 * 4)
      for (let i = 0; i < 256; i++) {
        const v = Math.round((i * 90) / 255)
        data.set([Math.round(v * 0.8), v, v, 255], i * 4)
      }
      return { width: 256, height: 1, data }
    }

    function oneColour(): ImageSample {
      return { width: 2, height: 1, data: new Uint8Array([10, 20, 30, 255, 10, 20, 30, 255]) }
    }

    beforeEach(() => {
      fake = createFakeRenderer()
      editor.setRendererFactory(fake.factory)
      editor.createRenderer({} as HTMLCanvasElement)
      openWork(editor, { saturation: -40, sepia: 30, contrast: 90 })
      tool.open()
    })

    it('replaces only brightness, contrast, temperature and tint with the measured values', () => {
      fake.renderer.sampleCrop.mockReturnValue(ok(castSample()))
      const measured = autoAdjust(castSample())
      if (measured.kind !== 'values') throw new Error('expected values')

      tool.auto()
      expect(tool.draft).toEqual({
        ...NEUTRAL_ADJUSTMENTS,
        ...measured.values,
        saturation: -40,
        sepia: 30,
      })
      expect(editor.previewAdjustments).toEqual(tool.draft)
      expect(editor.work!.revision).toBe(0)
    })

    it('gives the same values when chosen again (replace, not add)', () => {
      fake.renderer.sampleCrop.mockReturnValue(ok(castSample()))
      tool.auto()
      const first = tool.draft
      tool.auto()
      expect(tool.draft).toEqual(first)
    })

    it('samples the Work’s Geometry, not the Draft', () => {
      fake.renderer.sampleCrop.mockReturnValue(ok(castSample()))
      tool.auto()
      expect(fake.renderer.sampleCrop).toHaveBeenCalledWith(editor.work!.geometry, 512)
    })

    it('leaves the Draft as it was and says there is nothing to correct for one colour', () => {
      fake.renderer.sampleCrop.mockReturnValue(ok(oneColour()))
      const before = tool.draft
      tool.auto()
      expect(tool.draft).toEqual(before)
      expect(tool.nothingToCorrect).toBe(true)
    })

    it('clears the nothing hint on the next change to the Draft, and on close', () => {
      fake.renderer.sampleCrop.mockReturnValue(ok(oneColour()))
      tool.auto()
      tool.setValue('tint', 3)
      expect(tool.nothingToCorrect).toBe(false)
      tool.auto()
      tool.reset()
      expect(tool.nothingToCorrect).toBe(false)
      tool.auto()
      tool.cancel()
      expect(tool.nothingToCorrect).toBe(false)
    })

    it('changes nothing and shows no hint when the display is lost', () => {
      fake.renderer.sampleCrop.mockReturnValue(err(appError('DISPLAY_LOST')))
      const before = tool.draft
      tool.auto()
      expect(tool.draft).toEqual(before)
      expect(tool.nothingToCorrect).toBe(false)
    })

    it('keeps showing Before when chosen while Compare is held', () => {
      fake.renderer.sampleCrop.mockReturnValue(ok(castSample()))
      tool.startCompare()
      tool.auto()
      expect(editor.previewAdjustments).toEqual(NEUTRAL_ADJUSTMENTS)
      tool.endCompare()
      expect(editor.previewAdjustments).toEqual(tool.draft)
    })
  })
})
