import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { appError, err, ok } from '@/core'
import type { DecodeOutcome } from '@/infra/image-decode'
import EditorView from './EditorView.vue'
import { createFakeRenderer } from './fake-renderer'
import { useEditorStore } from './store'

function dropEvent(type: string, files: File[] = []) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  const items = files.map((file) => ({
    kind: 'file',
    getAsFile: () => file,
    webkitGetAsEntry: () => ({ isDirectory: false }),
  }))
  Object.defineProperty(event, 'dataTransfer', { value: { items, files } })
  return event
}

describe('EditorView — SCR-01 (empty editor)', () => {
  let wrapper: VueWrapper
  let decode: ReturnType<typeof vi.fn<(file: Blob) => Promise<DecodeOutcome>>>

  beforeEach(async () => {
    setActivePinia(createPinia())
    decode = vi.fn(async () => err(appError('NOT_AN_IMAGE')))
    useEditorStore().setDecoder(decode)
    await useEditorStore().runCapabilityGate(async () => ok(undefined))
    wrapper = mount(EditorView, { attachTo: document.body })
  })
  afterEach(() => wrapper.unmount())

  it('shows one primary "Open image" action and the drop hint (AC-17)', () => {
    const primary = wrapper.findAll('.base-button--primary')
    expect(primary).toHaveLength(1)
    expect(primary[0]!.text()).toBe('Open image')
    expect(wrapper.text()).toContain('or drop an image anywhere in this window')
  })

  it('shows the app name in the top bar without an Open action on SCR-01', () => {
    const bar = wrapper.get('[data-testid="editor-top-bar"]')
    expect(bar.text()).toContain('imgly')
    expect(bar.find('button').exists()).toBe(false)
  })

  it('opens the picker from the button and hands the chosen file to the store', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    await wrapper.get('.base-button--primary').trigger('click')
    const input = click.mock.contexts[0] as HTMLInputElement
    const chosen = new File(['x'], 'a.png')
    Object.defineProperty(input, 'files', { value: [chosen] })
    input.dispatchEvent(new Event('change'))
    await flushPromises()

    expect(decode).toHaveBeenCalledWith(chosen)
  })

  it('opens the picker on Ctrl/Cmd+O and blocks the browser’s own open', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    for (const mod of [{ ctrlKey: true }, { metaKey: true }]) {
      const event = new KeyboardEvent('keydown', { key: 'o', cancelable: true, ...mod })
      window.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    }
    expect(click).toHaveBeenCalledTimes(2)
  })

  it('blocks page zoom from Ctrl+wheel and Safari pinch anywhere in the editor (AC-12)', () => {
    const bar = wrapper.get('[data-testid="editor-top-bar"]').element
    const wheel = new WheelEvent('wheel', { deltaY: -100, cancelable: true, bubbles: true })
    Object.defineProperty(wheel, 'ctrlKey', { value: true })
    bar.dispatchEvent(wheel)
    expect(wheel.defaultPrevented).toBe(true)

    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      const gesture = new Event(type, { cancelable: true, bubbles: true })
      bar.dispatchEvent(gesture)
      expect(gesture.defaultPrevented).toBe(true)
    }
  })

  it('leaves a plain wheel outside the canvas alone', () => {
    const wheel = new WheelEvent('wheel', { deltaY: 40, cancelable: true, bubbles: true })
    wrapper.get('[data-testid="editor-top-bar"]').element.dispatchEvent(wheel)
    expect(wheel.defaultPrevented).toBe(false)
  })

  it('shows the drop overlay while a drag is over the window', async () => {
    window.dispatchEvent(dropEvent('dragenter'))
    await nextTick()
    expect(wrapper.text()).toContain('Drop an image to open it')

    window.dispatchEvent(dropEvent('dragleave'))
    await nextTick()
    expect(wrapper.text()).not.toContain('Drop an image to open it')
  })

  it('shows the AC-04 notice for a dropped non-image and prevents navigation', async () => {
    const drop = dropEvent('drop', [new File(['hello'], 'notes.txt', { type: 'text/plain' })])
    window.dispatchEvent(drop)
    await flushPromises()

    expect(drop.defaultPrevented).toBe(true)
    expect(wrapper.text()).toContain('Only image files can be opened.')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  it('shows the byte-ceiling reason for a file above 500 MB in the failure toast (AC-09)', async () => {
    decode.mockResolvedValue(err(appError('TOO_LARGE', { megabytes: 612, ceilingMegabytes: 500 })))
    window.dispatchEvent(dropEvent('drop', [new File(['x'], 'scan.tif', { type: 'image/tiff' })]))
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'This file is too large: 612 MB. The largest file the editor opens is 500 MB.',
    )
    expect(wrapper.find('.base-button--primary').exists()).toBe(true) // still SCR-01
  })

  it('shows a labelled spinner while reading, keeping Open image enabled', async () => {
    decode.mockImplementation(() => new Promise(() => {}))
    window.dispatchEvent(dropEvent('drop', [new File(['x'], 'a.png')]))
    await nextTick()

    expect(wrapper.get('[role="status"]').text()).toContain('Opening image')
    expect(wrapper.get('.base-button--primary').attributes('disabled')).toBeUndefined()
  })
})

