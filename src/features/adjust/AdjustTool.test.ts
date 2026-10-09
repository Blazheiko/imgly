import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { createWork, NEUTRAL_ADJUSTMENTS } from '@/core'
import { useEditorStore } from '@/features/editor'
import { Dialog } from '@/shared'
import AdjustAction from './AdjustAction.vue'
import AdjustBeforeLabel from './AdjustBeforeLabel.vue'
import AdjustTool, { TOOL_READY_MARK } from './AdjustTool.vue'
import { BEFORE_LABEL } from './messages'
import { useAdjustStore } from './store'

/**
 * The two halves as the app shell places them, plus the action they return focus to, a stand-in for
 * the top bar's "Open image" and the replace dialog it can raise.
 */
const Shell = defineComponent({
  setup() {
    const editor = useEditorStore()
    return () =>
      h('div', [
        h('button', { 'data-testid': 'open-image' }, 'Open image'),
        h(AdjustAction),
        editor.activeTool === 'adjust' ? h(AdjustBeforeLabel) : null,
        editor.activeTool === 'adjust' ? h(AdjustTool) : null,
        editor.phase === 'confirming'
          ? h(
              Dialog,
              { title: 'Replace the current image?', onCancel: () => editor.cancelReplace() },
              { actions: () => h('button', { 'data-action': 'cancel' }, 'Cancel') },
            )
          : null,
      ])
  },
})

