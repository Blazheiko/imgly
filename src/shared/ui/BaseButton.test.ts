import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from './BaseButton.vue'
import Spinner from './Spinner.vue'
import source from './BaseButton.vue?raw'

const style = source.split('<style')[1] ?? ''

afterEach(() => vi.restoreAllMocks())

describe('BaseButton (ui-refresh ADR-0003)', () => {
  it('renders an existing label-only call as before: same text, md, no icon', () => {
    const button = mount(BaseButton, { slots: { default: 'Open image' } }).get('button')
    expect(button.text()).toBe('Open image')
    expect(button.find('svg').exists()).toBe(false)
    expect(button.classes()).toEqual(
      expect.arrayContaining(['base-button--secondary', 'base-button--md']),
    )
  })

  it('draws its icon before the label, hidden from assistive technology (AC-03)', () => {
    const button = mount(BaseButton, {
      props: { icon: 'download', variant: 'primary' },
      slots: { default: 'Export' },
    }).get('button')
    const first = button.element.firstElementChild!
    expect(first.tagName.toLowerCase()).toBe('svg')
    expect(first.getAttribute('aria-hidden')).toBe('true')
    expect(button.text()).toBe('Export')
    expect(button.classes()).not.toContain('base-button--icon-only')
  })

  it('swaps the icon for a spinner while busy, still one symbol', () => {
    const wrapper = mount(BaseButton, {
      props: { icon: 'download', busy: true },
      slots: { default: 'Exporting…' },
    })
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.findComponent(Spinner).exists()).toBe(true)
    expect(wrapper.find('.base-button__icon').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('Exporting…')
  })

  it('shows a spinner in the icon slot when busy without an icon', () => {
    const wrapper = mount(BaseButton, { props: { busy: true }, slots: { default: 'Reloading…' } })
    expect(wrapper.findComponent(Spinner).exists()).toBe(true)
  })

  it.each(['sm', 'md', 'lg'] as const)('takes the %s size', (size) => {
    expect(mount(BaseButton, { props: { size } }).classes()).toContain(`base-button--${size}`)
  })

  it('uses the larger icon in lg (screens.md §Buttons)', () => {
    const lg = mount(BaseButton, { props: { icon: 'image-plus', size: 'lg' } })
    const md = mount(BaseButton, { props: { icon: 'image-plus' } })
    expect(lg.find('svg').classes()).toContain('icon--md')
    expect(md.find('svg').classes()).toContain('icon--sm')
  })

  it('has a danger variant (AC-12)', () => {
    const danger = mount(BaseButton, { props: { variant: 'danger', icon: 'trash-2' } })
    expect(danger.classes()).toContain('base-button--danger')
    expect(style).toMatch(/\.base-button--danger\s*\{[^}]*--color-danger-solid\b/)
  })

  it('is a square icon-only button when it has an icon and no label', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const button = mount(BaseButton, {
      props: { icon: 'undo-2' },
      attrs: { 'aria-label': 'Undo', title: 'Undo (Ctrl+Z)' },
    }).get('button')
    expect(button.classes()).toContain('base-button--icon-only')
    expect(button.attributes('aria-label')).toBe('Undo')
    expect(warn).not.toHaveBeenCalled()
  })

  it('flags an icon-only button that has no accessible name (AC-03)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount(BaseButton, { props: { icon: 'undo-2' } })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('aria-label'))
  })

  it('shows disabled and unavailable in one neutral look, never faded (AC-13)', () => {
    expect(style).not.toMatch(/opacity:\s*0\.45/)
    expect(style).toMatch(/\[aria-disabled='true'\]/)
    const neutral = /:disabled,\s*\n?\s*\.base-button\[aria-disabled='true'\]\s*\{([^}]*)\}/.exec(
      style,
    )
    expect(neutral?.[1]).toContain('var(--color-surface-sunken)')
    expect(neutral?.[1]).toContain('var(--color-text-muted)')
  })

  it('animates only colours, for --duration-fast (AC-14)', () => {
    expect(style).toContain('var(--duration-fast)')
    expect(style).not.toMatch(/\b\d+ms\b/)
    expect(style).not.toMatch(/transform/)
  })

  it('takes the gradient on primary (screens.md §Buttons)', () => {
    expect(style).toMatch(/\.base-button--primary\s*\{[^}]*var\(--color-accent-gradient\)/)
  })
})

describe('BaseButton motion scope', () => {
  it('animates only while pointed at or pressed, so availability changes repaint at once', () => {
    const base = /\.base-button\s*\{([^}]*)\}/.exec(style)?.[1] ?? ''
    expect(base).not.toContain('transition')
    expect(style).toMatch(/\.base-button:hover,\s*\.base-button:active\s*\{[^}]*transition:/)
  })
})
