import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import type { IDBPDatabase } from 'idb'
import { appError, err, ok } from '@/core'
import { loadWork, openDb, type ImglyDb } from '@/infra/db'
import { storedWorkFixture } from '@/infra/db/testing'
import { EditorView, useEditorStore } from '@/features/editor'
import { createFakeAutosave, createFakeRenderer } from '@/features/editor/testing'
import { useNotices } from '@/shared'
import { useGallery } from '../store'
import * as m from '../messages'
import GalleryAction from './GalleryAction.vue'
import GalleryOverlay from './GalleryOverlay.vue'

type Db = IDBPDatabase<ImglyDb>

const NOW = 1_700_000_000_000
const MINUTE = 60_000
let dbCounter = 0

async function seed(db: Db, sourceName: string, touchedAt: number): Promise<string> {
  const w = storedWorkFixture({ layer: null, record: { sourceName, touchedAt } })
  await db.put('works', w.record)
  await db.put('originals', w.original)
  return w.record.id
}

async function seedDamaged(db: Db, sourceName: string, touchedAt: number): Promise<string> {
  const w = storedWorkFixture({ layer: null, record: { sourceName, touchedAt } })
  // Both the list check (bad thumbnail) and the full read (no Original) fail.
  await db.put('works', { ...w.record, thumbnail: new Blob(['x'], { type: 'text/plain' }) })
  return w.record.id
}

