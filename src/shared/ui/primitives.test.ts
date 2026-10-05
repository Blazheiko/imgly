import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { CanvasMessage, Dialog, Spinner, Toast, ToastStack } from './index'
import { useNotices } from '../notices'

describe('Spinner', () => {
  it('is an indeterminate status with a visually hidden label', () => {
    const wrapper = mount(Spinner, { props: { label: 'Opening image' } })
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.text()).toContain('Opening image')
  })
})

describe('Toast', () => {
  it('announces a failure assertively and an info notice politely', () => {
    const failure = mount(Toast, { props: { kind: 'failure', text: 'Too large.' } })
    const info = mount(Toast, { props: { kind: 'info', text: 'Reduced.' } })

    expect(failure.attributes('role')).toBe('alert')
    expect(info.attributes('role')).toBe('status')
    expect(info.attributes('aria-live')).toBe('polite')
  })

  it('emits dismiss from its dismiss button', async () => {
    const wrapper = mount(Toast, { props: { kind: 'failure', text: 'Too large.' } })
    await wrapper.get('button[aria-label="Dismiss"]').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})

describe('ToastStack', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('shows every queued notice at once without one hiding another', async () => {
    const wrapper = mount(ToastStack)
    useNotices().pushAll([
      { kind: 'info', text: 'Reduced.' },
      { kind: 'info', text: 'First frame.' },
      { kind: 'failure', text: 'Too large.' },
    ])
    await nextTick()

    const toasts = wrapper.findAllComponents(Toast)
    expect(toasts.map((t) => t.text())).toEqual([
      expect.stringContaining('Reduced.'),
      expect.stringContaining('First frame.'),
      expect.stringContaining('Too large.'),
    ])
  })

  it('removes a notice when its toast is dismissed', async () => {
    const wrapper = mount(ToastStack)
    useNotices().pushAll([{ kind: 'failure', text: 'Too large.' }])
    await nextTick()

    await wrapper.get('button[aria-label="Dismiss"]').trigger('click')
    expect(useNotices().items).toHaveLength(0)
  })
})

describe('Dialog', () => {
  const Host = defineComponent({
    emits: ['cancel'],
    setup(_, { emit }) {
      return () =>
        h(
          Dialog,
          { title: 'Replace?', initialFocus: '[data-cancel]', onCancel: () => emit('cancel') },
          {
            default: () => h('p', 'Body'),
            actions: () => [
              h('button', { 'data-cancel': '' }, 'Cancel'),
              h('button', { 'data-replace': '' }, 'Replace'),
            ],
          },
        )
    },
  })

  let opener: HTMLButtonElement
  beforeEach(() => {
    opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
  })
  afterEach(() => opener.remove())

  it('is a labelled alertdialog that focuses the initial-focus element', async () => {
    const wrapper = mount(Host, { attachTo: document.body })
    await nextTick()

    const dialog = wrapper.get('[role="alertdialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(document.getElementById(dialog.attributes('aria-labelledby')!)?.textContent).toBe(
      'Replace?',
    )
    expect(document.activeElement).toBe(wrapper.get('[data-cancel]').element)
    wrapper.unmount()
  })

  it('emits cancel on Esc and on a backdrop click', async () => {
    const wrapper = mount(Host, { attachTo: document.body })
    await nextTick()

    await wrapper.get('[role="alertdialog"]').trigger('keydown', { key: 'Escape' })
    await wrapper.get('[data-testid="dialog-backdrop"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(2)
    wrapper.unmount()
  })

  it('wraps Tab focus inside the dialog', async () => {
    const wrapper = mount(Host, { attachTo: document.body })
    await nextTick()
    const cancel = wrapper.get('[data-cancel]').element as HTMLElement
    const replace = wrapper.get('[data-replace]').element as HTMLElement

    replace.focus()
    await wrapper.get('[role="alertdialog"]').trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(cancel)

    await wrapper.get('[role="alertdialog"]').trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(replace)
    wrapper.unmount()
  })

  it('returns focus to the opener when it closes', async () => {
    const wrapper = mount(Host, { attachTo: document.body })
    await nextTick()
    wrapper.unmount()
    expect(document.activeElement).toBe(opener)
  })
})

describe('CanvasMessage', () => {
  it('renders a title, a body and an optional action with the given role', () => {
    const wrapper = mount(CanvasMessage, {
      props: { title: 'This browser can’t display the editor', role: 'alert' },
      slots: { default: 'Use a recent browser.', action: '<button>Reload</button>' },
    })

    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.get('h2').text()).toBe('This browser can’t display the editor')
    expect(wrapper.text()).toContain('Use a recent browser.')
    expect(wrapper.find('button').text()).toBe('Reload')
  })

  it('defaults to role status', () => {
    expect(mount(CanvasMessage, { props: { title: 'Restoring…' } }).attributes('role')).toBe(
      'status',
    )
  })
})
