import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createWork, ok, type AppError, type Result } from '@/core'
import { useEditorStore } from '@/features/editor'
import type { ExportRequest } from '@/render'
import { useNotices } from '@/shared'
import ExportAction from './ExportAction.vue'
import { useExportStore } from './store'

const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await nextTick()
    await Promise.resolve()
  }
}

describe('ExportAction and Ctrl/Cmd+S (AC-11, AC-17)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>
  let store: ReturnType<typeof useExportStore>
  let exporter: ReturnType<typeof vi.fn<(r: ExportRequest) => Promise<Result<Blob, AppError>>>>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    store = useExportStore()
    store.setFormatChecker(async () => ({ png: true, jpeg: true, webp: true }))
    store.setSaveDialogProbe(() => false)
    exporter = vi.fn(async () => ok(new Blob([new Uint8Array([1])])))
    store.setExporter(exporter)
    store.setBitmapCopier(async (b) => b)
    store.setSavePlatform({ downloadFile: vi.fn() })
    wrapper = mount(ExportAction, { attachTo: document.body })
    await flush()
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  function openWork() {
    const pixels = { width: 800, height: 600, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ width: 800, height: 600, pixels, hasTransparency: false }, 'w-1', {
      sourceName: 'IMG_4021',
      sourceFormat: 'png',
    })
  }

  const exportButton = () => wrapper.get('button.base-button')
  const texts = () => useNotices().items.map((n) => n.text)
  const pressSave = (init: KeyboardEventInit = { ctrlKey: true }) => {
    const event = new KeyboardEvent('keydown', {
      key: 's',
      cancelable: true,
      bubbles: true,
      ...init,
    })
    window.dispatchEvent(event)
    return event
  }

  it('is a native, enabled, focusable button, so Tab reaches it and Enter/Space activate it', async () => {
    openWork()
    await flush()
    const button = exportButton()
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.attributes('tabindex')).toBeUndefined()
    expect(button.text()).toBe('Export')
    ;(button.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(button.element)
  })

  it('opens and closes the panel on activation, anchored to itself', async () => {
    openWork()
    await flush()
    await exportButton().trigger('click')
    await flush()
    expect(store.panelOpen).toBe(true)
    expect(exportButton().attributes('aria-expanded')).toBe('true')
    expect(document.querySelector('[role="dialog"][aria-label="Export"]')).not.toBeNull()

    await exportButton().trigger('click')
    expect(store.panelOpen).toBe(false)
  })

  it('with no image: unavailable but focusable, with a hint, and activation shows the notice', async () => {
    const button = exportButton()
    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.attributes('disabled')).toBeUndefined()
    const hintId = button.attributes('aria-describedby')!
    expect(document.getElementById(hintId)?.textContent).toBe('Open an image first to export it.')

    await button.trigger('click')
    expect(store.panelOpen).toBe(false)
    expect(texts()).toEqual(['Open an image first to export it.'])
  })

  it("Ctrl/Cmd+S with no image shows the hint and never the browser's Save page", () => {
    const event = pressSave()
    expect(event.defaultPrevented).toBe(true)
    expect(texts()).toEqual(['Open an image first to export it.'])
  })

  it.each([{ ctrlKey: true }, { metaKey: true }])(
    'Ctrl/Cmd+S (%o) with the panel closed opens it',
    async (mod) => {
      openWork()
      await flush()
      const event = pressSave(mod)
      await flush()
      expect(event.defaultPrevented).toBe(true)
      expect(store.panelOpen).toBe(true)
      expect(exporter).not.toHaveBeenCalled()
    },
  )

  it('Ctrl/Cmd+S with the panel open confirms, after applying a value still being typed', async () => {
    openWork()
    await flush()
    store.openPanel()
    store.selectFormat('jpeg')
    store.registerFlush(() => store.setQuality(21))
    pressSave()
    await flush()
    expect(exporter).toHaveBeenCalledTimes(1)
    expect(exporter.mock.calls[0]![0].quality).toBe(21)
  })

  it('Ctrl/Cmd+S during an export does nothing but block the Save page', async () => {
    openWork()
    await flush()
    store.openPanel()
    let release!: () => void
    exporter.mockImplementationOnce(() => new Promise((r) => (release = () => r(ok(new Blob())))))
    void store.confirm()
    await flush()
    const event = pressSave()
    await flush()
    expect(event.defaultPrevented).toBe(true)
    expect(exporter).toHaveBeenCalledTimes(1)
    release()
    await flush()
  })

  it('ignores S with Shift or Alt, and plain S', () => {
    openWork()
    expect(pressSave({ ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(false)
    expect(pressSave({ ctrlKey: true, altKey: true }).defaultPrevented).toBe(false)
    expect(pressSave({}).defaultPrevented).toBe(false)
  })

  it('is disabled with "Exporting…" and a spinner during an export, enabled after', async () => {
    openWork()
    await flush()
    store.openPanel()
    let release!: () => void
    exporter.mockImplementationOnce(() => new Promise((r) => (release = () => r(ok(new Blob())))))
    void store.confirm()
    await flush()

    const button = exportButton()
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toContain('Exporting…')
    expect(button.find('[role="status"]').exists()).toBe(true)

    release()
    await flush()
    expect(exportButton().attributes('disabled')).toBeUndefined()
    expect(exportButton().text()).toBe('Export')
  })

  it('removes its Ctrl/Cmd+S listener on unmount', () => {
    wrapper.unmount()
    expect(pressSave().defaultPrevented).toBe(false)
    wrapper = mount(ExportAction)
  })
})