describe('EditorView — zoom shortcuts (SCR-02)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setRendererFactory(createFakeRenderer().factory)
    editor.setDecoder(async () => ({
      ok: true,
      value: {
        bitmap: { width: 4000, height: 4000, close() {} } as unknown as ImageBitmap,
        sourceWidth: 4000,
        sourceHeight: 4000,
        width: 4000,
        height: 4000,
        format: 'png',
        animated: false,
        downscaled: false,
        hasTransparency: false,
      },
    }))
    editor.setCanvasSize(1000, 1000)
    await editor.openImage(new Blob())
    await editor.runCapabilityGate(async () => ok(undefined))
    wrapper = mount(EditorView, { attachTo: document.body })
  })
  afterEach(() => wrapper.unmount())

  const press = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', { cancelable: true, ...init })
    window.dispatchEvent(event)
    return event
  }

  it('shows the status bar on SCR-02', () => {
    expect(wrapper.find('[data-testid="dimensions-readout"]').text()).toBe('4000 × 4000 px')
  })

  it('Shift+0 is 100% and Shift+1 is Fit', () => {
    press({ key: ')', code: 'Digit0', shiftKey: true })
    expect(editor.view.zoom).toBe(1)
    press({ key: '!', code: 'Digit1', shiftKey: true })
    expect(editor.view).toMatchObject({ zoom: 0.25, autoFit: true })
  })

  it('+ / = zoom in and - zooms out through the fixed levels', () => {
    press({ key: '+', code: 'Equal', shiftKey: true })
    expect(editor.view.zoom).toBeCloseTo(1 / 3)
    press({ key: '=', code: 'Equal' })
    expect(editor.view.zoom).toBe(0.5)
    press({ key: '-', code: 'Minus' })
    expect(editor.view.zoom).toBeCloseTo(1 / 3)
  })

  it('with Draw open, the key right of P steps the width instead of zooming (draw AC-19)', () => {
    editor.openTool('draw')
    const zoom = editor.view.zoom
    const german = press({ key: '+', code: 'BracketRight' })
    expect(editor.view.zoom).toBe(zoom)
    expect(german.defaultPrevented).toBe(false) // left for the tool's own key handler
    press({ key: '+', code: 'Equal', shiftKey: true })
    expect(editor.view.zoom).toBeGreaterThan(zoom)
  })

  it('with no tool open, + on the key right of P still zooms', () => {
    const zoom = editor.view.zoom
    press({ key: '+', code: 'BracketRight' })
    expect(editor.view.zoom).toBeGreaterThan(zoom)
  })

  it('never intercepts the browser’s Ctrl/Cmd + / - / 0', () => {
    for (const init of [
      { key: '=', code: 'Equal', ctrlKey: true },
      { key: '-', code: 'Minus', metaKey: true },
      { key: '0', code: 'Digit0', ctrlKey: true },
    ]) {
      const event = press(init)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(editor.view.zoom).toBe(0.25)
  })

  it('Space held over a focused button enters pan mode and never presses the button (AC-13)', async () => {
    const zoomIn = wrapper.get('[aria-label="Zoom in"]').element as HTMLButtonElement
    editor.actualSize() // the image now overflows the canvas, so a drag can pan
    zoomIn.focus()
    const down = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    })
    zoomIn.dispatchEvent(down)
    await nextTick()
    expect(down.defaultPrevented).toBe(true)
    const canvas = wrapper.get('[data-testid="preview-canvas"]')

    const startPan = editor.view.panX
    canvas.element.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 }),
    )
    canvas.element.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 60, clientY: 10, pointerId: 1 }),
    )
    expect(editor.view.panX).toBe(startPan + 50 * devicePixelRatio)

    const up = new KeyboardEvent('keyup', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    })
    zoomIn.dispatchEvent(up)
    await nextTick()
    expect(up.defaultPrevented).toBe(true) // keyup is handled only in pan mode
    expect(editor.view.zoom).toBe(1) // released Space did not press Zoom in
  })

  it('shares space-pan on the store, so a tool overlay can step aside (crop-rotate AC-19)', async () => {
    const canvas = wrapper.get('[data-testid="preview-canvas"]').element
    const init = { key: ' ', code: 'Space', bubbles: true, cancelable: true }
    canvas.dispatchEvent(new KeyboardEvent('keydown', init))
    expect(editor.spacePan).toBe(true)
    canvas.dispatchEvent(new KeyboardEvent('keyup', init))
    expect(editor.spacePan).toBe(false)
    canvas.dispatchEvent(new KeyboardEvent('keydown', init))
    window.dispatchEvent(new Event('blur'))
    expect(editor.spacePan).toBe(false)
  })

  it('starts no space-pan while a Stroke is in progress (draw AC-18)', () => {
    const canvas = wrapper.get('[data-testid="preview-canvas"]').element
    const init = { key: ' ', code: 'Space', bubbles: true, cancelable: true }
    editor.setStrokeActive(true)
    const down = new KeyboardEvent('keydown', init)
    canvas.dispatchEvent(down)
    expect(editor.spacePan).toBe(false)
    expect(down.defaultPrevented).toBe(true) // nor does it scroll or press anything
    editor.setStrokeActive(false)
    canvas.dispatchEvent(new KeyboardEvent('keydown', init))
    expect(editor.spacePan).toBe(true)
  })

  it('ignores shortcuts typed into a text field', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }))
    expect(editor.view.zoom).toBe(0.25)
    input.remove()
  })
})

