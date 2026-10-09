import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createWork, ok } from '@/core'
import { useEditorStore } from '@/features/editor'
import { createFakeRenderer } from '@/features/editor/testing'
import App from './App.vue'

describe('App tool slots (adjust T16, crop-rotate ADR-0003)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setRendererFactory(createFakeRenderer().factory)
    wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await editor.runCapabilityGate(async () => ok(undefined))
    const pixels = { width: 400, height: 300, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ width: 400, height: 300, pixels, hasTransparency: false }, 'w', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    await nextTick()
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  const has = (testid: string) => wrapper.find(`[data-testid="${testid}"]`).exists()

  it('mounts only the adjust tool for "adjust"', async () => {
    editor.openTool('adjust')
    await nextTick()
    expect(has('adjust-tool')).toBe(true)
    expect(has('crop-rotate-tool')).toBe(false)
    expect(has('crop-frame')).toBe(false)
  })

  it('mounts only the crop-rotate tool for "crop-rotate"', async () => {
    editor.openTool('crop-rotate')
    await nextTick()
    expect(has('crop-rotate-tool')).toBe(true)
    expect(has('adjust-tool')).toBe(false)
  })

  it('shows "Adjust" in the top bar after "Crop and rotate"', () => {
    const order = [...wrapper.element.querySelectorAll('[data-testid$="-action"]')].map((el) =>
      el.getAttribute('data-testid'),
    )
    expect(order.indexOf('adjust-action')).toBe(order.indexOf('crop-rotate-action') + 1)
  })
})
