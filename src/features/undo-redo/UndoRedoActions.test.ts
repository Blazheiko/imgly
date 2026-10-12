import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createWork, NEUTRAL_ADJUSTMENTS } from '@/core'
import { useEditorStore } from '@/features/editor'
import { useNotices } from '@/shared'
import UndoRedoActions from './UndoRedoActions.vue'
import { INFO_EXPORTING, INFO_TOOL_OPEN } from './messages'

describe('UndoRedoActions (SCR-01 to SCR-04)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    wrapper = mount(UndoRedoActions, { attachTo: document.body })
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  function openWork() {
    const pixels = { width: 800, height: 600, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ width: 800, height: 600, pixels, hasTransparency: false }, 'w-1', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
  }

  const contrast = (value: number) => ({ ...NEUTRAL_ADJUSTMENTS, contrast: value })
  const undoButton = () => wrapper.get('button[aria-label="Undo"]')
  const redoButton = () => wrapper.get('button[aria-label="Redo"]')
  const hintOf = (button: ReturnType<typeof undoButton>) =>
    document.getElementById(button.attributes('aria-describedby')!)?.textContent
  const texts = () => useNotices().items.map((n) => n.text)
  const state = (button: ReturnType<typeof undoButton>) => ({
    ariaDisabled: button.attributes('aria-disabled') ?? null,
    disabled: button.attributes('disabled') !== undefined,
    title: button.attributes('title'),
    hint: hintOf(button),
  })
  const press = (init: KeyboardEventInit) =>
    window.dispatchEvent(new KeyboardEvent('keydown', { cancelable: true, bubbles: true, ...init }))

  it('renders two ghost icon buttons named Undo and Redo', () => {
    for (const button of [undoButton(), redoButton()]) {
      expect(button.classes()).toContain('base-button--ghost')
      expect(button.find('svg').exists()).toBe(true)
    }
    expect(wrapper.findAll('button').map((b) => b.attributes('aria-label'))).toEqual([
      'Undo',
      'Redo',
    ])
  })

  it('SCR-02: with no image both are unavailable and do nothing', async () => {
    expect(state(undoButton())).toEqual({
      ariaDisabled: 'true',
      disabled: false,
      title: 'Nothing to undo',
      hint: 'Nothing to undo',
    })
    expect(state(redoButton())).toMatchObject({ ariaDisabled: 'true', title: 'Nothing to redo' })
    await undoButton().trigger('click')
    press({ key: 'z', ctrlKey: true })
    expect(texts()).toEqual([])
  })

  it('SCR-01 default: just opened, nothing to undo or redo (AC-05)', async () => {
    openWork()
    await nextTick()
    expect(state(undoButton())).toMatchObject({ ariaDisabled: 'true', hint: 'Nothing to undo' })
    expect(state(redoButton())).toMatchObject({ ariaDisabled: 'true', hint: 'Nothing to redo' })
    await undoButton().trigger('click')
    expect(texts()).toEqual([])
    expect(editor.work!.revision).toBe(0)
  })

  it('SCR-01 can undo, can undo and redo, oldest reached (AC-01)', async () => {
    openWork()
    editor.applyGeometry({ ...editor.work!.geometry, flipH: true })
    editor.applyAdjustments(contrast(20))
    await nextTick()
    expect(state(undoButton())).toEqual({
      ariaDisabled: null,
      disabled: false,
      title: 'Undo Adjust (Ctrl/Cmd+Z)',
      hint: 'Undo Adjust (Ctrl/Cmd+Z)',
    })
    expect(state(redoButton())).toMatchObject({ ariaDisabled: 'true', title: 'Nothing to redo' })

    await undoButton().trigger('click')
    expect(editor.work!.adjustments.contrast).toBe(0)
    expect(state(undoButton())).toMatchObject({
      ariaDisabled: null,
      title: 'Undo Crop and rotate (Ctrl/Cmd+Z)',
    })
    expect(state(redoButton())).toMatchObject({
      ariaDisabled: null,
      title: 'Redo Adjust (Shift+Ctrl/Cmd+Z)',
    })

    await undoButton().trigger('click')
    expect(state(undoButton())).toMatchObject({ ariaDisabled: 'true', hint: 'Nothing to undo' })
    expect(state(redoButton())).toMatchObject({ title: 'Redo Crop and rotate (Shift+Ctrl/Cmd+Z)' })

    await redoButton().trigger('click')
    expect(editor.work!.geometry.flipH).toBe(true)
    expect(texts()).toEqual([]) // the Preview is the outcome: no notice
  })

  it('undoes and redoes by the shortcuts', async () => {
    openWork()
    editor.applyAdjustments(contrast(20))
    press({ key: 'z', metaKey: true })
    expect(editor.work!.adjustments.contrast).toBe(0)
    press({ key: 'y', ctrlKey: true })
    expect(editor.work!.adjustments.contrast).toBe(20)
  })

  it('keeps focus on a button that becomes unavailable, with its new hint', async () => {
    openWork()
    editor.applyAdjustments(contrast(20))
    editor.undo()
    await nextTick()
    const redo = redoButton().element as HTMLButtonElement
    redo.focus()
    await redoButton().trigger('click')
    expect(document.activeElement).toBe(redo)
    expect(state(redoButton())).toMatchObject({ ariaDisabled: 'true', hint: 'Nothing to redo' })
  })

  it('SCR-03: a tool open makes both unavailable, and activating shows the hint (AC-08)', async () => {
    openWork()
    editor.applyAdjustments(contrast(20))
    editor.undo()
    editor.openTool('adjust')
    await nextTick()
    for (const button of [undoButton(), redoButton()]) {
      expect(state(button)).toEqual({
        ariaDisabled: 'true',
        disabled: false,
        title: INFO_TOOL_OPEN,
        hint: INFO_TOOL_OPEN,
      })
    }
    await undoButton().trigger('click')
    await redoButton().trigger('click')
    press({ key: 'z', ctrlKey: true })
    expect(texts()).toEqual([INFO_TOOL_OPEN, INFO_TOOL_OPEN, INFO_TOOL_OPEN])
    expect(editor.work!.adjustments.contrast).toBe(0)
    expect(editor.activeTool).toBe('adjust')
  })

  it('SCR-04: during an export both are truly disabled, and the shortcut shows the notice (AC-07)', async () => {
    openWork()
    editor.applyAdjustments(contrast(20))
    const snapshot = editor.beginExport()!
    await nextTick()
    for (const button of [undoButton(), redoButton()]) {
      expect(state(button)).toMatchObject({ disabled: true, title: INFO_EXPORTING })
    }
    press({ key: 'z', ctrlKey: true })
    expect(texts()).toEqual([INFO_EXPORTING])
    expect(editor.work!.adjustments.contrast).toBe(20)

    editor.finishExport(snapshot, true)
    await nextTick()
    expect(state(undoButton())).toMatchObject({
      disabled: false,
      title: 'Undo Adjust (Ctrl/Cmd+Z)',
    })
  })

  it('removes its shortcut on unmount', () => {
    openWork()
    editor.applyAdjustments(contrast(20))
    wrapper.unmount()
    press({ key: 'z', ctrlKey: true })
    expect(editor.work!.adjustments.contrast).toBe(20)
    wrapper = mount(UndoRedoActions, { attachTo: document.body })
  })
})