describe('EditorView — SCR-03 replace dialog', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setRendererFactory(createFakeRenderer().factory)
    editor.setDecoder(async () => ({
      ok: true,
      value: {
        bitmap: { width: 400, height: 400, close() {} } as unknown as ImageBitmap,
        sourceWidth: 400,
        sourceHeight: 400,
        width: 400,
        height: 400,
        format: 'png',
        animated: false,
        downscaled: false,
        hasTransparency: false,
      },
    }))
    editor.setCanvasSize(1000, 1000)
    await editor.openImage(new Blob())
    editor.applyEdit()
    await editor.openImage(new Blob())
    await editor.runCapabilityGate(async () => ok(undefined))
    wrapper = mount(EditorView, { attachTo: document.body })
    await nextTick()
  })
  afterEach(() => wrapper.unmount())

  it('shows the dialog while confirming', () => {
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true)
  })

  it('ignores drops and shows no drop overlay while the dialog is open', async () => {
    const drop = vi.spyOn(editor, 'openDrop')
    window.dispatchEvent(dropEvent('dragenter'))
    await nextTick()
    expect(wrapper.text()).not.toContain('Drop an image to open it')

    const event = dropEvent('drop', [new File(['x'], 'a.png')])
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(drop).not.toHaveBeenCalled()
  })

  it('never shows the dialog over SCR-05 when the display is lost mid-confirm', async () => {
    editor.setRendererStatus('lost')
    await nextTick()
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
    expect(wrapper.text()).toContain("The display couldn't recover.")
  })

  it('ignores zoom shortcuts while the dialog is open', () => {
    const zoom = editor.view.zoom
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', cancelable: true }))
    expect(editor.view.zoom).toBe(zoom)
  })
})

