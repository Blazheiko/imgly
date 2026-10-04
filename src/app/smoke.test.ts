import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from './App.vue'
import { EditorView } from '@/features/editor'

describe('app shell', () => {
  it('mounts App and renders EditorView', () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } })

    expect(wrapper.findComponent(EditorView).exists()).toBe(true)
    expect(wrapper.find('[data-testid="editor-view"]').exists()).toBe(true)
  })
})
