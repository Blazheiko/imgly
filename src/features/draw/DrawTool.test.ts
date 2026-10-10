import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { createWork } from '@/core'
import { useEditorStore } from '@/features/editor'
import { setLayerCanvasFactory, type CanvasFactory } from '@/render'
import { createFakeLayerCanvas } from '@/render/testing'
import DrawAction from './DrawAction.vue'
import DrawOverlay from './DrawOverlay.vue'
import DrawTool, { TOOL_READY_MARK } from './DrawTool.vue'
import { useDrawStore } from './store'

/** The two halves as the app shell places them, plus the action focus returns to. */
const Shell = defineComponent({
  setup() {
    const editor = useEditorStore()
    return () =>
      h('div', [
        h(DrawAction),
        editor.activeTool === 'draw' ? h(DrawOverlay) : null,
        editor.activeTool === 'draw' ? h(DrawTool) : null,
      ])
  },
})

describe('DrawTool (SCR-03)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>
  let draw: ReturnType<typeof useDrawStore>
  let previous: CanvasFactory

  beforeEach(async () => {
    setActivePinia(createPinia())
    previous = setLayerCanvasFactory(
      (w, h) => createFakeLayerCanvas(w, h) as unknown as OffscreenCanvas,
    )
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    const pixels = { width: 400, height: 300, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ width: 400, height: 300, pixels, hasTransparency: false }, 'w', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    draw = useDrawStore()
    wrapper = mount(Shell, { attachTo: document.body })
    await nextTick()
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
    setLayerCanvasFactory(previous)
    vi.restoreAllMocks()
  })

  async function openTool() {
    draw.open()
    await nextTick()
    await nextTick()
  }

  const key = (init: KeyboardEventInit, target: EventTarget = document.activeElement ?? window) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))

  it('focuses the mode group on "Brush" when it opens and marks tool-ready', async () => {
    const mark = vi.spyOn(performance, 'mark')
    await openTool()
    expect(
      document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent,
    ).toBe('Brush')
    expect(mark).toHaveBeenCalledWith(TOOL_READY_MARK)
    expect(TOOL_READY_MARK).toBe('imgly:draw-tool-ready')
  })

  it('B, E, [ and ] change the settings; Shift+[ steps 10', async () => {
    await openTool()
    key({ key: 'e', code: 'KeyE' }, document.body)
    expect(draw.mode).toBe('eraser')
    key({ key: 'b', code: 'KeyB' }, document.body)
    expect(draw.mode).toBe('brush')
    key({ key: ']', code: 'BracketRight' }, document.body)
    expect(draw.width).toBe(13)
    key({ key: '{', code: 'BracketLeft', shiftKey: true }, document.body)
    expect(draw.width).toBe(3)
  })

  it('Enter on focused Clear presses Clear and does not apply', async () => {
    await openTool()
    const clear = wrapper.get('[data-testid="draw-clear"]').element as HTMLButtonElement
    clear.focus()
    key({ key: 'Enter' }, clear)
    expect(draw.isOpen).toBe(true)
  })

  it('Enter elsewhere applies and focus returns to "Draw"', async () => {
    await openTool()
    key({ key: 'Enter' }, document.body)
    await nextTick()
    await nextTick()
    expect(draw.isOpen).toBe(false)
    expect(document.activeElement?.getAttribute('data-testid')).toBe('draw-action')
  })

  it('Escape in the width field with pending text cancels the tool', async () => {
    await openTool()
    const field = wrapper.get<HTMLInputElement>('[data-testid="draw-width"] input[type="text"]')
    await field.setValue('77')
    key({ key: 'Escape' }, field.element)
    await nextTick()
    expect(draw.isOpen).toBe(false)
    expect(draw.width).toBe(12)
  })

  it('B in the width field types b', async () => {
    await openTool()
    draw.setMode('eraser')
    const field = wrapper.get('[data-testid="draw-width"] input[type="text"]').element
    key({ key: 'b', code: 'KeyB' }, field)
    expect(draw.mode).toBe('eraser')
  })
})
