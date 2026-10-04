import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { appError, err } from '@/core'
import type { DecodeOutcome } from '@/infra/image-decode'
import EditorView from './EditorView.vue'
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

  beforeEach(() => {
    setActivePinia(createPinia())
    decode = vi.fn(async () => err(appError('NOT_AN_IMAGE')))
    useEditorStore().setDecoder(decode)
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

  it('shows a labelled spinner while reading, keeping Open image enabled', async () => {
    decode.mockImplementation(() => new Promise(() => {}))
    window.dispatchEvent(dropEvent('drop', [new File(['x'], 'a.png')]))
    await nextTick()

    expect(wrapper.get('[role="status"]').text()).toContain('Opening image')
    expect(wrapper.get('.base-button--primary').attributes('disabled')).toBeUndefined()
  })
})