describe('EditorView — blocking screens', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setRendererFactory(createFakeRenderer().factory)
    editor.setDecoder(async () => err(appError('NOT_AN_IMAGE')))
  })
  afterEach(() => wrapper.unmount())

  it('SCR-04: names the problem, offers no Open image, ignores drops and Ctrl/Cmd+O (AC-18)', async () => {
    await editor.runCapabilityGate(async () => err(appError('UNSUPPORTED_BROWSER')))
    wrapper = mount(EditorView, { attachTo: document.body })
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    expect(wrapper.get('[role="status"] h2').text()).toBe("This browser can't display the editor.")
    expect(wrapper.text()).toContain('Try a current version of Chrome, Edge, Firefox or Safari.')
    expect(wrapper.findAll('button').filter((b) => b.text() === 'Open image')).toHaveLength(0)

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, cancelable: true }),
    )
    expect(click).not.toHaveBeenCalled()

    window.dispatchEvent(dropEvent('dragenter'))
    const drop = dropEvent('drop', [new File(['x'], 'a.png')])
    window.dispatchEvent(drop)
    await flushPromises()
    expect(drop.defaultPrevented).toBe(true)
    expect(wrapper.text()).not.toContain('Drop an image to open it')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain("This browser can't display the editor.")
  })

  it('shows nothing in the canvas area while the gate is still checking', () => {
    wrapper = mount(EditorView, { attachTo: document.body })
    expect(wrapper.text()).not.toContain('Open image')
  })

  it('SCR-05: replaces the canvas, hides the status bar and focuses Reload page (AC-19b)', async () => {
    editor.setDecoder(async () =>
      ok({
        bitmap: { width: 10, height: 10, close() {} } as unknown as ImageBitmap,
        sourceWidth: 10,
        sourceHeight: 10,
        width: 10,
        height: 10,
        format: 'png',
        animated: false,
        downscaled: false,
        hasTransparency: false,
      }),
    )
    await editor.runCapabilityGate(async () => ok(undefined))
    await editor.openImage(new Blob())
    wrapper = mount(EditorView, { attachTo: document.body })
    editor.setRendererStatus('lost')
    await flushPromises()

    expect(wrapper.get('[role="alert"] h2').text()).toBe("The display couldn't recover.")
    expect(wrapper.text()).toContain('The open image and any edits will be lost.')
    expect(wrapper.find('[data-testid="editor-status-bar"]').exists()).toBe(false)
    expect(document.activeElement?.textContent?.trim()).toBe('Reload page')
  })

  it('restoring: keeps the zoom controls and shows a spinner over the surround', async () => {
    editor.setDecoder(async () =>
      ok({
        bitmap: { width: 10, height: 10, close() {} } as unknown as ImageBitmap,
        sourceWidth: 10,
        sourceHeight: 10,
        width: 10,
        height: 10,
        format: 'png',
        animated: false,
        downscaled: false,
        hasTransparency: false,
      }),
    )
    await editor.runCapabilityGate(async () => ok(undefined))
    await editor.openImage(new Blob())
    wrapper = mount(EditorView, { attachTo: document.body })
    editor.setRendererStatus('restoring')
    await nextTick()

    expect(wrapper.find('[data-testid="restoring"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="editor-status-bar"]').exists()).toBe(true)
  })
})

