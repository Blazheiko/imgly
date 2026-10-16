import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { appError, createWork, err, ok } from '@/core'
import { openDb } from '@/infra/db'
import { storedWorkFixture } from '@/infra/db/testing'
import { useEditorStore, type ReloadOutcome } from '@/features/editor'
import { createFakeRenderer } from '@/features/editor/testing'
import { useGallery } from '@/features/gallery'
import { usePwaInstallUpdate } from '@/features/pwa-install-update'
import { fakeClient, fakeDocument, fakeInstallPrompt } from '@/features/pwa-install-update/testing'
import { markReopen, takeReopen } from '@/infra/platform'
import { useNotices } from '@/shared'
import App from './App.vue'

const gallerydb = vi.hoisted(() => ({ openGalleryDb: vi.fn() }))
vi.mock('@/infra/db', async (orig) => ({
  ...(await orig<typeof import('@/infra/db')>()),
  openGalleryDb: gallerydb.openGalleryDb,
}))

const picked = vi.hoisted(() => ({ pickImageFile: vi.fn() }))
vi.mock('@/infra/platform', async (orig) => ({
  ...(await orig<typeof import('@/infra/platform')>()),
  pickImageFile: picked.pickImageFile,
}))

beforeEach(() => {
  picked.pickImageFile.mockReset()
  picked.pickImageFile.mockResolvedValue(null)
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

  describe("the damaged notice's Delete… (gallery T30, S2-4)", () => {
    const dialog = () => document.querySelector('[role="alertdialog"]')
    const damagedAction = (gallery: ReturnType<typeof useGallery>) => {
      const notice = useNotices().items.find((n) => n.action)
      expect(notice).toBeDefined()
      void gallery
      return notice!.action!
    }

    async function withOpenWorkAndOtherEntry() {
      const { db, id } = await seededDb()
      wrapper = mount(App, { attachTo: document.body })
      await flushPromises()
      await editor.runCapabilityGate(async () => ok(undefined))
      openWork()
      await nextTick()
      const gallery = useGallery()
      await gallery.refresh()
      expect(gallery.overlayOpen).toBe(false)
      expect(q('gallery-list')).toBeNull()
      return { db, id, gallery }
    }

    it('AC-08: with the overlay closed, running the action shows the delete dialog at once', async () => {
      const { db, id, gallery } = await withOpenWorkAndOtherEntry()
      vi.spyOn(editor, 'reopenWork').mockResolvedValue({
        kind: 'damaged',
        error: appError('WORK_DAMAGED'),
      })
      await gallery.choose(id)
      damagedAction(gallery).run()
      await nextTick()
      expect(gallery.pendingDelete?.id).toBe(id)
      expect(dialog()).not.toBeNull()
      expect(dialog()!.textContent).toContain('Cat')
      db.close()
    })

    it('R3-5: Cancel on the standby dialog opened from the notice puts focus on the Gallery button, not the body', async () => {
      const { db, id, gallery } = await withOpenWorkAndOtherEntry()
      vi.spyOn(editor, 'reopenWork').mockResolvedValue({
        kind: 'damaged',
        error: appError('WORK_DAMAGED'),
      })
      await gallery.choose(id)
      // The toast's button holds focus when the action runs, then is dismissed in the same tick.
      const toastButton = document.createElement('button')
      document.body.appendChild(toastButton)
      toastButton.focus()
      damagedAction(gallery).run()
      toastButton.remove()
      await nextTick()
      expect(dialog()).not.toBeNull()

      const cancel = dialog()!.querySelector<HTMLElement>('[data-initial-focus]')!
      cancel.click()
      await nextTick()

      expect(dialog()).toBeNull()
      expect(document.activeElement).not.toBe(document.body)
      expect(document.activeElement).toBe(q('gallery-action'))
      db.close()
    })

    const press = (key: string, init: KeyboardEventInit = {}) =>
      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
      )

    it('R2-4: Esc in the delete dialog over the Editor cancels only the dialog; the open tool keeps its Draft', async () => {
      const { db, id, gallery } = await withOpenWorkAndOtherEntry()
      editor.openTool('crop-rotate')
      await nextTick()
      gallery.requestDelete(id)
      await nextTick()
      expect(dialog()).not.toBeNull()
      expect(dialog()!.contains(document.activeElement)).toBe(true)

      press('Escape')
      await nextTick()

      expect(gallery.pendingDelete).toBeNull()
      expect(editor.activeTool).toBe('crop-rotate')
      db.close()
    })

    it('R2-4: under the delete dialog over the Editor, tool, undo, open, save and zoom keys do nothing', async () => {
      const { db, id, gallery } = await withOpenWorkAndOtherEntry()
      gallery.requestDelete(id)
      await nextTick()
      const undo = vi.spyOn(editor, 'undo')
      const zoom = vi.spyOn(editor, 'stepZoom')
      const view = { ...editor.view }

      for (const key of ['c', 'a', 'd', '+', '-']) press(key)
      press('z', { ctrlKey: true })
      press('y', { ctrlKey: true })
      press('s', { ctrlKey: true })
      await nextTick()

      expect(editor.activeTool).toBeNull()
      expect(editor.activePanel).toBeNull()
      expect(undo).not.toHaveBeenCalled()
      expect(zoom).not.toHaveBeenCalled()
      expect(editor.view).toEqual(view)
      expect(gallery.pendingDelete?.id).toBe(id)
      db.close()
    })

    it('AC-06: under the standby delete dialog, Ctrl+O opens no file picker and a drop opens no file', async () => {
      const { db, id, gallery } = await withOpenWorkAndOtherEntry()
      gallery.requestDelete(id)
      await nextTick()
      const openFile = vi.spyOn(editor, 'openFile')
      const openDrop = vi.spyOn(editor, 'openDrop')

      const ctrlO = new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true })
      document.body.dispatchEvent(ctrlO)
      press('o', { metaKey: true })
      await flushPromises()
      expect(picked.pickImageFile).not.toHaveBeenCalled()

      const file = new File(['x'], 'a.png', { type: 'image/png' })
      const drop = new Event('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(drop, 'dataTransfer', {
        value: {
          items: [
            {
              kind: 'file',
              getAsFile: () => file,
              webkitGetAsEntry: () => ({ isDirectory: false }),
            },
          ],
          files: [file],
        },
      })
      window.dispatchEvent(drop)
      await flushPromises()
      expect(drop.defaultPrevented).toBe(true)
      expect(openDrop).not.toHaveBeenCalled()
      expect(openFile).not.toHaveBeenCalled()
      expect(gallery.pendingDelete?.id).toBe(id)
      db.close()
    })

    it('R2-4: the Editor takes keys again once the delete dialog closes', async () => {
      const { db, id, gallery } = await withOpenWorkAndOtherEntry()
      gallery.requestDelete(id)
      await nextTick()
      gallery.cancelDelete()
      await nextTick()

      press('c')
      await nextTick()

      expect(editor.activeTool).toBe('crop-rotate')
      db.close()
    })

    it('AC-08: a delete requested with the overlay closed does not surface when the overlay opens later', async () => {
      const { db, id, gallery } = await withOpenWorkAndOtherEntry()
      gallery.requestDelete(id)
      await nextTick()
      gallery.close()
      expect(gallery.pendingDelete).toBeNull()
      await nextTick()
      expect(dialog()).toBeNull()

      q('gallery-action')!.click()
      await vi.waitFor(() => expect(q('gallery-overlay')).not.toBeNull())
      await flushPromises()
      expect(gallery.pendingDelete).toBeNull()
      expect(document.body.textContent).not.toContain('Delete “Cat')
      db.close()
    })
  })
})

