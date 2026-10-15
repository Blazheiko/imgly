import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { IDBPDatabase } from 'idb'
import { ok } from '@/core'
import { openDb, type ImglyDb } from '@/infra/db'
import { storedWorkFixture } from '@/infra/db/testing'
import { useEditorStore } from '@/features/editor'
import { createFakeAutosave } from '@/features/editor/testing'
import { useGallery } from '../store'
import * as m from '../messages'
import GalleryStart from './GalleryStart.vue'

const picked = vi.hoisted(() => ({ pickImageFile: vi.fn() }))
vi.mock('@/infra/platform', async (orig) => ({
  ...(await orig<typeof import('@/infra/platform')>()),
  pickImageFile: picked.pickImageFile,
}))

type Db = IDBPDatabase<ImglyDb>
let dbCounter = 0

// Pinned API: GalleryStart takes no props and lists on mount (it refreshes the gallery store
// itself). Root `[data-testid="gallery-start"]`; inside is GalleryList with showOpenImage and no
// Close. Its "Open image" (`[data-testid="gallery-open-image"]`) picks a file with
// `pickImageFile` from '@/infra/platform' and hands it to `editor.openFile`.
describe('GalleryStart (SCR-01, AC-05)', () => {
  let db: Db
  let editor: ReturnType<typeof useEditorStore>
  let gallery: ReturnType<typeof useGallery>
  let wrapper: VueWrapper | undefined

  beforeEach(async () => {
    const { Blob: NodeBlob } = await vi.importActual<{ Blob: typeof Blob }>('node:buffer')
    vi.stubGlobal('Blob', NodeBlob)
    setActivePinia(createPinia())
    db = await openDb(`imgly-gallery-start-${++dbCounter}`)
    editor = useEditorStore()
    editor.setAutosave(createFakeAutosave().fake)
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(true) } })
    URL.createObjectURL = () => 'blob:test/x'
    URL.revokeObjectURL = () => {}
    gallery = useGallery()
    gallery.connect(ok(db))
    picked.pickImageFile.mockReset()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    db.close()
  })

  async function show() {
    wrapper = mount(GalleryStart, { attachTo: document.body })
    await vi.waitFor(() => expect(gallery.storageLine).not.toBe(''))
    await nextTick()
    return wrapper
  }

  it('first visit: plain text, 0 of 20 and the Open image action; no Close (AC-05)', async () => {
    const w = await show()
    expect(w.get('[data-testid="gallery-empty"]').text()).toContain(m.emptyState())
    expect(w.get('[data-testid="gallery-count"]').text()).toBe(m.countLabel(0))
    expect(w.findAll('button').some((b) => b.text() === m.closeButton())).toBe(false)
    expect(w.find('[data-testid="gallery-open-image"]').exists()).toBe(true)
  })

  it('Open image picks a file and opens it', async () => {
    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    picked.pickImageFile.mockResolvedValue(file)
    const openFile = vi.spyOn(editor, 'openFile').mockResolvedValue({ kind: 'ignored' } as never)
    const w = await show()
    await w.get('[data-testid="gallery-open-image"]').trigger('click')
    await vi.waitFor(() => expect(openFile).toHaveBeenCalledWith(file))
  })

  it('lists stored Works on mount without loading any (AC-05)', async () => {
    const stored = storedWorkFixture({ layer: null, record: { sourceName: 'Cat.png' } })
    await db.put('works', stored.record)
    await db.put('originals', stored.original)
    const reopen = vi.spyOn(editor, 'reopenWork')
    const w = await show()
    expect(w.findAll('.gallery-entry')).toHaveLength(1)
    expect(w.get('.gallery-entry').text()).toContain('Cat.png')
    expect(reopen).not.toHaveBeenCalled()
    expect(editor.work).toBeNull()
  })

  it('shows the Opening spinner over the section while an entry is reopening', async () => {
    const stored = storedWorkFixture({ layer: null, record: { sourceName: 'Cat.png' } })
    await db.put('works', stored.record)
    await db.put('originals', stored.original)
    const w = await show()
    gallery.reopening = stored.record.id
    await nextTick()
    expect(w.get('.spinner').text()).toContain(m.reopeningLabel('Cat.png'))
    expect(w.get('.gallery-entry').element.closest('[inert]')).not.toBeNull()
  })
})

describe('GalleryStart while the database is still opening (SCR-01, AC-12, S1-8)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('renders no unavailable copy before the connection arrives', async () => {
    setActivePinia(createPinia())
    const autosave = createFakeAutosave()
    useEditorStore().setAutosave(autosave.fake)
    autosave.available(false) // nothing connected yet
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(true) } })
    const w = mount(GalleryStart, { attachTo: document.body })
    for (let i = 0; i < 10; i++) await nextTick()
    const text = w.text()
    expect(w.find('[data-testid="gallery-unavailable"]').exists()).toBe(false)
    expect(text).not.toContain(m.unavailableTitle())
    for (const reason of ['refused', 'held', 'newer-version'] as const) {
      expect(text).not.toContain(m.unavailableBody(reason))
    }
    w.unmount()
  })

  it('R2-3: shows no count, empty state or storage line until the list is read after connect', async () => {
    setActivePinia(createPinia())
    const autosave = createFakeAutosave()
    useEditorStore().setAutosave(autosave.fake)
    autosave.available(false)
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(true) } })
    const w = mount(GalleryStart, { attachTo: document.body })
    for (let i = 0; i < 10; i++) await nextTick()
    for (const id of ['gallery-count', 'gallery-empty', 'gallery-storage-line']) {
      expect(w.find(`[data-testid="${id}"]`).exists(), id).toBe(false)
    }
    expect(w.text()).not.toContain(m.emptyState())

    const db = await openDb(`imgly-gallery-start-${++dbCounter}`)
    autosave.available(true)
    const gallery = useGallery()
    gallery.connect(ok(db))
    await gallery.refresh()
    await nextTick()

    expect(w.get('[data-testid="gallery-count"]').text()).toBe(m.countLabel(0))
    expect(w.find('[data-testid="gallery-empty"]').exists()).toBe(true)
    expect(w.get('[data-testid="gallery-storage-line"]').text()).not.toBe('')
    w.unmount()
    db.close()
  })

  it('T45/R3-4: a first listing that fails shows no count and no empty state', async () => {
    setActivePinia(createPinia())
    useEditorStore().setAutosave(createFakeAutosave().fake)
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(true) } })
    const db = await openDb(`imgly-gallery-start-${++dbCounter}`)
    vi.spyOn(db, 'getAll').mockRejectedValue(new DOMException('boom', 'UnknownError') as never)
    const gallery = useGallery()
    gallery.connect(ok(db))
    const w = mount(GalleryStart, { attachTo: document.body })
    for (let i = 0; i < 10; i++) await nextTick()
    await new Promise((r) => setTimeout(r, 20))
    expect(gallery.listRead).toBe(false)
    for (const id of ['gallery-count', 'gallery-empty']) {
      expect(w.find(`[data-testid="${id}"]`).exists(), id).toBe(false)
    }
    expect(w.text()).not.toContain(m.emptyState())
    w.unmount()
    db.close()
  })
})
