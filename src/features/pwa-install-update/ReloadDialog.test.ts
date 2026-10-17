import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useEditorStore, type ReloadOutcome } from '@/features/editor'
import { createFakeAutosave } from '@/features/editor/testing'
import { useNotices } from '@/shared'
import ReloadDialog from './ReloadDialog.vue'
import { usePwaInstallUpdate } from './store'
import { fakeClient, fakeDocument } from './testing'
import { drawsIcon } from '@/shared/ui/testing'

const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await nextTick()
    await Promise.resolve()
  }
}

describe('ReloadDialog (SCR-06, AC-12)', () => {
  let store: ReturnType<typeof usePwaInstallUpdate>
  let sw: ReturnType<typeof fakeClient>
  let wrapper: VueWrapper
  const mark = vi.fn()
  const reloadPage = vi.fn()

  beforeEach(() => {
    setActivePinia(createPinia())
    const editor = useEditorStore()
    editor.setAutosave(createFakeAutosave().fake)
    store = usePwaInstallUpdate()
    sw = fakeClient()
    mark.mockReset()
    reloadPage.mockReset()
    store.connect(sw.create, { now: () => 0, document: fakeDocument().doc, mark, reloadPage })
    sw.newWaiting()
    wrapper = mount(ReloadDialog, { attachTo: document.body })
  })
  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  async function ask(reopenId: string | null) {
    vi.spyOn(useEditorStore(), 'requestReload').mockResolvedValue({
      kind: 'confirm',
      reopenId,
    } satisfies ReloadOutcome)
    useNotices()
      .items.find((n) => n.slot === 'app-update')!
      .action!.run()
    await flush()
  }

  const dialog = () => wrapper.find('[role="alertdialog"]')

  it('shows Cancel with x and Reload with refresh-cw (ui-refresh SCR-07)', async () => {
    await ask(null)
    const cancel = dialog().get('.base-button--secondary')
    const reload = dialog().get('.base-button--primary')
    expect(drawsIcon(cancel.element, 'x')).toBe(true)
    expect(drawsIcon(reload.element, 'refresh-cw')).toBe(true)
    expect([cancel.text(), reload.text()]).toEqual(['Cancel', 'Reload'])
  })

  it('is closed while nothing asks', () => {
    expect(dialog().exists()).toBe(false)
  })

  it('warns that the latest edits will be lost when a Stored state exists', async () => {
    await ask('work-1')
    expect(dialog().text()).toContain('Reload and lose your latest edits?')
    expect(dialog().text()).toContain(
      "Your latest edits aren't saved in the Gallery and will be lost. The last saved version will reopen. Export the image first to keep them.",
    )
  })

  it('warns that the image will not come back when it was never stored', async () => {
    await ask(null)
    expect(dialog().text()).toContain('Reload and lose this image?')
    expect(dialog().text()).toContain(
      "This image isn't saved in the Gallery, so it won't come back after the reload. Export it first to keep it.",
    )
  })

  it('puts focus on Cancel first, with Cancel secondary and Reload primary', async () => {
    await ask('work-1')
    const cancel = wrapper.get('.base-button--secondary')
    expect(cancel.text()).toBe('Cancel')
    expect(wrapper.get('.base-button--primary').text()).toBe('Reload')
    expect(document.activeElement).toBe(cancel.element)
  })

  it.each([
    ['Cancel', (w: VueWrapper) => w.get('.base-button--secondary').trigger('click')],
    ['Esc', (w: VueWrapper) => w.get('[role="alertdialog"]').trigger('keydown', { key: 'Escape' })],
    ['the backdrop', (w: VueWrapper) => w.get('[data-testid="dialog-backdrop"]').trigger('click')],
  ])('%s cancels and changes nothing', async (_name, act) => {
    await ask('work-1')
    await act(wrapper)
    await flush()

    expect(store.confirming).toBeNull()
    expect(dialog().exists()).toBe(false)
    expect(mark).not.toHaveBeenCalled()
    expect(sw.client.activateWaiting).not.toHaveBeenCalled()
    expect(reloadPage).not.toHaveBeenCalled()
  })

  it('Reload confirms once, even on a double click', async () => {
    await ask('work-1')
    const reload = wrapper.get('.base-button--primary')
    await reload.trigger('click')
    await reload.trigger('click').catch(() => {})
    await flush()
    expect(sw.client.activateWaiting).toHaveBeenCalledTimes(1)

    sw.callbacks().onControllerChange()
    expect(mark).toHaveBeenCalledExactlyOnceWith('work-1')
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })
})
