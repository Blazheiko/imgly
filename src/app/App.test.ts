import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { appError, createWork, err, ok } from '@/core'
import { openDb } from '@/infra/db'
import { storedWorkFixture } from '@/infra/db/testing'
import { useEditorStore } from '@/features/editor'
import { createFakeRenderer } from '@/features/editor/testing'
import { useGallery } from '@/features/gallery'
import { useNotices } from '@/shared'
import App from './App.vue'

const gallerydb = vi.hoisted(() => ({ openGalleryDb: vi.fn() }))
vi.mock('@/infra/db', async (orig) => ({
  ...(await orig<typeof import('@/infra/db')>()),
  openGalleryDb: gallerydb.openGalleryDb,
}))

beforeEach(() => {
  gallerydb.openGalleryDb.mockReset()
  gallerydb.openGalleryDb.mockResolvedValue(
    err(appError('STORAGE_UNAVAILABLE', { reason: 'refused' })),
  )
})

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

  it('puts Undo and Redo right after "Open image", before the tools (undo-redo AC-14)', () => {
    const names = [...wrapper.element.querySelectorAll('button')].map(
      (b) => b.getAttribute('aria-label') ?? b.textContent?.trim(),
    )
    const open = names.indexOf('Open image')
    expect(open).toBeGreaterThanOrEqual(0)
    expect(names.slice(open, open + 4)).toEqual(['Open image', 'Undo', 'Redo', 'Crop and rotate'])
    expect(names.indexOf('Export')).toBeGreaterThan(names.indexOf('Draw'))
  })

  it('shows "Adjust" in the top bar after "Crop and rotate"', () => {
    const order = [...wrapper.element.querySelectorAll('[data-testid$="-action"]')].map((el) =>
      el.getAttribute('data-testid'),
    )
    expect(order.indexOf('adjust-action')).toBe(order.indexOf('crop-rotate-action') + 1)
  })

  it('mounts only the draw tool and its overlay for "draw", with "Draw" after "Adjust"', async () => {
    editor.openTool('draw')
    await nextTick()
    expect(has('draw-tool')).toBe(true)
    expect(has('draw-overlay')).toBe(true)
    expect(has('adjust-tool')).toBe(false)
    expect(has('crop-frame')).toBe(false)
    const order = [...wrapper.element.querySelectorAll('[data-testid$="-action"]')].map((el) =>
      el.getAttribute('data-testid'),
    )
    expect(order.indexOf('draw-action')).toBe(order.indexOf('adjust-action') + 1)
    const labels = [...wrapper.element.querySelectorAll('button')].map((b) => b.textContent?.trim())
    expect(labels.indexOf('Export')).toBe(labels.indexOf('Draw') + 1)
  })

  it.each([
    ['c', 'KeyC'],
    ['a', 'KeyA'],
  ])('%s while draw is open says to apply or cancel it first (AC-16)', async (k, code) => {
    editor.openTool('draw')
    await nextTick()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, code, bubbles: true }))
    expect(useNotices().items.map((n) => n.text)).toContain('Apply or cancel the open tool first.')
    expect(editor.activeTool).toBe('draw')
  })
})

