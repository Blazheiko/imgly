import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { createWork, NEUTRAL_ADJUSTMENTS } from '@/core'
import { useEditorStore } from '@/features/editor'
import AdjustAction from './AdjustAction.vue'
import AdjustBeforeLabel from './AdjustBeforeLabel.vue'
import AdjustTool, { TOOL_READY_MARK } from './AdjustTool.vue'
import { BEFORE_LABEL } from './messages'
import { useAdjustStore } from './store'

/** The two halves as the app shell places them, plus the action they return focus to. */
const Shell = defineComponent({
  setup() {
    const editor = useEditorStore()
    return () =>
      h('div', [
        h(AdjustAction),
        editor.activeTool === 'adjust' ? h(AdjustBeforeLabel) : null,
        editor.activeTool === 'adjust' ? h(AdjustTool) : null,
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
      await openTool()
      tool.cancel()
      await nextTick()
      tool.open()
      tool.cancel()
      key('keydown', { key: '\\', code: 'Backslash' })
      expect(tool.comparing).toBe(false)
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
