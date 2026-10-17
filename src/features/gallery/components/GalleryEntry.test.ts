import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { compileStyle } from 'vue/compiler-sfc'
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

/** [ids, classes + attributes + pseudo-classes, elements] of one compound selector. */
function specificity(selector: string): [number, number, number] {
  const ids = selector.match(/#[\w-]+/g)?.length ?? 0
  const classes = selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g)?.length ?? 0
  const elements = selector.match(/(^|[\s>+~])[a-z][\w-]*/gi)?.length ?? 0
  return [ids, classes, elements]
}

/** The compiled scoped selectors setting `opacity` on Delete, outside and inside `@media (hover: none)`. */
function deleteOpacitySelectors(): { base: string; touch: string } {
  const css = compileStyle({
    source: style.slice(style.indexOf('>') + 1, style.lastIndexOf('</style>')),
    filename: 'GalleryEntry.vue',
    id: 'data-v-test',
    scoped: true,
  }).code.replace(/\/\*[\s\S]*?\*\//g, '')
  const media = css.indexOf('@media (hover: none)')
  const find = (text: string, opacity: string) =>
    [...text.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, sel, body]) => sel!.includes('gallery-entry__delete') && body!.includes(opacity))
      .map(([, sel]) => sel!.trim())[0] ?? ''
  return {
    base: find(css.slice(0, media), 'opacity: 0'),
    touch: find(css.slice(css.indexOf('{', media) + 1), 'opacity: 1'),
  }
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
    expect(del.classes()).toEqual(
      expect.arrayContaining(['base-button--ghost', 'base-button--sm', 'base-button--icon-only']),
    )
    // The name comes from aria-label alone, not a hidden label BaseButton would take as text.
    expect(del.text()).toBe('')
    expect(rules('.gallery-entry__delete')).not.toMatch(/min-width|padding/)
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

  it('lets the touch rule win the cascade over the hidden base rule (AC-06 touch)', () => {
    const { base, touch } = deleteOpacitySelectors()
    expect(base).not.toBe('')
    expect(touch).not.toBe('')
    // Equal specificity is enough: the media block comes later in the source.
    const [t, b] = [specificity(touch), specificity(base)]
    const firstDiff = t.findIndex((n, i) => n !== b[i])
    expect(firstDiff === -1 || t[firstDiff]! > b[firstDiff]!, `${touch} vs ${base}`).toBe(true)
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
