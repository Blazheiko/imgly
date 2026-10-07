import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ok } from '@/core'
import { useEditorStore } from '@/features/editor'
import { createFakeRenderer } from '@/features/editor/testing'
import { useExportStore } from '@/features/export'
import App from './App.vue'

// The shell is where EditorView's Space-to-pan meets the export controls in its top bar.
describe('App — Space on the export controls (export AC-17)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    editor = useEditorStore()
    editor.setRendererFactory(createFakeRenderer().factory)
    editor.setDecoder(async () =>
      ok({
        bitmap: { width: 4000, height: 3000, close() {} } as unknown as ImageBitmap,
        sourceWidth: 4000,
        sourceHeight: 3000,
        width: 4000,
        height: 3000,
        format: 'png',
        animated: false,
        downscaled: false,
        hasTransparency: false,
      }),
    )
    editor.setCanvasSize(1000, 1000)
    const exporter = useExportStore()
    exporter.setFormatChecker(async () => ({ png: true, jpeg: true, webp: true }))
    exporter.setSaveDialogProbe(() => false)
    await editor.openImage(new Blob())
    wrapper = mount(App, { attachTo: document.body, global: { plugins: [pinia] } })
    await editor.runCapabilityGate(async () => ok(undefined))
    await flushPromises()
  })
  afterEach(() => wrapper.unmount())

  function space(target: Element, type: 'keydown' | 'keyup') {
    const event = new KeyboardEvent(type, {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    })
    target.dispatchEvent(event)
    return event
  }

  const exportButton = () =>
    wrapper.findAll('button').find((b) => b.text() === 'Export')!.element as HTMLButtonElement

  it('lets Space press the top-bar Export instead of starting space-pan', async () => {
    const button = exportButton()
    button.focus()
    expect(space(button, 'keydown').defaultPrevented).toBe(false)
    expect(space(button, 'keyup').defaultPrevented).toBe(false)
  })

  it('lets Space press the controls inside the open export panel', async () => {
    useExportStore().openPanel()
    await flushPromises()
    const panel = document.querySelector('[role="dialog"]')!
    const confirm = Array.from(panel.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Export',
    )!
    const radio = panel.querySelector('[role="radio"]')!
    for (const target of [confirm, radio]) {
      expect(space(target, 'keydown').defaultPrevented).toBe(false)
      expect(space(target, 'keyup').defaultPrevented).toBe(false)
    }
  })

  it('still enters space-pan over the canvas', () => {
    const canvas = wrapper.get('[data-testid="preview-canvas"]').element
    expect(space(canvas, 'keydown').defaultPrevented).toBe(true)
    expect(space(canvas, 'keyup').defaultPrevented).toBe(true)
  })
})

// The same Space-to-pan meets the "Crop and rotate" action and the tool's panel (crop-rotate AC-20).
describe('App — Space on the crop-rotate controls (crop-rotate AC-20)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    editor = useEditorStore()
    editor.setRendererFactory(createFakeRenderer().factory)
    editor.setDecoder(async () =>
      ok({
        bitmap: { width: 4000, height: 3000, close() {} } as unknown as ImageBitmap,
        sourceWidth: 4000,
        sourceHeight: 3000,
        width: 4000,
        height: 3000,
        format: 'png',
        animated: false,
        downscaled: false,
        hasTransparency: false,
      }),
    )
    editor.setCanvasSize(1000, 1000)
    await editor.openImage(new Blob())
    wrapper = mount(App, { attachTo: document.body, global: { plugins: [pinia] } })
    await editor.runCapabilityGate(async () => ok(undefined))
    await flushPromises()
  })
  afterEach(() => wrapper.unmount())

  function space(target: Element, type: 'keydown' | 'keyup') {
    const event = new KeyboardEvent(type, {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    })
    target.dispatchEvent(event)
    return event
  }

  it('lets Space press the "Crop and rotate" action instead of starting space-pan', () => {
    const action = wrapper.get('[data-testid="crop-rotate-action"]').element as HTMLButtonElement
    action.focus()
    expect(space(action, 'keydown').defaultPrevented).toBe(false)
    expect(space(action, 'keyup').defaultPrevented).toBe(false)
  })

  it('lets Space press Rotate, a proportion and Apply inside the open tool', async () => {
    await wrapper.get('[data-testid="crop-rotate-action"]').trigger('click')
    await flushPromises()
    const tool = wrapper.get('[data-testid="crop-rotate-tool"]').element
    const buttons = Array.from(tool.querySelectorAll('button'))
    const rotate = buttons.find((b) =>
      /rotate/i.test(b.getAttribute('aria-label') ?? b.textContent ?? ''),
    )!
    const apply = buttons.find((b) => b.textContent?.trim() === 'Apply')!
    const radio = tool.querySelector('[role="radio"], input[type="radio"]')!
    for (const target of [rotate, apply, radio]) {
      expect(space(target, 'keydown').defaultPrevented).toBe(false)
      expect(space(target, 'keyup').defaultPrevented).toBe(false)
    }
  })

  it('still enters space-pan over the canvas while the tool is open', async () => {
    await wrapper.get('[data-testid="crop-rotate-action"]').trigger('click')
    await flushPromises()
    const canvas = wrapper.get('[data-testid="preview-canvas"]').element
    expect(space(canvas, 'keydown').defaultPrevented).toBe(true)
    expect(space(canvas, 'keyup').defaultPrevented).toBe(true)
  })
})
