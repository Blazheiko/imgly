import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createWork } from '@/core'
import { useEditorStore } from '@/features/editor'
import { useNotices } from '@/shared'
import AdjustAction from './AdjustAction.vue'
import { ACTION_LABEL, ACTION_TOOLTIP, infoNoImage, infoOtherToolOpen } from './messages'

describe('AdjustAction (SCR-01, SCR-02, SCR-03)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    wrapper = mount(AdjustAction, { attachTo: document.body })
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

  const button = () => wrapper.get('button.base-button')
  const texts = () => useNotices().items.map((n) => n.text)
  const pressA = (target: EventTarget = window) => {
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      code: 'KeyA',
      cancelable: true,
      bubbles: true,
    })
    target.dispatchEvent(event)
  }

  it('words its label, tooltip and hints (screens.md §Message catalog)', () => {
    expect(ACTION_LABEL).toBe('Adjust')
    expect(ACTION_TOOLTIP).toBe('Adjust (A)')
    expect(infoNoImage()).toBe('Open an image first to adjust it.')
    expect(infoOtherToolOpen()).toBe('Apply or cancel the open tool first.')
    expect(button().text()).toBe('Adjust')
    expect(button().attributes('title')).toBe('Adjust (A)')
  })

  it('with no image: unavailable but focusable, its hint described, and a notice on use (AC-19)', async () => {
    expect(button().attributes('disabled')).toBeUndefined()
    expect(button().attributes('aria-disabled')).toBe('true')
    const described = button().attributes('aria-describedby')!
    expect(document.getElementById(described)?.textContent).toBe(infoNoImage())

    await button().trigger('click')
    pressA()
    expect(texts()).toEqual([infoNoImage(), infoNoImage()])
    expect(editor.activeTool).toBeNull()
  })

  it('opens the tool by click or A, then shows as pressed (AC-21)', async () => {
    openWork()
    await nextTick()
    expect(button().attributes('aria-disabled')).toBeUndefined()
    expect(button().attributes('aria-pressed')).toBe('false')
    await button().trigger('click')
    expect(editor.activeTool).toBe('adjust')
    expect(button().attributes('aria-pressed')).toBe('true')

    editor.closeTool()
    pressA()
    expect(editor.activeTool).toBe('adjust')
    await button().trigger('click') // already open: nothing more happens
    expect(texts()).toEqual([])
  })

  it('is disabled during an export, and A is refused, not queued (AC-15)', async () => {
    openWork()
    const snapshot = editor.beginExport()!
    await nextTick()
    expect(button().attributes('disabled')).toBeDefined()
    pressA()
    editor.finishExport(snapshot, false)
    await nextTick()
    expect(editor.activeTool).toBeNull()
    expect(texts()).toEqual([])
  })

  it('stays silent while the export panel is open or a field has focus', () => {
    openWork()
    editor.setActivePanel('export')
    pressA()
    expect(editor.activeTool).toBeNull()
    editor.setActivePanel(null)

    const input = document.body.appendChild(document.createElement('input'))
    pressA(input)
    expect(editor.activeTool).toBeNull()
    expect(texts()).toEqual([])
  })

  describe('while Crop and rotate is open (AC-18)', () => {
    beforeEach(async () => {
      openWork()
      editor.openTool('crop-rotate')
      await nextTick()
    })

    it('is unavailable but focusable, with the hint as its description', () => {
      expect(button().attributes('disabled')).toBeUndefined()
      expect(button().attributes('aria-disabled')).toBe('true')
      const described = button().attributes('aria-describedby')!
      expect(document.getElementById(described)?.textContent).toBe(infoOtherToolOpen())
    })

    it('shows the hint on click and on A, never opening, and stays silent in a field', async () => {
      await button().trigger('click')
      pressA()
      pressA(document.body.appendChild(document.createElement('input')))
      expect(texts()).toEqual([infoOtherToolOpen(), infoOtherToolOpen()])
      expect(editor.activeTool).toBe('crop-rotate')
    })
  })
})
