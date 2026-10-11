import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createWork } from '@/core'
import { useEditorStore } from '@/features/editor'
import { useNotices } from '@/shared'
import DrawAction from './DrawAction.vue'
import { ACTION_LABEL, ACTION_TOOLTIP, infoNoImage, infoOtherToolOpen } from './messages'

describe('DrawAction (SCR-01, SCR-02, SCR-03)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    wrapper = mount(DrawAction, { attachTo: document.body })
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
  const pressD = (target: EventTarget = window) => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', cancelable: true, bubbles: true }),
    )
  }

  it('words its label, tooltip and hints (screens.md §Message catalog)', () => {
    expect(ACTION_LABEL).toBe('Draw')
    expect(ACTION_TOOLTIP).toBe('Draw (D)')
    expect(infoNoImage()).toBe('Open an image first to draw on it.')
    expect(infoOtherToolOpen()).toBe('Apply or cancel the open tool first.')
    expect(button().text()).toBe('Draw')
    expect(button().attributes('title')).toBe('Draw (D)')
    expect(button().find('svg').exists()).toBe(true)
  })

  it('with no image: unavailable but focusable, its hint described, and a notice on use (AC-17)', async () => {
    expect(button().attributes('disabled')).toBeUndefined()
    expect(button().attributes('aria-disabled')).toBe('true')
    const described = button().attributes('aria-describedby')!
    expect(document.getElementById(described)?.textContent).toBe(infoNoImage())

    await button().trigger('click')
    pressD()
    expect(texts()).toEqual([infoNoImage(), infoNoImage()])
    expect(editor.activeTool).toBeNull()
  })

  it('opens the tool by click or D, then shows as pressed (AC-19)', async () => {
    openWork()
    await nextTick()
    expect(button().attributes('aria-disabled')).toBeUndefined()
    expect(button().attributes('aria-pressed')).toBe('false')
    await button().trigger('click')
    expect(editor.activeTool).toBe('draw')
    expect(button().attributes('aria-pressed')).toBe('true')

    editor.closeTool()
    pressD()
    expect(editor.activeTool).toBe('draw')
    await button().trigger('click') // already open: nothing more happens
    expect(texts()).toEqual([])
  })

  it('is disabled during an export, and D is refused, not queued (AC-14)', async () => {
    openWork()
    const snapshot = editor.beginExport()!
    await nextTick()
    expect(button().attributes('disabled')).toBeDefined()
    pressD()
    editor.finishExport(snapshot, false)
    await nextTick()
    expect(editor.activeTool).toBeNull()
    expect(texts()).toEqual([])
  })

  it('stays silent while the export panel is open or a field has focus', () => {
    openWork()
    editor.setActivePanel('export')
    pressD()
    expect(editor.activeTool).toBeNull()
    editor.setActivePanel(null)

    pressD(document.body.appendChild(document.createElement('input')))
    expect(editor.activeTool).toBeNull()
    expect(texts()).toEqual([])
  })

  describe.each(['adjust', 'crop-rotate'] as const)('while %s is open (AC-16)', (tool) => {
    beforeEach(async () => {
      openWork()
      editor.openTool(tool)
      await nextTick()
    })

    it('is unavailable but focusable, with the hint as its description', () => {
      expect(button().attributes('disabled')).toBeUndefined()
      expect(button().attributes('aria-disabled')).toBe('true')
      const described = button().attributes('aria-describedby')!
      expect(document.getElementById(described)?.textContent).toBe(infoOtherToolOpen())
    })

    it('shows the hint on click and on D, never opening, and stays silent in a field', async () => {
      await button().trigger('click')
      pressD()
      pressD(document.body.appendChild(document.createElement('input')))
      expect(texts()).toEqual([infoOtherToolOpen(), infoOtherToolOpen()])
      expect(editor.activeTool).toBe(tool)
    })
  })
})
