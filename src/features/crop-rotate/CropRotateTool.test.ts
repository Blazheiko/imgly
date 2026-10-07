import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { createWork } from '@/core'
import { useEditorStore } from '@/features/editor'
import CropRotateAction from './CropRotateAction.vue'
import CropOverlay from './CropOverlay.vue'
import CropRotateTool, { TOOL_READY_MARK } from './CropRotateTool.vue'
import { useCropRotateStore } from './store'

const original = { width: 4000, height: 3000 }

/** The two halves as the app shell places them, plus the action they return focus to. */
const Shell = defineComponent({
  setup() {
    const editor = useEditorStore()
    return () =>
      h('div', [
        h(CropRotateAction),
        editor.activeTool ? h(CropOverlay) : null,
        editor.activeTool ? h(CropRotateTool) : null,
      ])
  },
})

describe('CropRotateTool (SCR-03)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>
  let tool: ReturnType<typeof useCropRotateStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    const pixels = { ...original, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ ...original, pixels, hasTransparency: false }, 'w', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    tool = useCropRotateStore()
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

  const press = (key: string, target: Element | Window = document.activeElement ?? window) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    target.dispatchEvent(event)
    return event
  }

  it('moves focus to the frame on open and back to the action on close (AC-20)', async () => {
    await openTool()
    expect(document.activeElement?.getAttribute('data-testid')).toBe('crop-frame')
    tool.cancel()
    await nextTick()
    await nextTick()
    expect(document.activeElement?.getAttribute('data-testid')).toBe('crop-rotate-action')
  })

  it('marks the tool ready for the @perf suite', async () => {
    const mark = vi.spyOn(performance, 'mark')
    await openTool()
    expect(mark).toHaveBeenCalledWith(TOOL_READY_MARK)
  })

  it('Enter on the frame applies the tool (AC-01, AC-20)', async () => {
    await openTool()
    tool.rotate('cw')
    press('Enter')
    expect(editor.activeTool).toBeNull()
    expect(editor.work!.geometry.rotation).toBe(90)
    expect(editor.hasUnsavedEdits).toBe(true)
  })

  it('Enter on a focused button presses only that button', async () => {
    await openTool()
    tool.rotate('cw')
    const reset = wrapper.findAll('button').find((b) => b.text() === 'Reset')!
    ;(reset.element as HTMLButtonElement).focus()
    press('Enter')
    expect(editor.activeTool).toBe('crop-rotate')
  })

  it('Enter in a field applies only the value (AC-07, AC-10)', async () => {
    await openTool()
    const width = wrapper.findAll('input').find((i) => i.attributes('inputmode') === 'numeric')!
    await width.setValue('1000')
    ;(width.element as HTMLInputElement).focus()
    press('Enter')
    expect(editor.activeTool).toBe('crop-rotate')
    expect(tool.draft!.crop.width).toBe(1000)
  })

  it('Escape cancels from anywhere, a field included, discarding typed text (AC-11, AC-20)', async () => {
    await openTool()
    tool.flip('vertical')
    const width = wrapper.findAll('input').find((i) => i.attributes('inputmode') === 'numeric')!
    await width.setValue('12')
    ;(width.element as HTMLInputElement).focus()
    press('Escape')
    expect(editor.activeTool).toBeNull()
    expect(editor.work!.geometry.flipV).toBe(false)
    expect(editor.work!.revision).toBe(0)
  })

  it('leaves Escape to the replace dialog while it is open', async () => {
    await openTool()
    editor.phase = 'confirming'
    press('Escape', window)
    expect(editor.activeTool).toBe('crop-rotate')
  })

  it('fits the View to the Work after Apply (AC-19)', async () => {
    await openTool()
    tool.resizeBy('se', -3000, -2200) // 1000×800 at 100% fits the 1000×800 canvas exactly
    press('Enter')
    expect(editor.view).toMatchObject({ zoom: 1, panX: 0, panY: 0 })
  })
})