describe('AdjustTool (SCR-03)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>
  let tool: ReturnType<typeof useAdjustStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    const pixels = { width: 400, height: 300, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ width: 400, height: 300, pixels, hasTransparency: false }, 'w', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    tool = useAdjustStore()
    wrapper = mount(Shell, { attachTo: document.body })
    await nextTick()
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  async function openTool() {
    tool.open()
    await nextTick()
    await nextTick()
  }

  const key = (
    type: 'keydown' | 'keyup',
    init: KeyboardEventInit,
    target: EventTarget = window,
  ) => {
    const event = new KeyboardEvent(type, { cancelable: true, bubbles: true, ...init })
    target.dispatchEvent(event)
    return event
  }
  const rangeOf = (name: string) =>
    document.querySelector(`input[type="range"][aria-label="${name}"]`) as HTMLInputElement
  const fieldOf = (name: string) =>
    document
      .querySelector(`[data-testid="adjust-slider-${name}"]`)!
      .querySelector('input[type="text"]') as HTMLInputElement
  const label = () => document.querySelector('[data-testid="adjust-before"]')

  it('is a labelled panel with the controls, and marks tool-ready once per open', async () => {
    const mark = vi.spyOn(performance, 'mark')
    await openTool()
    const panel = document.querySelector('[data-testid="adjust-tool"]')!
    expect(panel.getAttribute('aria-label')).toBe('Adjust')
    expect(panel.querySelector('[data-testid="adjust-controls"]')).not.toBeNull()
    expect(mark.mock.calls.filter(([name]) => name === TOOL_READY_MARK)).toHaveLength(1)
    expect(TOOL_READY_MARK).toBe('imgly:adjust-tool-ready')
  })

  it('moves focus to the brightness slider on open, and back to "Adjust" after close', async () => {
    await openTool()
    expect(document.activeElement).toBe(rangeOf('Brightness'))
    tool.cancel()
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(document.querySelector('[data-testid="adjust-action"]'))
  })

  it('applies on Enter from a slider, and Enter in a field commits only the value (AC-05, AC-21)', async () => {
    await openTool()
    const field = fieldOf('contrast')
    field.value = '25'
    field.dispatchEvent(new Event('input'))
    key('keydown', { key: 'Enter' }, field)
    await nextTick()
    expect(editor.activeTool).toBe('adjust')
    expect(tool.draft!.contrast).toBe(25)

    key('keydown', { key: 'Enter' }, rangeOf('Contrast'))
    expect(editor.activeTool).toBeNull()
    expect(editor.work!.adjustments.contrast).toBe(25)
  })

  it('cancels on Escape from a field, discarding the text being typed (AC-09)', async () => {
    await openTool()
    const field = fieldOf('tint')
    field.value = '40'
    field.dispatchEvent(new Event('input'))
    key('keydown', { key: 'Escape' }, field)
    expect(editor.activeTool).toBeNull()
    expect(editor.work!.adjustments).toEqual(NEUTRAL_ADJUSTMENTS)
  })

  it('presses only the button Enter lands on', async () => {
    await openTool()
    tool.setValue('sepia', 30)
    const reset = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Reset',
    )!
    key('keydown', { key: 'Enter' }, reset)
    expect(editor.activeTool).toBe('adjust')
  })

  describe('a declined replace (SCR-06 declined, AC-17)', () => {
    async function decline() {
      editor.phase = 'confirming'
      await nextTick()
      editor.phase = 'idle'
      await nextTick()
      await nextTick()
    }

    it('returns focus into the tool when the dialog was opened from "Open image"', async () => {
      await openTool()
      ;(document.querySelector('[data-testid="open-image"]') as HTMLElement).focus()
      await decline()
      expect(document.activeElement).toBe(rangeOf('Brightness'))
      expect(editor.activeTool).toBe('adjust')
    })

    it('keeps focus where it was in the tool when the dialog was raised by a drop', async () => {
      await openTool()
      fieldOf('saturation').focus()
      await decline()
      expect(document.activeElement).toBe(fieldOf('saturation'))
    })

    it('keeps the tool open with its Draft when Escape declines it in the dialog', async () => {
      await openTool()
      tool.setValue('contrast', 30)
      editor.phase = 'confirming'
      await nextTick()
      await nextTick()
      const cancel = document.querySelector('[data-action="cancel"]') as HTMLElement
      cancel.focus()
      key('keydown', { key: 'Escape' }, cancel)
      await nextTick()
      expect(editor.phase).toBe('idle')
      expect(editor.activeTool).toBe('adjust')
      expect(tool.draft!.contrast).toBe(30)
    })
  })

  it('leaves Enter and Escape to the replace dialog', async () => {
    await openTool()
    editor.phase = 'confirming'
    key('keydown', { key: 'Escape' })
    key('keydown', { key: 'Enter' }, rangeOf('Tint'))
    expect(editor.activeTool).toBe('adjust')
  })

  describe('Compare and the Before label (AC-08)', () => {
    it('shows "Before" only while Compare is held, announced politely', async () => {
      await openTool()
      expect(label()).toBeNull()
      tool.startCompare()
      await nextTick()
      expect(label()!.textContent!.trim()).toBe(BEFORE_LABEL)
      expect(label()!.closest('[aria-live]')!.getAttribute('aria-live')).toBe('polite')
      tool.endCompare()
      await nextTick()
      expect(label()).toBeNull()
    })

    it('holds Compare with the \\ key outside a text field', async () => {
      await openTool()
      key('keydown', { key: '\\', code: 'Backslash' })
      expect(tool.comparing).toBe(true)
      key('keyup', { key: '\\', code: 'Backslash' })
      expect(tool.comparing).toBe(false)

      key('keydown', { key: '\\', code: 'Backslash' }, fieldOf('tint'))
      expect(tool.comparing).toBe(false)
    })

    it('ends Compare when the window loses focus', async () => {
      await openTool()
      tool.startCompare()
      window.dispatchEvent(new Event('blur'))
      expect(tool.comparing).toBe(false)
    })

    it('stops listening once the tool closes', async () => {
      const added = vi.spyOn(window, 'addEventListener')
      const removed = vi.spyOn(window, 'removeEventListener')
      await openTool()
      const listeners = added.mock.calls.map(([type, handler]) => [type, handler])
      expect(listeners.map(([type]) => type)).toEqual(
        expect.arrayContaining(['keydown', 'keyup', 'blur']),
      )
      tool.cancel()
      await nextTick()
      const gone = removed.mock.calls.map(([type, handler]) => [type, handler])
      for (const listener of listeners) expect(gone).toContainEqual(listener)
    })
  })

  it('keeps the View and the Draft on zoom keys and pan (AC-20)', async () => {
    await openTool()
    const draft = tool.draft
    editor.zoomAt(2, { x: 10, y: 10 })
    editor.panBy(5, 5)
    expect(tool.draft).toBe(draft)
    expect(editor.hasUnsavedEdits).toBe(false)
  })
})
