import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import {
  BaseButton,
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
import segmentedSource from './SegmentedControl.vue?raw'
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

  it('follows its anchor when the window is resized while open, and stops once closed', async () => {
    const { wrapper, anchor } = setup({ open: false })
    let rect = { bottom: 40, right: 900 }
    anchor.getBoundingClientRect = () => rect as DOMRect
    const viewport = () => document.documentElement.clientWidth
    await wrapper.setProps({ open: true })
    const style = () => wrapper.get<HTMLElement>('[role="dialog"]').element.style
    expect(style().top).toBe('40px')

    rect = { bottom: 56, right: 500 }
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(style().top).toBe('56px')
    expect(style().right).toBe(`${viewport() - 500}px`)

    const removed = vi.spyOn(window, 'removeEventListener')
    await wrapper.setProps({ open: false })
    expect(removed).toHaveBeenCalledWith('resize', expect.any(Function))
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

  it('with no option selected, keeps the first enabled option in the tab order', () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        modelValue: null,
        options: [
          { value: 'a', label: 'A', disabled: true },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
        ],
        label: 'Size',
      },
    })
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map((r) => r.attributes('aria-checked'))).toEqual(['false', 'false', 'false'])
    expect(radios.map((r) => r.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
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

  it('announces the value with its unit through aria-valuetext, and none without a unit', async () => {
    const plain = setup(90)
    expect(plain.get('input[type="range"]').attributes('aria-valuetext')).toBeUndefined()
    plain.unmount()

    const percent = mount(SliderField, {
      props: { modelValue: 60, label: 'Sepia', min: 0, max: 100, unit: '%', normalize },
      attachTo: document.body,
    })
    const range = percent.get('input[type="range"]')
    expect(range.attributes('aria-valuetext')).toBe('60%')
    await percent.setProps({ modelValue: 5 })
    expect(range.attributes('aria-valuetext')).toBe('5%')
  })

  it('exposes apply() for a value still being typed', async () => {
    const wrapper = setup(90)
    await wrapper.get('input:not([type="range"])').setValue('12')
    ;(wrapper.vm as unknown as { apply(): void }).apply()
    expect(wrapper.emitted('update:modelValue')).toEqual([[12]])
  })
})

describe('SliderField options (crop-rotate AC-05, AC-20)', () => {
  const normalize = (raw: string, previous: number) => {
    const v = Number(raw)
    return Number.isNaN(v) ? previous : v
  }

  function angle(modelValue = 0) {
    return mount(SliderField, {
      props: {
        modelValue,
        label: 'Straighten',
        min: -45,
        max: 45,
        step: 0.1,
        decimals: 1,
        marks: [0],
        unit: '°',
        normalize,
      },
      attachTo: document.body,
    })
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps step 1, whole numbers and no marks by default', () => {
    const wrapper = mount(SliderField, {
      props: { modelValue: 5, label: 'Q', min: 1, max: 9, normalize },
    })
    expect(wrapper.get('input[type="range"]').attributes('step')).toBe('1')
    expect(wrapper.get('input[type="range"]').attributes('list')).toBeUndefined()
    expect((wrapper.get('input:not([type="range"])').element as HTMLInputElement).value).toBe('5')
  })

  it('announces the value with its decimals and unit', () => {
    expect(angle(2).get('input[type="range"]').attributes('aria-valuetext')).toBe('2.0°')
  })

  it('steps by 0.1, shows one decimal and marks 0', () => {
    const wrapper = angle(2)
    const range = wrapper.get('input[type="range"]')
    expect(range.attributes('step')).toBe('0.1')
    expect((wrapper.get('input:not([type="range"])').element as HTMLInputElement).value).toBe('2.0')
    const list = document.getElementById(range.attributes('list')!)!
    expect([...list.querySelectorAll('option')].map((o) => o.getAttribute('value'))).toEqual(['0'])
  })

  it('moves by a step on the arrow keys and ten with Shift, without float drift', async () => {
    const wrapper = angle(0.2)
    const range = wrapper.get('input[type="range"]')
    await range.trigger('keydown', { key: 'ArrowRight' })
    await range.trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(wrapper.emitted('update:modelValue')).toEqual([[0.3], [-0.8]])
  })

  it('clamps an arrow step at the ends', async () => {
    const wrapper = angle(44.95)
    await wrapper.get('input[type="range"]').trigger('keydown', { key: 'ArrowUp', shiftKey: true })
    expect(wrapper.emitted('update:modelValue')).toEqual([[45]])
  })

  it('rounds a dragged value to its decimals', async () => {
    const wrapper = angle(0)
    await wrapper.get('input[type="range"]').setValue('0.30000000000000004')
    expect(wrapper.emitted('update:modelValue')).toEqual([[0.3]])
  })
})