// Pinned API: GalleryOverlay takes no props and renders nothing unless `useGallery().overlayOpen`.
// Open, its root is `[data-testid="gallery-overlay"]` with role="dialog", aria-modal="true" and
// aria-labelledby the "Gallery" heading; inside is a GalleryList (showClose, no Open image). It
// moves focus in on open, traps Tab, closes on Esc, and returns focus to
// `[data-testid="gallery-action"]` (GalleryAction). Opening it sets editor.activePanel 'gallery'.
// Spinner: `.spinner` labelled `m.reopeningLabel(name)` while `gallery.reopening` is set.
describe('GalleryOverlay (SCR-03)', () => {
  let db: Db
  let editor: ReturnType<typeof useEditorStore>
  let gallery: ReturnType<typeof useGallery>
  let autosave: ReturnType<typeof createFakeAutosave>
  let wrapper: VueWrapper | undefined

  const Host = defineComponent({
    render: () => h('div', [h(GalleryAction), h('div', { id: 'outside' }), h(GalleryOverlay)]),
  })

  beforeEach(async () => {
    const { Blob: NodeBlob } = await vi.importActual<{ Blob: typeof Blob }>('node:buffer')
    vi.stubGlobal('Blob', NodeBlob)
    setActivePinia(createPinia())
    db = await openDb(`imgly-gallery-overlay-${++dbCounter}`)
    autosave = createFakeAutosave()
    editor = useEditorStore()
    editor.setAutosave(autosave.fake)
    editor.setReopenSource({
      loadWork: (id) => loadWork(db, id),
      decodePng: async () => ok({ width: 4, height: 3, close: vi.fn() } as unknown as ImageBitmap),
    })
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(true) } })
    URL.createObjectURL = () => 'blob:test/x'
    URL.revokeObjectURL = () => {}
    gallery = useGallery()
    gallery.connect(ok(db))
    gallery.setClock(() => NOW)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    db.close()
  })

  /** A stored Work A is open (reopened), B is also stored. */
  async function withOpenWork() {
    const a = await seed(db, 'A.png', NOW - MINUTE)
    const b = await seed(db, 'B.png', NOW - 2 * MINUTE)
    await editor.reopenWork(a)
    wrapper = mount(Host, { attachTo: document.body })
    return { a, b }
  }

  const overlay = () => document.querySelector<HTMLElement>('[data-testid="gallery-overlay"]')
  const actionButton = () => document.querySelector<HTMLElement>('[data-testid="gallery-action"]')!
  const press = (target: Element | Document, init: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
    target.dispatchEvent(event)
    return event
  }
  async function openOverlay() {
    actionButton().click()
    await vi.waitFor(() => expect(overlay()).not.toBeNull())
    await nextTick()
  }
  const closeButton = () =>
    [...overlay()!.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Close')!
  const entryButton = (name: string) =>
    overlay()!.querySelector<HTMLElement>(`.gallery-entry [aria-label^="${name},"]`)!

  it('renders nothing while closed', async () => {
    await withOpenWork()
    expect(overlay()).toBeNull()
  })

  it('is a modal dialog labelled by its Gallery heading, with Close (AC-03)', async () => {
    await withOpenWork()
    await openOverlay()
    const el = overlay()!
    expect(el.getAttribute('role')).toBe('dialog')
    expect(el.getAttribute('aria-modal')).toBe('true')
    const label = document.getElementById(el.getAttribute('aria-labelledby')!)
    expect(label?.textContent?.trim()).toBe('Gallery')
    expect(el.querySelectorAll('.gallery-entry')).toHaveLength(2)
    expect(el.textContent).toContain(m.countLabel(2))
    expect(closeButton()).toBeDefined()
    expect(el.querySelector('[data-testid="gallery-open-image"]')).toBeNull()
  })

  it('sets activePanel to gallery while it shows and clears it on close', async () => {
    await withOpenWork()
    await openOverlay()
    expect(editor.activePanel).toBe('gallery')
    closeButton().click()
    await nextTick()
    expect(editor.activePanel).toBeNull()
    expect(overlay()).toBeNull()
  })

  it('moves focus to the first entry on open, or to Close when there is none', async () => {
    await withOpenWork()
    await openOverlay()
    expect(document.activeElement).toBe(overlay()!.querySelector('.gallery-entry button'))
    gallery.close()
    await nextTick()

    await db.clear('works')
    await openOverlay()
    expect(document.activeElement).toBe(closeButton())
  })

  it('cycles Tab and Shift+Tab inside the overlay', async () => {
    await withOpenWork()
    await openOverlay()
    const focusables = [...overlay()!.querySelectorAll<HTMLElement>('button:not([disabled])')]
    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!
    expect(first).toBe(closeButton())

    last.focus()
    const forward = press(last, { key: 'Tab', code: 'Tab' })
    expect(forward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    const backward = press(first, { key: 'Tab', code: 'Tab', shiftKey: true })
    expect(backward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
  })

  it('Esc closes it, returns focus to Gallery and leaves the Work, revision and View unchanged', async () => {
    const { a } = await withOpenWork()
    const work = editor.work
    const revision = editor.work!.revision
    const view = { ...editor.view }
    await openOverlay()

    press(document.body, { key: 'Escape', code: 'Escape' })
    await nextTick()

    expect(overlay()).toBeNull()
    expect(document.activeElement).toBe(actionButton())
    expect(editor.work).toBe(work)
    expect(editor.work!.id).toBe(a)
    expect(editor.work!.revision).toBe(revision)
    expect({ ...editor.view }).toEqual(view)
    expect(editor.activePanel).toBeNull()
  })

  it('Close returns focus to Gallery with the Work unchanged', async () => {
    await withOpenWork()
    const work = editor.work
    await openOverlay()
    closeButton().click()
    await nextTick()
    expect(document.activeElement).toBe(actionButton())
    expect(editor.work).toBe(work)
  })

  it('shows the Opening spinner over the list and makes the entries inert while reopening', async () => {
    const { b } = await withOpenWork()
    await openOverlay()
    gallery.reopening = b
    await nextTick()

    expect(overlay()!.querySelector('.spinner')?.textContent).toContain(m.reopeningLabel('B.png'))
    expect(entryButton('B.png').closest('[inert]')).not.toBeNull()
    expect(overlay()).not.toBeNull()

    gallery.reopening = null
    await nextTick()
    expect(overlay()!.querySelector('.spinner')).toBeNull()
    expect(entryButton('B.png').closest('[inert]')).toBeNull()
  })

  it('choosing the Open entry just closes: nothing is read or replaced', async () => {
    await withOpenWork()
    const work = editor.work
    const reopen = vi.spyOn(editor, 'reopenWork')
    await openOverlay()
    entryButton('A.png').click()
    await vi.waitFor(() => expect(overlay()).toBeNull())
    expect(reopen).not.toHaveBeenCalled()
    expect(editor.work).toBe(work)
  })

  it('choosing a readable Work replaces the open one and closes it (AC-04)', async () => {
    const { b } = await withOpenWork()
    await openOverlay()
    entryButton('B.png').click()
    await vi.waitFor(() => expect(editor.work?.id).toBe(b))
    await vi.waitFor(() => expect(overlay()).toBeNull())
    expect(editor.activePanel).toBeNull()
  })

  it('a damaged Work keeps the overlay open, marks it, and leaves the open Work as it was', async () => {
    const a = await seed(db, 'A.png', NOW - MINUTE)
    await seedDamaged(db, 'Bad.png', NOW - 2 * MINUTE)
    await editor.reopenWork(a)
    wrapper = mount(Host, { attachTo: document.body })
    const work = editor.work
    await openOverlay()

    entryButton('Bad.png').click()

    await vi.waitFor(() =>
      expect(overlay()!.querySelector('.gallery-entry--damaged')).not.toBeNull(),
    )
    await vi.waitFor(() => expect(useNotices().items.map((n) => n.kind)).toContain('failure'))
    expect(overlay()).not.toBeNull()
    expect(editor.work).toBe(work)
  })

  it.each([
    ['exporting', m.hintChooseWhileExporting()],
    ['confirming', m.hintChooseWhileConfirming()],
  ] as const)(
    'choosing while %s shows the hint and changes nothing (AC-15)',
    async (phase, hint) => {
      await withOpenWork()
      const work = editor.work
      await openOverlay()
      editor.phase = phase

      entryButton('B.png').click()

      await vi.waitFor(() =>
        expect(useNotices().items.map((n) => [n.kind, n.text])).toEqual([['info', hint]]),
      )
      expect(editor.work).toBe(work)
      expect(overlay()).not.toBeNull()
    },
  )

  it('shows the unavailable note with a working Close when the Gallery is unavailable (AC-12)', async () => {
    autosave.available(false)
    gallery.connect(err(appError('STORAGE_UNAVAILABLE', { reason: 'refused' })))
    editor.work = null
    wrapper = mount(Host, { attachTo: document.body })
    await gallery.open()
    await nextTick()
    expect(overlay()!.querySelector('[data-testid="gallery-unavailable"]')).not.toBeNull()
    closeButton().click()
    await nextTick()
    expect(overlay()).toBeNull()
  })

  describe('a reopen that asks (AC-17)', () => {
    /** A is open with a failed save (Unsaved edits nothing holds), so choosing B asks. */
    async function chooseAsking() {
      const { a, b } = await withOpenWork()
      editor.applyEdit()
      expect(editor.hasUnsavedEdits).toBe(true)
      await openOverlay()
      await gallery.choose(b)
      expect(editor.phase).toBe('confirming')
      return { a, b }
    }

    it('Replace closes the overlay and clears the gallery panel (S1-5)', async () => {
      const { b } = await chooseAsking()
      editor.confirmReplace()
      await nextTick()
      expect(editor.work?.id).toBe(b)
      expect(gallery.overlayOpen).toBe(false)
      expect(editor.activePanel).not.toBe('gallery')
      expect(overlay()).toBeNull()
    })

    it('Cancel keeps the overlay open (S1-5)', async () => {
      const { a } = await chooseAsking()
      editor.cancelReplace()
      await nextTick()
      expect(editor.work?.id).toBe(a)
      expect(gallery.overlayOpen).toBe(true)
      expect(editor.activePanel).toBe('gallery')
      expect(overlay()).not.toBeNull()
    })
  })

  describe('Esc in a dialog over the overlay cancels that dialog only (S1-6)', () => {
    it('SCR-04: Esc on the delete dialog cancels the delete and the overlay stays', async () => {
      await withOpenWork()
      await openOverlay()
      overlay()!
        .querySelector<HTMLElement>('[aria-label="' + m.deleteButtonName('B.png') + '"]')!
        .click()
      await vi.waitFor(() => expect(gallery.pendingDelete).not.toBeNull())
      const dialog = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>('[role="alertdialog"]')
        expect(el).not.toBeNull()
        return el!
      })

      press(dialog, { key: 'Escape', code: 'Escape' })
      await nextTick()

      expect(gallery.pendingDelete).toBeNull()
      expect(document.querySelector('[role="alertdialog"]')).toBeNull()
      expect(gallery.overlayOpen).toBe(true)
      expect(overlay()).not.toBeNull()
    })

    it('SCR-05: Esc on the replace dialog cancels the replace and the overlay stays', async () => {
      const { a, b } = await withOpenWork()
      wrapper?.unmount()
      const renderer = createFakeRenderer()
      editor.setRendererFactory(renderer.factory)
      editor.setCanvasSize(1000, 1000)
      await editor.runCapabilityGate(async () => ok(undefined))
      wrapper = mount(EditorView, {
        attachTo: document.body,
        slots: { 'top-bar-leading-actions': GalleryAction, overlay: GalleryOverlay },
      })
      editor.applyEdit()
      await gallery.open()
      await nextTick()
      await gallery.choose(b)
      await nextTick()
      const dialog = await vi.waitFor(() => {
        const el = document.querySelector<HTMLElement>('[role="alertdialog"]')
        expect(el).not.toBeNull()
        return el!
      })
      expect(editor.phase).toBe('confirming')

      press(dialog, { key: 'Escape', code: 'Escape' })
      await nextTick()

      expect(editor.phase).toBe('idle')
      expect(editor.work?.id).toBe(a)
      expect(document.querySelector('[role="alertdialog"]')).toBeNull()
      expect(gallery.overlayOpen).toBe(true)
      expect(overlay()).not.toBeNull()
    })
  })
})
