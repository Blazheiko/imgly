import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useEditorStore } from '@/features/editor'
import { createFakeAutosave } from '@/features/editor/testing'
import { BaseButton } from '@/shared'
import InstallAction from './InstallAction.vue'
import { fakeInstallPrompt } from './testing'
import { usePwaInstallUpdate } from './store'

describe('InstallAction (SCR-01, AC-01 to AC-04)', () => {
  let store: ReturnType<typeof usePwaInstallUpdate>

  beforeEach(() => {
    setActivePinia(createPinia())
    useEditorStore().setAutosave(createFakeAutosave().fake)
    store = usePwaInstallUpdate()
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders nothing without an offer (AC-02)', () => {
    store.connectInstall(fakeInstallPrompt().client)
    const wrapper = mount(InstallAction)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('renders a ghost "Install app" with its tooltip once the browser offers, and is never disabled', async () => {
    const install = fakeInstallPrompt()
    store.connectInstall(install.client)
    const wrapper = mount(InstallAction)
    install.setOffer(true)
    await nextTick()

    const button = wrapper.get('button')
    expect(button.text()).toBe('Install app')
    expect(button.attributes('title')).toBe('Install imgly as an app on this computer')
    expect(button.classes()).toContain('base-button--ghost')
    expect(button.attributes('disabled')).toBeUndefined()
    expect(wrapper.findComponent(BaseButton).exists()).toBe(true)
  })

  it('opens the browser confirmation on click (AC-01)', async () => {
    const install = fakeInstallPrompt({ offer: true })
    store.connectInstall(install.client)
    const wrapper = mount(InstallAction)

    await wrapper.get('button').trigger('click')
    expect(install.prompt).toHaveBeenCalledTimes(1)
  })

  it('hides after a dismissal drops the offer (AC-03)', async () => {
    const install = fakeInstallPrompt({ offer: true })
    store.connectInstall(install.client)
    install.prompt.mockImplementation(async () => {
      install.setOffer(false)
      return { ok: true, value: 'dismissed' }
    })
    const wrapper = mount(InstallAction)

    await wrapper.get('button').trigger('click')
    await nextTick()
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('never renders in the Installed app (AC-04)', async () => {
    const install = fakeInstallPrompt({ standalone: true, offer: true })
    store.connectInstall(install.client)
    const wrapper = mount(InstallAction)
    install.setOffer(true)
    await nextTick()
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
