import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import {
  CanvasMessage,
  Dialog,
  NumberField,
  Popover,
  SegmentedControl,
  SliderField,
  Spinner,
  Toast,
  ToastStack,
} from './index'
import type { SegmentedOption } from './SegmentedControl.vue'
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

describe('Popover', () => {
  function setup(props: { open: boolean; locked?: boolean }) {
    const anchor = document.createElement('button')
    anchor.textContent = 'Export'
    document.body.appendChild(anchor)
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    const wrapper = mount(Popover, {
      props: { ...props, anchor, label: 'Export' },
      slots: { default: '<button class="first">PNG</button><button>JPEG</button>' },
      attachTo: document.body,
    })
    return { wrapper, anchor, outside }
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders nothing while closed and a non-modal panel when open', async () => {
    const { wrapper } = setup({ open: false })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    await wrapper.setProps({ open: true })
    const panel = wrapper.get('[role="dialog"]')
    expect(panel.attributes('aria-modal')).toBe('false')
    expect(panel.attributes('aria-label')).toBe('Export')
    expect(document.querySelector('[data-testid="dialog-backdrop"]')).toBeNull()
  })

  it('moves focus into the panel on open and back to the anchor on close', async () => {
    const { wrapper, anchor } = setup({ open: false })
    anchor.focus()
    await wrapper.setProps({ open: true })
    await nextTick()
    expect(document.activeElement?.className).toBe('first')

    await wrapper.setProps({ open: false })
    await nextTick()
    expect(document.activeElement).toBe(anchor)
  })

  it('does not trap focus', async () => {
    const { wrapper } = setup({ open: true })
    await nextTick()
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    wrapper.get('[role="dialog"]').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('emits close on Escape and on a pointerdown outside it and the anchor', async () => {
    const { wrapper, anchor, outside } = setup({ open: true })
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)

    anchor.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    wrapper.get('.first').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('ignores Escape and outside clicks while locked', async () => {
    const { wrapper, outside } = setup({ open: true, locked: true })
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('stops listening once closed', async () => {
    const { wrapper, outside } = setup({ open: true })
    await wrapper.setProps({ open: false })
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})

describe('SegmentedControl', () => {
  const options: SegmentedOption<string>[] = [
    { value: 'png', label: 'PNG' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'webp', label: 'WebP', disabled: true, hint: "WebP isn't available in this browser." },
  ]

  function setup(modelValue = 'png', opts: SegmentedOption<string>[] = options) {
    return mount(SegmentedControl, {
      props: { modelValue, options: opts, label: 'Format' },
      attachTo: document.body,
    })
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('is a labelled radiogroup with one checked radio', () => {
    const wrapper = setup('jpeg')
    const group = wrapper.get('[role="radiogroup"]')
    expect(group.attributes('aria-label')).toBe('Format')
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map((r) => r.attributes('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(radios.map((r) => r.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
  })

  it('selects an enabled option on click and never a disabled one', async () => {
    const wrapper = setup('png')
    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['jpeg']])

    await wrapper.findAll('[role="radio"]')[2]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['jpeg']])
  })

  it('moves with arrow keys, skipping disabled options and wrapping', async () => {
    const wrapper = setup('png')
    const radios = () => wrapper.findAll('[role="radio"]')
    const press = async (index: number, key: string) => {
      await radios()[index]!.trigger('keydown', { key })
      const value = wrapper.emitted<[string]>('update:modelValue')!.at(-1)![0]
      await wrapper.setProps({ modelValue: value })
      return value
    }

    expect(await press(0, 'ArrowRight')).toBe('jpeg')
    expect(await press(1, 'ArrowRight')).toBe('png')
    expect(await press(0, 'ArrowLeft')).toBe('jpeg')
    expect(document.activeElement).toBe(radios()[1]!.element)
    expect(radios()[1]!.attributes('tabindex')).toBe('0')
  })

  it('stays on the only enabled option', async () => {
    const wrapper = setup('png', [
      { value: 'png', label: 'PNG' },
      { value: 'jpeg', label: 'JPEG', disabled: true },
      { value: 'webp', label: 'WebP', disabled: true },
    ])
    await wrapper.get('[role="radio"]').trigger('keydown', { key: 'ArrowDown' })
    await wrapper.get('[role="radio"]').trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('marks disabled options and shows their hints under the group', () => {
    const wrapper = setup('png')
    const webp = wrapper.findAll('[role="radio"]')[2]!
    expect(webp.attributes('aria-disabled')).toBe('true')
    expect(wrapper.text()).toContain("WebP isn't available in this browser.")
  })
})

describe('NumberField', () => {
  // Clamp to 1…100, round, revert on garbage — the shape of the export quality rule.
  const normalize = vi.fn((raw: string, previous: number) => {
    const value = Number(raw.trim())
    if (raw.trim() === '' || Number.isNaN(value)) return previous
    return Math.min(100, Math.max(1, Math.round(value)))
  })

  function setup(modelValue = 90) {
    normalize.mockClear()
    return mount(NumberField, {
      props: { modelValue, label: 'Long side', unit: 'px', normalize },
      attachTo: document.body,
    })
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('shows a labelled input with its value and unit', () => {
    const wrapper = setup(4096)
    const input = wrapper.get('input')
    expect((input.element as HTMLInputElement).value).toBe('4096')
    expect(wrapper.get('label').text()).toContain('Long side')
    expect(wrapper.find(`label[for="${input.attributes('id')}"]`).exists()).toBe(true)
    expect(wrapper.text()).toContain('px')
  })

  it('does not apply while typing, then normalizes once on blur', async () => {
    const wrapper = setup(90)
    const input = wrapper.get('input')
    await input.setValue('150')
    expect(normalize).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await input.trigger('blur')
    expect(normalize).toHaveBeenCalledTimes(1)
    expect(normalize).toHaveBeenCalledWith('150', 90)
    expect(wrapper.emitted('update:modelValue')).toEqual([[100]])
    expect((input.element as HTMLInputElement).value).toBe('100')
  })

  it('applies on Enter without submitting or bubbling', async () => {
    const form = document.createElement('form')
    const onSubmit = vi.fn((event: Event) => event.preventDefault())
    const onKeydown = vi.fn()
    form.addEventListener('submit', onSubmit)
    form.addEventListener('keydown', onKeydown)
    document.body.appendChild(form)
    normalize.mockClear()
    const wrapper = mount(NumberField, {
      props: { modelValue: 90, label: 'Quality', normalize },
      attachTo: form,
    })
    const input = wrapper.get('input')
    await input.setValue('42.5')
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    input.element.dispatchEvent(event)
    await nextTick()

    expect(event.defaultPrevented).toBe(true)
    expect(onKeydown).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')).toEqual([[43]])
  })

  it('reverts an empty or non-numeric value to the previous one', async () => {
    const wrapper = setup(90)
    const input = wrapper.get('input')
    await input.setValue('abc')
    await input.trigger('blur')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect((input.element as HTMLInputElement).value).toBe('90')
  })

  it('exposes apply(), which acts like a blur only when text is pending', async () => {
    const wrapper = setup(90)
    ;(wrapper.vm as unknown as { apply(): void }).apply()
    expect(normalize).not.toHaveBeenCalled()

    await wrapper.get('input').setValue('7')
    ;(wrapper.vm as unknown as { apply(): void }).apply()
    expect(wrapper.emitted('update:modelValue')).toEqual([[7]])
  })

  it('follows a new modelValue while nothing is being typed', async () => {
    const wrapper = setup(90)
    await wrapper.setProps({ modelValue: 50 })
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('50')
  })

  it('can be disabled', () => {
    const wrapper = mount(NumberField, {
      props: { modelValue: 1, label: 'Quality', normalize, disabled: true },
    })
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
  })
})

describe('SliderField', () => {
  const normalize = (raw: string, previous: number) => {
    const value = Number(raw)
    return raw.trim() === '' || Number.isNaN(value)
      ? previous
      : Math.min(100, Math.max(1, Math.round(value)))
  }

  function setup(modelValue = 90) {
    return mount(SliderField, {
      props: { modelValue, label: 'Quality', min: 1, max: 100, normalize },
      attachTo: document.body,
    })
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('pairs a labelled range with a number field on the same value', () => {
    const wrapper = setup(90)
    const range = wrapper.get('input[type="range"]')
    expect(range.attributes('min')).toBe('1')
    expect(range.attributes('max')).toBe('100')
    expect(range.attributes('aria-label')).toBe('Quality')
    expect((range.element as HTMLInputElement).value).toBe('90')
    expect((wrapper.get('input:not([type="range"])').element as HTMLInputElement).value).toBe('90')
  })

  it('emits the dragged value and the number field shows it', async () => {
    const wrapper = setup(90)
    await wrapper.get('input[type="range"]').setValue('35')
    expect(wrapper.emitted('update:modelValue')).toEqual([[35]])

    await wrapper.setProps({ modelValue: 35 })
    expect((wrapper.get('input:not([type="range"])').element as HTMLInputElement).value).toBe('35')
  })

  it('emits a typed value normalized and the range follows it', async () => {
    const wrapper = setup(90)
    const number = wrapper.get('input:not([type="range"])')
    await number.setValue('500')
    await number.trigger('blur')
    expect(wrapper.emitted('update:modelValue')).toEqual([[100]])

    await wrapper.setProps({ modelValue: 100 })
    expect((wrapper.get('input[type="range"]').element as HTMLInputElement).value).toBe('100')
  })

  it('exposes apply() for a value still being typed', async () => {
    const wrapper = setup(90)
    await wrapper.get('input:not([type="range"])').setValue('12')
    ;(wrapper.vm as unknown as { apply(): void }).apply()
    expect(wrapper.emitted('update:modelValue')).toEqual([[12]])
  })
})
