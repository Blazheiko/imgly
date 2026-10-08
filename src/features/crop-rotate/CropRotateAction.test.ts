import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createWork } from '@/core'
import { useEditorStore } from '@/features/editor'
import { useNotices } from '@/shared'
import CropRotateAction from './CropRotateAction.vue'
import { infoNoImage, infoOtherToolOpen } from './messages'

describe('CropRotateAction (SCR-01, SCR-02)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    wrapper = mount(CropRotateAction, { attachTo: document.body })
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
  const pressC = (target: EventTarget = window) => {
    const event = new KeyboardEvent('keydown', { key: 'c', cancelable: true, bubbles: true })
    target.dispatchEvent(event)
  }

  it('words its hint and tooltip', () => {
    expect(infoNoImage()).toBe('Open an image first to crop or rotate it.')
    expect(button().attributes('title')).toBe('Crop and rotate (C)')
    expect(button().text()).toBe('Crop and rotate')
  })

  it('with no image: unavailable but focusable, its hint described, and a notice on use (AC-18)', async () => {
    expect(button().attributes('disabled')).toBeUndefined()
    expect(button().attributes('aria-disabled')).toBe('true')
    const described = button().attributes('aria-describedby')!
    expect(document.getElementById(described)?.textContent).toBe(infoNoImage())

    await button().trigger('click')
    pressC()
    expect(texts()).toEqual([infoNoImage(), infoNoImage()])
    expect(editor.activeTool).toBeNull()
  })

  it('opens the tool by click or C, then shows as pressed (AC-20)', async () => {
    openWork()
    await nextTick()
    expect(button().attributes('aria-disabled')).toBeUndefined()
    expect(button().attributes('aria-pressed')).toBe('false')
    await button().trigger('click')
    expect(editor.activeTool).toBe('crop-rotate')
    expect(button().attributes('aria-pressed')).toBe('true')

    editor.closeTool()
    pressC()
    expect(editor.activeTool).toBe('crop-rotate')
  })

  it('is disabled during an export, and C is refused, not queued (AC-15)', async () => {
    openWork()
    const snapshot = editor.beginExport()!
    await nextTick()
    expect(button().attributes('disabled')).toBeDefined()
    pressC()
    editor.finishExport(snapshot, false)
    await nextTick()
    expect(editor.activeTool).toBeNull()
    expect(texts()).toEqual([])
  })

  it('stays silent while the export panel is open or a field has focus (AC-20)', async () => {
    openWork()
    editor.setActivePanel('export')
    pressC()
    expect(editor.activeTool).toBeNull()
    editor.setActivePanel(null)

    const input = document.body.appendChild(document.createElement('input'))
    pressC(input)
    expect(editor.activeTool).toBeNull()
  })

  describe('while the adjust tool is open (adjust AC-18)', () => {
    beforeEach(async () => {
      openWork()
      expect(editor.openTool('adjust')).toEqual({ ok: true })
      await nextTick()
    })

    it('words the hint', () => {
      expect(infoOtherToolOpen()).toBe('Apply or cancel the open tool first.')
    })

    it('is unavailable but focusable, with the hint as its description', () => {
      expect(button().attributes('disabled')).toBeUndefined()
      expect(button().attributes('aria-disabled')).toBe('true')
      const described = button().attributes('aria-describedby')!
      expect(document.getElementById(described)?.textContent).toBe(infoOtherToolOpen())
    })

    it('shows the hint on click and on C, and never opens', async () => {
      await button().trigger('click')
      pressC()
      expect(texts()).toEqual([infoOtherToolOpen(), infoOtherToolOpen()])
      expect(editor.activeTool).toBe('adjust')
    })

    it('stays silent on C in a text field', () => {
      const input = document.body.appendChild(document.createElement('input'))
      pressC(input)
      expect(texts()).toEqual([])
    })

    it('stays silent with its own tool open', async () => {
      editor.closeTool()
      editor.openTool('crop-rotate')
      await nextTick()
      pressC()
      await button().trigger('click')
      expect(texts()).toEqual([])
    })
  })
})