describe('App Gallery wiring (gallery T17)', () => {
  let wrapper: VueWrapper | undefined
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(async () => {
    const { Blob: NodeBlob } = await vi.importActual<{ Blob: typeof Blob }>('node:buffer')
    vi.stubGlobal('Blob', NodeBlob)
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setRendererFactory(createFakeRenderer().factory)
    URL.createObjectURL = () => 'blob:test/x'
    URL.revokeObjectURL = () => {}
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  const q = (testid: string) => document.querySelector<HTMLElement>(`[data-testid="${testid}"]`)

  async function seededDb() {
    const db = await openDb(`imgly-app-gallery-${Math.random()}`)
    const w = storedWorkFixture({ layer: null, record: { sourceName: 'Cat.png' } })
    await db.put('works', w.record)
    await db.put('originals', w.original)
    gallerydb.openGalleryDb.mockResolvedValue(ok(db))
    return { db, id: w.record.id }
  }

  function openWork() {
    const pixels = { width: 400, height: 300, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ width: 400, height: 300, pixels, hasTransparency: false }, 'w', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
  }

  it('opens the Gallery database at start-up next to the capability gate, loading no Work', async () => {
    const { db } = await seededDb()
    const gate = vi.spyOn(editor, 'runCapabilityGate').mockResolvedValue(undefined as never)
    const reopen = vi.spyOn(editor, 'reopenWork')
    wrapper = mount(App, { attachTo: document.body })
    expect(gate).toHaveBeenCalledTimes(1)
    expect(gallerydb.openGalleryDb).toHaveBeenCalledTimes(1)
    await flushPromises()
    expect(editor.work).toBeNull()
    expect(reopen).not.toHaveBeenCalled()
    db.close()
  })

  it('SCR-01: lists stored Works under the drop zone and shows no Gallery action (AC-05)', async () => {
    const { db } = await seededDb()
    wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await editor.runCapabilityGate(async () => ok(undefined))
    await vi.waitFor(() =>
      expect(q('gallery-start')?.querySelectorAll('.gallery-entry')).toHaveLength(1),
    )

    const empty = q('empty-canvas')!
    const start = q('gallery-start')!
    expect(empty.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(q('gallery-action')).toBeNull()
    expect(editor.work).toBeNull()
    db.close()
  })

  it('AC-12: a refused database leaves the app usable and says why on the start screen', async () => {
    wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await editor.runCapabilityGate(async () => ok(undefined))
    await nextTick()
    expect(editor.galleryAvailable).toBe(false)
    expect(useGallery().unavailableReason).toBe('refused')
    expect(q('gallery-start')?.querySelector('[data-testid="gallery-unavailable"]')).not.toBeNull()
  })

  it('SCR-02: Gallery is the first top-bar action, before "Open image"', async () => {
    wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await editor.runCapabilityGate(async () => ok(undefined))
    openWork()
    await nextTick()
    const names = [...q('editor-top-bar')!.querySelectorAll('button')].map((b) =>
      (b.getAttribute('aria-label') ?? b.textContent)?.trim(),
    )
    expect(names.slice(0, 2)).toEqual(['Gallery', 'Open image'])
    expect(q('gallery-start')).toBeNull()
  })

  it('SCR-03: Gallery opens the modal overlay with everything outside it inert; Esc returns', async () => {
    const { db } = await seededDb()
    wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await editor.runCapabilityGate(async () => ok(undefined))
    openWork()
    await nextTick()

    q('gallery-action')!.click()
    await vi.waitFor(() => expect(q('gallery-overlay')).not.toBeNull())

    const overlay = q('gallery-overlay')!
    expect(overlay.getAttribute('role')).toBe('dialog')
    expect(overlay.closest('[inert]')).toBeNull()
    expect(q('editor-top-bar')!.closest('[inert]')).not.toBeNull()
    expect(q('gallery-action')!.getAttribute('aria-pressed')).toBe('true')
    expect(editor.activePanel).toBe('gallery')

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    )
    await nextTick()
    expect(q('gallery-overlay')).toBeNull()
    expect(q('editor-top-bar')!.closest('[inert]')).toBeNull()
    expect(document.activeElement).toBe(q('gallery-action'))
    db.close()
  })

  it('AC-12: Gallery opens the unavailable note over the Work and Close works', async () => {
    wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await editor.runCapabilityGate(async () => ok(undefined))
    openWork()
    await nextTick()
    q('gallery-action')!.click()
    await vi.waitFor(() => expect(q('gallery-overlay')).not.toBeNull())
    expect(
      q('gallery-overlay')!.querySelector('[data-testid="gallery-unavailable"]'),
    ).not.toBeNull()
    ;[...q('gallery-overlay')!.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Close')!
      .click()
    await nextTick()
    expect(q('gallery-overlay')).toBeNull()
  })
})
