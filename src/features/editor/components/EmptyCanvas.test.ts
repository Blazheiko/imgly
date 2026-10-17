import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { drawsIcon } from '@/shared/ui/testing'
import EmptyCanvas from './EmptyCanvas.vue'
import source from './EmptyCanvas.vue?raw'

const style = source.split('<style')[1] ?? ''

describe('EmptyCanvas drop area (ui-refresh SCR-02, AC-04)', () => {
  it('shows the image icon, a short heading, the Open image button and the drop hint', () => {
    const wrapper = mount(EmptyCanvas, { props: { highlighted: false } })
    const area = wrapper.get('[data-testid="empty-canvas"]')
    const icons = area.findAll(':scope > svg')
    expect(icons).toHaveLength(1)
    expect(icons[0]!.attributes('aria-hidden')).toBe('true')
    expect(area.get('p.empty-canvas__heading').text()).toBe('Open an image to start')
    expect(area.find('h1, h2, h3').exists()).toBe(false)
    const open = area.get('button')
    expect(open.text()).toBe('Open image')
    expect(open.classes()).toEqual(
      expect.arrayContaining(['base-button--primary', 'base-button--lg']),
    )
    expect(drawsIcon(open.element, 'image-plus')).toBe(true)
    expect(area.text()).toContain('or drop an image anywhere in this window')
  })

  it('adds no keyboard stop: only its button can be focused', () => {
    const wrapper = mount(EmptyCanvas, { props: { highlighted: false } })
    expect(wrapper.findAll('[tabindex]')).toHaveLength(0)
    expect(wrapper.findAll('button, a, input')).toHaveLength(1)
  })

  it('opens only from its button, never from the area around it', async () => {
    const wrapper = mount(EmptyCanvas, { props: { highlighted: false } })
    await wrapper.get('[data-testid="empty-canvas"]').trigger('click')
    await wrapper.get('.empty-canvas__heading').trigger('click')
    expect(wrapper.emitted('open')).toBeUndefined()
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('is highlighted while a file is dragged over the window', async () => {
    const wrapper = mount(EmptyCanvas, { props: { highlighted: false } })
    const area = () => wrapper.get('[data-testid="empty-canvas"]')
    expect(area().classes()).not.toContain('empty-canvas--highlighted')
    await wrapper.setProps({ highlighted: true })
    expect(area().classes()).toContain('empty-canvas--highlighted')
  })

  it('draws the dashed card and its highlight from tokens, colour only (AC-14)', () => {
    expect(style).toMatch(/\.empty-canvas\s*\{[^}]*2px dashed var\(--color-border-strong\)/)
    expect(style).toMatch(
      /\.empty-canvas--highlighted\s*\{[^}]*var\(--color-accent-text\)[^}]*var\(--color-accent-subtle\)/,
    )
    expect(style).not.toMatch(/transform/)
  })
})
