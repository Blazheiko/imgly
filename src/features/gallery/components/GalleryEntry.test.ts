import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { drawsIcon } from '@/shared/ui/testing'
import type { GalleryEntry as Entry } from '../store'
import * as m from '../messages'
import GalleryEntry from './GalleryEntry.vue'
import source from './GalleryEntry.vue?raw'

const style = source.split('<style')[1] ?? ''

const entry = (patch: Partial<Entry> = {}): Entry => ({
  id: 'w-1',
  name: 'Beach.jpg',
  status: 'touched',
  label: 'Just now',
  thumbnailUrl: 'blob:test/1',
  ...patch,
})

/** The CSS rule bodies whose selector list mentions `selector`. */
function rules(selector: string): string {
  return [...style.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, sel]) => sel!.includes(selector))
    .map(([, , body]) => body)
    .join('\n')
}

describe('GalleryEntry — the Work card (ui-refresh SCR-02, AC-06 to AC-09)', () => {
  it('keeps the choosing button and the name a screen reader announces', () => {
    const wrapper = mount(GalleryEntry, { props: { entry: entry() } })
    const choose = wrapper.get('[data-entry-id="w-1"]')
    expect(choose.element.tagName).toBe('BUTTON')
    expect(choose.attributes('aria-label')).toBe('Beach.jpg, Just now')
    expect(wrapper.get('.gallery-entry__name').attributes('title')).toBe('Beach.jpg')
  })

  it('shows the whole thumbnail over a blurred copy of the same image, one img only', () => {
    const wrapper = mount(GalleryEntry, { props: { entry: entry() } })
    const imgs = wrapper.findAll('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0]!.attributes('src')).toBe('blob:test/1')
    const thumb = wrapper.get('.gallery-entry__thumb')
    expect(thumb.attributes('style')).toContain('blob:test/1')
    expect(rules('.gallery-entry__thumb img')).toContain('object-fit: contain')
    expect(rules('.gallery-entry__thumb::before')).toMatch(/blur\(/)
    expect(rules('.gallery-entry__thumb')).toContain('aspect-ratio: 4 / 3')
  })

  it('puts an icon-only Delete after the choosing button, named and titled as before', () => {
    const wrapper = mount(GalleryEntry, { props: { entry: entry() } })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    const del = buttons[1]!
    const name = m.deleteButtonName('Beach.jpg')
    expect(del.attributes('data-delete-id')).toBe('w-1')
    expect(del.attributes('aria-label')).toBe(name)
    expect(del.attributes('title')).toBe(name)
    expect(drawsIcon(del.element, 'trash-2')).toBe(true)
    expect(del.classes()).toEqual(expect.arrayContaining(['base-button--ghost', 'base-button--sm']))
  })

  it('hides Delete only by opacity, shown on hover, focus within and touch (AC-06, AC-07)', () => {
    expect(rules('.gallery-entry__delete')).toContain('opacity: 0')
    expect(style).not.toMatch(/display:\s*none|visibility:\s*hidden/)
    expect(style).toMatch(/\.gallery-entry:hover \.gallery-entry__delete/)
    expect(style).toMatch(/\.gallery-entry:focus-within \.gallery-entry__delete/)
    expect(style).toMatch(
      /@media \(hover: none\)\s*\{[^@]*\.gallery-entry__delete\s*\{[^}]*opacity: 1/,
    )
  })

  it('lifts on hover by the lift token, for --duration-base (AC-06, AC-14)', () => {
    expect(rules('.gallery-entry:hover')).toContain('translateY(var(--lift-card))')
    expect(style).toContain('var(--duration-base)')
    expect(style).not.toMatch(/translateY\(-?\d/)
  })

  it('shows a Damaged Work with the image-off symbol, no thumbnail, and its border (AC-09)', () => {
    const wrapper = mount(GalleryEntry, {
      props: { entry: entry({ status: 'damaged', thumbnailUrl: null }) },
    })
    const thumb = wrapper.get('.gallery-entry__thumb')
    expect(drawsIcon(thumb.element, 'image-off')).toBe(true)
    expect(thumb.text()).toContain(m.damagedThumbnail())
    expect(wrapper.find('img').exists()).toBe(false)
    expect(thumb.attributes('style') ?? '').not.toContain('url(')
    expect(rules('.gallery-entry--damaged')).toContain('var(--color-warning)')
  })

  it('shows "Open" as a badge; the open Work\'s Delete stays focusable but unavailable (AC-08)', async () => {
    const wrapper = mount(GalleryEntry, { props: { entry: entry({ status: 'open' }) } })
    expect(wrapper.get('.gallery-entry__status').classes()).toContain(
      'gallery-entry__status--badge',
    )
    expect(wrapper.get('[data-entry-id]').attributes('aria-label')).toBe(
      `Beach.jpg, ${m.statusOpen()}`,
    )
    const del = wrapper.get('[data-delete-id]')
    expect(del.attributes('aria-disabled')).toBe('true')
    expect(del.attributes('disabled')).toBeUndefined()
    await del.trigger('click')
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })
})