describe('SliderField neutral (adjust AC-10)', () => {
  const normalize = (_raw: string, previous: number) => previous

  function slider(props: Record<string, unknown> = {}) {
    return mount(SliderField, {
      props: { modelValue: 40, label: 'Contrast', min: -100, max: 100, normalize, ...props },
    })
  }

  it('sets the neutral value on a double-click of the range', async () => {
    const wrapper = slider({ neutral: 0 })
    await wrapper.get('input[type="range"]').trigger('dblclick')
    expect(wrapper.emitted('update:modelValue')).toEqual([[0]])
  })

  it('does nothing on a double-click without a neutral value', async () => {
    const wrapper = slider()
    await wrapper.get('input[type="range"]').trigger('dblclick')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('does nothing on a double-click when disabled or already neutral', async () => {
    const disabled = slider({ neutral: 0, disabled: true })
    await disabled.get('input[type="range"]').trigger('dblclick')
    expect(disabled.emitted('update:modelValue')).toBeUndefined()

    const atNeutral = slider({ neutral: 0, modelValue: 0 })
    await atNeutral.get('input[type="range"]').trigger('dblclick')
    expect(atNeutral.emitted('update:modelValue')).toBeUndefined()
  })

  it("shows the caller's tooltip on the range", () => {
    const wrapper = slider({ neutral: 0, rangeTitle: 'Double-click to reset' })
    expect(wrapper.get('input[type="range"]').attributes('title')).toBe('Double-click to reset')
    expect(slider().get('input[type="range"]').attributes('title')).toBeUndefined()
  })
})

describe('NumberField options (crop-rotate AC-07, AC-20)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('asks for a signed decimal keyboard when decimal, numeric otherwise', () => {
    const normalize = (_r: string, p: number) => p
    const plain = mount(NumberField, { props: { modelValue: 1, label: 'W', normalize } })
    expect(plain.get('input').attributes('inputmode')).toBe('numeric')
    const dec = mount(NumberField, {
      props: { modelValue: 1, label: 'A', normalize, decimal: true },
    })
    expect(dec.get('input').attributes('inputmode')).toBe('decimal')
  })

  it('discards text still being typed on Escape and lets Escape reach the tool', async () => {
    const onEscape = vi.fn()
    document.addEventListener('keydown', (e) => e.key === 'Escape' && onEscape())
    const normalize = vi.fn((raw: string) => Number(raw))
    const wrapper = mount(NumberField, {
      props: { modelValue: 7, label: 'A', normalize },
      attachTo: document.body,
    })
    const input = wrapper.get('input')
    await input.setValue('99')
    input.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    await input.trigger('blur')
    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(normalize).not.toHaveBeenCalled()
    expect((input.element as HTMLInputElement).value).toBe('7')
  })
})

describe('BaseButton pressed (crop-rotate SCR-03)', () => {
  it('has no aria-pressed unless pressed is given', () => {
    expect(mount(BaseButton).get('button').attributes('aria-pressed')).toBeUndefined()
    expect(
      mount(BaseButton, { props: { pressed: true } })
        .get('button')
        .attributes('aria-pressed'),
    ).toBe('true')
    const off = mount(BaseButton, { props: { pressed: false } }).get('button')
    expect(off.attributes('aria-pressed')).toBe('false')
    expect(off.classes()).not.toContain('base-button--pressed')
  })
})

describe('SegmentedControl swatches (draw screens.md §New components)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders a swatch option as a filled square, its label as accessible name and tooltip', () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        modelValue: '#E53935',
        label: 'Colour',
        options: [
          { value: '#000000', label: 'Black', swatch: '#000000' },
          { value: '#E53935', label: 'Red', swatch: '#E53935' },
        ],
      },
    })
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios[1]!.attributes('aria-label')).toBe('Red')
    expect(radios[1]!.attributes('title')).toBe('Red')
    expect(radios[1]!.attributes('aria-checked')).toBe('true')
    expect(radios[1]!.text()).toBe('')
    const fill = radios[1]!.get('.segmented__swatch')
    expect(fill.attributes('style')).toContain('background: #E53935')
    expect(wrapper.get('.segmented__group').classes()).toContain('segmented__group--swatches')
  })

  it('draws the selected ring apart from the outline, so a focused selected swatch shows both', () => {
    // happy-dom resolves no cascade: read the rule. :focus-visible owns `outline`; the selected
    // ring must use another property or the later focus rule replaces it (screens.md SCR-03).
    const rule = /\.segmented__option--swatch\[aria-checked='true'\]\s*\{([^}]*)\}/.exec(
      segmentedSource,
    )
    expect(rule).not.toBeNull()
    expect(rule![1]).not.toMatch(/\boutline\b/)
    expect(rule![1]).toMatch(/box-shadow:\s*inset 0 0 0 2px var\(--color-text\)/)
  })

  it('shows an option’s title as its tooltip, and none for a plain option without one', () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        modelValue: 'brush',
        label: 'Mode',
        options: [
          { value: 'brush', label: 'Brush', title: 'Brush (B)' },
          { value: 'eraser', label: 'Eraser' },
        ],
      },
    })
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios[0]!.attributes('title')).toBe('Brush (B)')
    expect(radios[0]!.text()).toBe('Brush')
    expect(radios[1]!.attributes('title')).toBeUndefined()
    expect(radios[1]!.attributes('aria-label')).toBeUndefined()
  })
})