describe('App install and update wiring (pwa-install-update T12)', () => {
  let wrapper: VueWrapper | undefined
  let editor: ReturnType<typeof useEditorStore>
  let pwa: ReturnType<typeof usePwaInstallUpdate>

  beforeEach(async () => {
    const { Blob: NodeBlob } = await vi.importActual<{ Blob: typeof Blob }>('node:buffer')
    vi.stubGlobal('Blob', NodeBlob)
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setRendererFactory(createFakeRenderer().factory)
    pwa = usePwaInstallUpdate()
    URL.createObjectURL = () => 'blob:test/x'
    URL.revokeObjectURL = () => {}
    takeReopen()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    takeReopen()
  })

  async function mountLive() {
    wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await editor.runCapabilityGate(async () => ok(undefined))
    await nextTick()
  }

  it('puts "Install app" last in the top bar, after Export, while the browser offers (SCR-01, AC-01)', async () => {
    pwa.connectInstall(fakeInstallPrompt({ offer: true }).client)
    await mountLive()
    const labels = [...wrapper!.element.querySelectorAll('button')].map((b) =>
      b.textContent?.trim(),
    )
    expect(labels.indexOf('Install app')).toBe(labels.indexOf('Export') + 1)
    const actions = document.querySelector('.editor-top-bar__actions')!
    expect(actions.lastElementChild?.textContent?.trim()).toBe('Install app')
  })

  it('shows no "Install app" without an offer (AC-02)', async () => {
    pwa.connectInstall(fakeInstallPrompt().client)
    await mountLive()
    expect(wrapper!.text()).not.toContain('Install app')
  })

  it('mounts ReloadDialog at the root, shown while Reload asks (SCR-06, AC-12)', async () => {
    const sw = fakeClient()
    pwa.connect(sw.create, { now: () => 0, document: fakeDocument().doc, reloadPage: vi.fn() })
    sw.newWaiting()
    await mountLive()
    vi.spyOn(editor, 'requestReload').mockResolvedValue({
      kind: 'confirm',
      reopenId: null,
    } satisfies ReloadOutcome)

    useNotices()
      .items.find((n) => n.slot === 'app-update')!
      .action!.run()
    await flushPromises()
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
      'Reload and lose this image?',
    )
  })

  it.each([
    ['Cancel', true],
    ['Escape', true],
    // Safari and Firefox on macOS do not focus a button on a mouse click.
    ['Cancel', false],
    ['Escape', false],
  ] as const)(
    'returns focus to the Reload action when %s closes the confirmation (focused on click: %s) (SCR-06, AC-12)',
    async (how, focusedOnClick) => {
      const sw = fakeClient()
      pwa.connect(sw.create, { now: () => 0, document: fakeDocument().doc, reloadPage: vi.fn() })
      sw.newWaiting()
      await mountLive()
      vi.spyOn(editor, 'requestReload').mockResolvedValue({ kind: 'confirm', reopenId: null })
      const reload = () =>
        [...document.querySelectorAll<HTMLButtonElement>('.toast button')].find(
          (b) => b.textContent?.trim() === 'Reload',
        )!

      if (focusedOnClick) reload().focus()
      else (document.activeElement as HTMLElement | null)?.blur()
      reload().click()
      await flushPromises()
      const dialog = document.querySelector<HTMLElement>('[role="alertdialog"]')!
      expect(dialog).not.toBeNull()
      if (how === 'Cancel')
        dialog.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click()
      else dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()

      expect(document.querySelector('[role="alertdialog"]')).toBeNull()
      expect(document.activeElement).toBe(reload())
    },
  )

  it('reopens the Work the update reload marked, after the Gallery connected and refreshed (AC-08)', async () => {
    const db = await openDb(`imgly-app-resume-${Math.random()}`)
    const w = storedWorkFixture({ layer: null, record: { sourceName: 'Cat.png' } })
    await db.put('works', w.record)
    await db.put('originals', w.original)
    gallerydb.openGalleryDb.mockResolvedValue(ok(db))
    markReopen(w.record.id)
    const gallery = useGallery()
    const refresh = vi.spyOn(gallery, 'refresh')
    const choose = vi.spyOn(gallery, 'choose').mockResolvedValue(undefined)
    const resume = vi.spyOn(pwa, 'resumeAfterUpdate')

    await mountLive()
    await vi.waitFor(() =>
      expect(choose).toHaveBeenCalledExactlyOnceWith(w.record.id, {
        couldNotOpen:
          "The image you had open couldn't be reopened. Open it from the Gallery if it's there.",
      }),
    )
    expect(resume.mock.invocationCallOrder[0]!).toBeGreaterThan(
      refresh.mock.invocationCallOrder[0]!,
    )
    expect(takeReopen()).toBeNull()
    db.close()
  })

  it('lists the Gallery afresh before deciding, so a listing still in flight elsewhere does not read as evicted (AC-08)', async () => {
    const db = await openDb(`imgly-app-resume-race-${Math.random()}`)
    const w = storedWorkFixture({ layer: null, record: { sourceName: 'Cat.png' } })
    await db.put('works', w.record)
    await db.put('originals', w.original)
    gallerydb.openGalleryDb.mockResolvedValue(ok(db))
    markReopen(w.record.id)
    const gallery = useGallery()
    const choose = vi.spyOn(gallery, 'choose').mockResolvedValue(undefined)
    // Every listing but the newest leaves the entries as they were (only the newest assigns).
    const refresh = gallery.refresh
    let calls = 0
    vi.spyOn(gallery, 'refresh').mockImplementation(async () => {
      if (++calls === 1) return
      await refresh()
    })

    await mountLive()
    await vi.waitFor(() => expect(choose).toHaveBeenCalledOnce())
    expect(choose.mock.calls[0]![0]).toBe(w.record.id)
    expect(useNotices().items.map((n) => n.text)).not.toContain(
      "The image you had open couldn't be reopened: it was removed from the Gallery to make room.",
    )
    db.close()
  })

  it('takes the marker at start, before the Gallery has opened, so no later start reopens it (AC-08, §6.1)', async () => {
    gallerydb.openGalleryDb.mockReturnValue(new Promise(() => {})) // never opens
    markReopen('work-1')
    await mountLive()
    expect(takeReopen()).toBeNull()
  })

  it('says a marked Work the Gallery no longer lists was removed to make room, opening none (AC-08)', async () => {
    const db = await openDb(`imgly-app-resume-evicted-${Math.random()}`)
    const w = storedWorkFixture({ layer: null, record: { sourceName: 'Cat.png' } })
    await db.put('works', w.record)
    await db.put('originals', w.original)
    gallerydb.openGalleryDb.mockResolvedValue(ok(db))
    markReopen('evicted-work')
    const choose = vi.spyOn(useGallery(), 'choose')

    await mountLive()
    await vi.waitFor(() =>
      expect(useNotices().items.map((n) => n.text)).toContain(
        "The image you had open couldn't be reopened: it was removed from the Gallery to make room.",
      ),
    )
    expect(choose).not.toHaveBeenCalled()
    expect(editor.work).toBeNull()
    db.close()
  })

  it('says a marked Work could not be reopened when the Gallery fails to open (AC-08)', async () => {
    markReopen('work-1')
    await mountLive()
    await vi.waitFor(() =>
      expect(useNotices().items.map((n) => n.text)).toContain(
        "The image you had open couldn't be reopened. Open it from the Gallery if it's there.",
      ),
    )
  })
})
