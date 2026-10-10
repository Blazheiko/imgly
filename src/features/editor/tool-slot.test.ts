import { describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import {
  createWork,
  identityGeometry,
  NEUTRAL_ADJUSTMENTS,
  type Geometry,
  type View,
  type Work,
} from '@/core'
import { createToolSlot } from './tool-slot'
import type { EditorPhase, PanelId } from './store'

const bitmap = (width: number, height: number) => ({ width, height }) as unknown as ImageBitmap

function makeWork(width = 400, height = 200): Work<ImageBitmap> {
  return createWork({ width, height, pixels: bitmap(width, height), hasTransparency: false }, 'w1', {
    sourceName: 'photo',
    sourceFormat: 'jpeg',
  })
}

function setup({ withWork = true } = {}) {
  const work = shallowRef<Work<ImageBitmap> | null>(withWork ? makeWork() : null)
  const phase = ref<EditorPhase>('idle')
  const activePanel = ref<PanelId | null>(null)
  const view = ref<View>({ zoom: 2, panX: 10, panY: 20, autoFit: false })
  const fitIfSized = vi.fn()
  const slot = createToolSlot({ work, phase, activePanel, view, fitIfSized })
  return { work, phase, activePanel, view, fitIfSized, slot }
}

describe('tool slot — refusals (AC-16)', () => {
  it('refuses in order: no-work, exporting, tool-open, panel-open, confirming', () => {
    const noWork = setup({ withWork: false })
    noWork.phase.value = 'exporting'
    expect(noWork.slot.openTool('adjust')).toEqual({ ok: false, reason: 'no-work' })

    const { slot, phase, activePanel } = setup()
    phase.value = 'exporting'
    activePanel.value = 'export'
    expect(slot.openTool('adjust')).toEqual({ ok: false, reason: 'exporting' })

    phase.value = 'confirming'
    expect(slot.openTool('adjust')).toEqual({ ok: false, reason: 'panel-open' })
    activePanel.value = null
    expect(slot.openTool('adjust')).toEqual({ ok: false, reason: 'confirming' })
    phase.value = 'idle'
    expect(slot.openTool('adjust')).toEqual({ ok: true })
  })

  it('keeps one tool at a time: a second open is refused and leaves the slot unchanged', () => {
    const { slot, activePanel, phase } = setup()
    expect(slot.openTool('crop-rotate')).toEqual({ ok: true })
    activePanel.value = 'export'
    phase.value = 'confirming'
    expect(slot.openTool('adjust')).toEqual({ ok: false, reason: 'tool-open' })
    expect(slot.activeTool.value).toBe('crop-rotate')
  })

  it('refuses during an export without queueing the request', () => {
    const { slot, phase } = setup()
    phase.value = 'exporting'
    expect(slot.openTool('crop-rotate')).toEqual({ ok: false, reason: 'exporting' })
    phase.value = 'idle'
    expect(slot.activeTool.value).toBeNull()
  })
})

describe('tool slot — per-tool side effects', () => {
  it('crop-rotate previews the Work Geometry whole and fits the View; close re-fits', () => {
    const { slot, work, fitIfSized } = setup()
    slot.openTool('crop-rotate')
    expect(slot.previewGeometry.value).toBe(work.value!.geometry)
    expect(fitIfSized).toHaveBeenCalledTimes(1)
    slot.closeTool()
    expect(slot.activeTool.value).toBeNull()
    expect(slot.previewGeometry.value).toBeNull()
    expect(fitIfSized).toHaveBeenCalledTimes(2)
  })

  it('adjust keeps the View and clears its preview on close', () => {
    const { slot, fitIfSized, view } = setup()
    slot.openTool('adjust')
    slot.setPreviewAdjustments({ ...NEUTRAL_ADJUSTMENTS, brightness: 10 })
    expect(slot.previewAdjustments.value?.brightness).toBe(10)
    slot.closeTool()
    expect(slot.previewAdjustments.value).toBeNull()
    expect(fitIfSized).not.toHaveBeenCalled()
    expect(view.value).toEqual({ zoom: 2, panX: 10, panY: 20, autoFit: false })
  })

  it('setPreviewAdjustments is ignored unless adjust is open', () => {
    const { slot } = setup()
    slot.openTool('crop-rotate')
    slot.setPreviewAdjustments(NEUTRAL_ADJUSTMENTS)
    expect(slot.previewAdjustments.value).toBeNull()
  })

  it('setPreviewGeometry is ignored with no tool open', () => {
    const { slot } = setup()
    const next: Geometry = { ...identityGeometry({ width: 400, height: 200 }), flipH: true }
    slot.setPreviewGeometry(next)
    expect(slot.previewGeometry.value).toBeNull()
  })

  it('a quarter turn in the preview re-fits the View', () => {
    const { slot, fitIfSized } = setup()
    slot.openTool('crop-rotate')
    fitIfSized.mockClear()
    const g = slot.previewGeometry.value!
    slot.setPreviewGeometry({ ...g, rotation: 90 })
    expect(fitIfSized).toHaveBeenCalledTimes(1)
  })

  it('closeTool with no tool open is a no-op', () => {
    const { slot, fitIfSized } = setup()
    slot.closeTool()
    expect(slot.activeTool.value).toBeNull()
    expect(fitIfSized).not.toHaveBeenCalled()
  })

  it('discard empties the slot without touching the View', () => {
    const { slot, fitIfSized } = setup()
    slot.openTool('crop-rotate')
    fitIfSized.mockClear()
    slot.discard()
    expect(slot.activeTool.value).toBeNull()
    expect(slot.previewGeometry.value).toBeNull()
    expect(fitIfSized).not.toHaveBeenCalled()
  })
})
