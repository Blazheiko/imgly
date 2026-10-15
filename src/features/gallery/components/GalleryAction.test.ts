import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createWork } from '@/core'
import { useEditorStore } from '@/features/editor'
import { createFakeAutosave } from '@/features/editor/testing'
import { useNotices } from '@/shared'
import { useGallery } from '../store'
import * as m from '../messages'
import GalleryAction from './GalleryAction.vue'

// Pinned API: GalleryAction takes no props, renders one BaseButton
// `[data-testid="gallery-action"]` labelled "Gallery", and reads useEditorStore()/useGallery().
// The unavailable hint is a visually hidden element referenced by `aria-describedby`, as AdjustAction.
describe('GalleryAction (SCR-02, AC-03, AC-15)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>
  let gallery: ReturnType<typeof useGallery>

  beforeEach(() => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    gallery = useGallery()
    const pixels = { width: 800, height: 600, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ width: 800, height: 600, pixels, hasTransparency: false }, 'w-1', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    wrapper = mount(GalleryAction, { attachTo: document.body })
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  const button = () => wrapper.get('[data-testid="gallery-action"]')

  it('is a secondary "Gallery" button, not pressed and enabled by default', () => {
    expect(button().element.tagName).toBe('BUTTON')
    expect(button().text()).toBe(m.galleryButton())
    expect(button().attributes('aria-pressed')).toBe('false')
    expect(button().attributes('disabled')).toBeUndefined()
    expect(button().attributes('aria-disabled')).toBeUndefined()
  })

  it('opens the overlay through the gallery store and shows pressed (AC-03)', async () => {
    await button().trigger('click')
    await nextTick()
    expect(gallery.overlayOpen).toBe(true)
    expect(editor.activePanel).toBe('gallery')
    expect(button().attributes('aria-pressed')).toBe('true')
  })

  it('stays available when the Gallery is unavailable (SCR-02 unavailable)', async () => {
    const autosave = createFakeAutosave()
    editor.setAutosave(autosave.fake)
    autosave.available(false)
    await nextTick()
    expect(button().attributes('disabled')).toBeUndefined()
    expect(button().attributes('aria-disabled')).toBeUndefined()
    await button().trigger('click')
    expect(gallery.overlayOpen).toBe(true)
  })

  it('is aria-disabled with the hint as description while a tool is open, and toasts it', async () => {
    editor.openTool('adjust')
    await nextTick()

    expect(button().attributes('aria-disabled')).toBe('true')
    expect(button().attributes('disabled')).toBeUndefined()
    const describedBy = button().attributes('aria-describedby')!
    expect(document.getElementById(describedBy)?.textContent).toBe(m.hintToolOpen())

    await button().trigger('click')
    expect(gallery.overlayOpen).toBe(false)
    expect(editor.activePanel).toBeNull()
    expect(useNotices().items.map((n) => [n.kind, n.text])).toEqual([
      ['info', 'Apply or cancel the open tool first.'],
    ])
  })

  it('is truly disabled while an export runs', async () => {
    editor.phase = 'exporting'
    await nextTick()
    expect(button().attributes('disabled')).toBeDefined()
    await button().trigger('click')
    expect(gallery.overlayOpen).toBe(false)
  })
})