describe('EditorView — while exporting (export AC-11)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>
  let decode: ReturnType<typeof vi.fn<(file: Blob) => Promise<DecodeOutcome>>>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setRendererFactory(createFakeRenderer().factory)
    decode = vi.fn(async () => ({
      ok: true as const,
      value: {
        bitmap: { width: 4000, height: 4000, close() {} } as unknown as ImageBitmap,
        sourceWidth: 4000,
        sourceHeight: 4000,
        width: 4000,
        height: 4000,
        format: 'png' as const,
        animated: false,
        downscaled: false,
        hasTransparency: false,
      },
    }))
    editor.setDecoder(decode)
    editor.setCanvasSize(1000, 1000)
    await editor.openImage(new Blob())
    await editor.runCapabilityGate(async () => ok(undefined))
    wrapper = mount(EditorView, {
      attachTo: document.body,
      slots: { 'top-bar-actions': '<button data-testid="slotted">Export</button>' },
    })
  })
  afterEach(() => wrapper.unmount())

  const openButton = () => wrapper.findAll('button').find((b) => b.text() === 'Open image')!

  it('renders the top-bar actions slot after "Open image"', () => {
    const bar = wrapper.get('[data-testid="editor-top-bar"]')
    const labels = bar.findAll('button').map((b) => b.text())
    expect(labels).toEqual(['Open image', 'Export'])
  })

  it('disables "Open image" during an export and enables it after', async () => {
    const snapshot = editor.beginExport()!
    await nextTick()
    expect(openButton().attributes('disabled')).toBeDefined()

    editor.finishExport(snapshot, false)
    await nextTick()
    expect(openButton().attributes('disabled')).toBeUndefined()
  })

  it('ignores Ctrl/Cmd+O but keeps zoom keys live during an export', async () => {
    editor.beginExport()
    const ctrlO = new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, cancelable: true })
    window.dispatchEvent(ctrlO)
    await flushPromises()
    expect(decode).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ')', code: 'Digit0', shiftKey: true }))
    expect(editor.view.zoom).toBe(1)
  })

  it('shows no drop overlay, and a drop raises the "wait" notice without opening', async () => {
    editor.beginExport()
    window.dispatchEvent(dropEvent('dragenter'))
    await nextTick()
    expect(wrapper.find('[data-testid="drop-overlay"]').exists()).toBe(false)

    window.dispatchEvent(dropEvent('drop', [new File(['x'], 'b.png', { type: 'image/png' })]))
    await flushPromises()
    expect(decode).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Wait for the export to finish, then drop the image again.')
  })
})

describe('EditorView — tool slots (crop-rotate ADR-0003)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setRendererFactory(createFakeRenderer().factory)
    editor.setDecoder(async () => ({
      ok: true as const,
      value: {
        bitmap: { width: 400, height: 300, close() {} } as unknown as ImageBitmap,
        sourceWidth: 400,
        sourceHeight: 300,
        width: 400,
        height: 300,
        format: 'png' as const,
        animated: false,
        downscaled: false,
        hasTransparency: false,
      },
    }))
    editor.setCanvasSize(1000, 1000)
    await editor.openImage(new Blob())
    await editor.runCapabilityGate(async () => ok(undefined))
    wrapper = mount(EditorView, {
      attachTo: document.body,
      slots: {
        'tool-canvas': '<div data-testid="tool-canvas" />',
        'tool-panel': '<aside data-testid="tool-panel" />',
      },
    })
  })
  afterEach(() => wrapper.unmount())

  it('shows the tool slots only while a tool is open, keeping the Preview mounted', async () => {
    expect(wrapper.find('[data-testid="tool-canvas"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tool-panel"]').exists()).toBe(false)
    const canvas = wrapper.get('[data-testid="preview-canvas"]').element

    editor.openTool('crop-rotate')
    await nextTick()
    const area = wrapper.get('section[aria-label="Canvas"]')
    expect(area.find('[data-testid="tool-canvas"]').exists()).toBe(true)
    expect(area.find('[data-testid="tool-panel"]').exists()).toBe(false) // beside, not over
    expect(wrapper.find('[data-testid="tool-panel"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="preview-canvas"]').element).toBe(canvas)

    editor.closeTool()
    await nextTick()
    expect(wrapper.find('[data-testid="tool-canvas"]').exists()).toBe(false)
  })

  it('keeps the panel, so Cancel still works, when the display is lost', async () => {
    editor.openTool('crop-rotate')
    editor.setRendererStatus('lost')
    await nextTick()
    expect(wrapper.find('[data-testid="tool-canvas"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tool-panel"]').exists()).toBe(true)
  })
})
