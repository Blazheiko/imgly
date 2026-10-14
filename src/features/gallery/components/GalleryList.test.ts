import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { IDBPDatabase } from 'idb'
import { appError, err, ok } from '@/core'
import { loadWork, openDb, type ImglyDb } from '@/infra/db'
import { storedWorkFixture } from '@/infra/db/testing'
import { useEditorStore } from '@/features/editor'
import { createFakeAutosave } from '@/features/editor/testing'
import { useNotices } from '@/shared'
import { useGallery } from '../store'
import * as m from '../messages'
import GalleryList from './GalleryList.vue'

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
  await db.put('works', { ...w.record, thumbnail: new Blob(['x'], { type: 'text/plain' }) })
  await db.put('originals', w.original)
  return w.record.id
}

// Pinned API: GalleryList takes props { showClose, showOpenImage }, emits `close` / `open-image`,
// and reads useGallery(). Hooks: entry root `.gallery-entry` (+ `.gallery-entry--open` /
// `--damaged`), thumbnail box `.gallery-entry__thumb`, `[data-testid="gallery-count"]`,
// `[data-testid="gallery-storage-line"]`, `[data-testid="gallery-empty"]`, `[data-testid="gallery-unavailable"]`.
describe('GalleryList (SCR-01, SCR-03)', () => {
  let db: Db
  let editor: ReturnType<typeof useEditorStore>
  let gallery: ReturnType<typeof useGallery>
  let autosave: ReturnType<typeof createFakeAutosave>
  let wrapper: VueWrapper | undefined
  let created: string[]
  let revoked: string[]

  beforeEach(async () => {
    // happy-dom's Blob does not survive fake-indexeddb's structured clone; Node's does.
    const { Blob: NodeBlob } = await vi.importActual<{ Blob: typeof Blob }>('node:buffer')
    vi.stubGlobal('Blob', NodeBlob)
    setActivePinia(createPinia())
    db = await openDb(`imgly-gallery-list-${++dbCounter}`)
    autosave = createFakeAutosave()
    editor = useEditorStore()
    editor.setAutosave(autosave.fake)
    editor.setReopenSource({
      loadWork: (id) => loadWork(db, id),
      decodePng: async () => ok({ width: 4, height: 3, close: vi.fn() } as unknown as ImageBitmap),
    })
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(true) } })
    created = []
    revoked = []
    URL.createObjectURL = () => {
      const url = `blob:test/${created.length}`
      created.push(url)
      return url
    }
    URL.revokeObjectURL = (url: string) => void revoked.push(url)
    gallery = useGallery()
    gallery.connect(ok(db))
    gallery.setClock(() => NOW)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
    db.close()
  })

  async function show(props: { showClose?: boolean; showOpenImage?: boolean } = {}) {
    await gallery.refresh()
    wrapper = mount(GalleryList, {
      props: { showClose: false, showOpenImage: false, ...props },
      attachTo: document.body,
    })
    await nextTick()
    return wrapper
  }

  const entryButton = (w: VueWrapper, name: string) =>
    w.get(`.gallery-entry [aria-label="${name}"]`)

  describe('listing (AC-03)', () => {
    it('lists entries newest first with name, touched label and a thumbnail', async () => {
      await seed(db, 'Old.jpg', NOW - 3 * 60 * MINUTE)
      await seed(db, '', NOW - 10_000)
      await seed(db, 'Mid.png', NOW - 5 * MINUTE)

      const w = await show()

      const entries = w.findAll('.gallery-entry')
      expect(entries.map((e) => e.get('[title]').text())).toEqual([
        'Untitled',
        'Mid.png',
        'Old.jpg',
      ])
      expect(entries[0]!.text()).toContain('Just now')
      expect(entries[1]!.text()).toContain('5 minutes ago')
      expect(entries[2]!.text()).toContain('3 hours ago')
      expect(entries[0]!.get('img').attributes('src')).toBe(gallery.entries[0]!.thumbnailUrl)
    })

    it('gives the entry button and its Delete the pinned accessible names', async () => {
      await seed(db, 'Cat.png', NOW - 5 * MINUTE)
      const w = await show()
      expect(entryButton(w, 'Cat.png, 5 minutes ago').element.tagName).toBe('BUTTON')
      expect(entryButton(w, m.deleteButtonName('Cat.png')).text()).toBe(m.deleteButton())
    })

    it('puts the full name in a title and keeps a markup name as text', async () => {
      const name = '<img src=x onerror=alert(1)>'
      await seed(db, name, NOW)
      const w = await show()
      expect(w.find('.gallery-entry img[src=x]').exists()).toBe(false)
      expect(w.get('.gallery-entry [title]').attributes('title')).toBe(name)
      expect(w.get('.gallery-entry').text()).toContain(name)
    })

    it('marks the open Work Open with an accent-bordered thumbnail', async () => {
      const a = await seed(db, 'A.png', NOW - MINUTE)
      await seed(db, 'B.png', NOW - 2 * MINUTE)
      await editor.reopenWork(a)

      const w = await show()

      const [open, other] = w.findAll('.gallery-entry')
      expect(open!.classes()).toContain('gallery-entry--open')
      expect(open!.text()).toContain(m.statusOpen())
      expect(open!.text()).not.toContain('Just now')
      expect(other!.classes()).not.toContain('gallery-entry--open')
      expect(w.find(`[aria-label="A.png, ${m.statusOpen()}"]`).exists()).toBe(true)
    })

    it('shows the count and the storage line', async () => {
      await seed(db, 'A.png', NOW - MINUTE)
      await seed(db, 'B.png', NOW - 2 * MINUTE)
      const w = await show()
      expect(w.get('[data-testid="gallery-count"]').text()).toBe(m.countLabel(2))
      expect(w.get('[data-testid="gallery-storage-line"]').text()).toBe(m.storageLinePersisted())
      expect(w.get('h2').text()).toBe('Gallery')
    })

    it('shows the not-persisted storage line when the browser has not agreed (AC-13)', async () => {
      vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(false) } })
      const w = await show()
      expect(w.get('[data-testid="gallery-storage-line"]').text()).toBe(m.storageLineNotPersisted())
    })

    it('renders no spinner while a thumbnail is missing', async () => {
      await seedDamaged(db, 'X.png', NOW)
      const w = await show()
      expect(w.find('.spinner').exists()).toBe(false)
      expect(w.find('[role="progressbar"]').exists()).toBe(false)
    })
  })

  describe('choosing and header', () => {
    it('choosing an entry calls the gallery store', async () => {
      const id = await seed(db, 'A.png', NOW - MINUTE)
      const w = await show()
      const choose = vi.spyOn(gallery, 'choose').mockResolvedValue()
      await entryButton(w, 'A.png, 1 minute ago').trigger('click')
      expect(choose).toHaveBeenCalledWith(id)
    })

    it('shows Close only with showClose and emits close', async () => {
      const without = await show()
      expect(without.findAll('button').some((b) => b.text() === m.closeButton())).toBe(false)
      without.unmount()

      const w = await show({ showClose: true })
      const close = w.findAll('button').find((b) => b.text() === m.closeButton())!
      await close.trigger('click')
      expect(w.emitted('close')).toHaveLength(1)
    })
  })

  describe('delete (AC-06, AC-07)', () => {
    it('Delete on a closed entry asks the store for confirmation', async () => {
      const id = await seed(db, 'A.png', NOW - MINUTE)
      const w = await show()
      await entryButton(w, m.deleteButtonName('A.png')).trigger('click')
      expect(gallery.pendingDelete).toEqual({ id, name: 'A.png' })
    })

    it('Delete on the open entry is aria-disabled, described by the hint, and toasts it', async () => {
      const a = await seed(db, 'A.png', NOW - MINUTE)
      await editor.reopenWork(a)
      const w = await show()
      const del = entryButton(w, m.deleteButtonName('A.png'))

      expect(del.attributes('aria-disabled')).toBe('true')
      expect(del.attributes('disabled')).toBeUndefined()
      const describedBy = del.attributes('aria-describedby')!
      expect(document.getElementById(describedBy)?.textContent).toBe(
        m.hintOpenWorkCannotBeDeleted(),
      )

      await del.trigger('click')
      expect(gallery.pendingDelete).toBeNull()
      expect(useNotices().items.map((n) => [n.kind, n.text])).toEqual([
        ['info', m.hintOpenWorkCannotBeDeleted()],
      ])
    })
  })

  describe('damaged entry (AC-08)', () => {
    it('shows Can’t be read, Damaged, and stays chooseable and deletable', async () => {
      const bad = await seedDamaged(db, 'Cat.png', NOW - MINUTE)
      await seed(db, 'Ok.png', NOW - 2 * MINUTE)
      const w = await show()

      const damaged = w.findAll('.gallery-entry')[0]!
      expect(damaged.classes()).toContain('gallery-entry--damaged')
      expect(damaged.text()).toContain(m.damagedThumbnail())
      expect(damaged.text()).toContain(m.statusDamaged())
      expect(damaged.find('img').exists()).toBe(false)
      expect(w.findAll('.gallery-entry')[1]!.classes()).not.toContain('gallery-entry--damaged')

      const choose = vi.spyOn(gallery, 'choose').mockResolvedValue()
      await entryButton(w, `Cat.png, ${m.statusDamaged()}`).trigger('click')
      expect(choose).toHaveBeenCalledWith(bad)
      await entryButton(w, m.deleteButtonName('Cat.png')).trigger('click')
      expect(gallery.pendingDelete?.id).toBe(bad)
    })
  })

  describe('empty (AC-05)', () => {
    it('shows the plain text, 0 of 20, the storage line and Open image when asked', async () => {
      const w = await show({ showOpenImage: true })
      expect(w.get('[data-testid="gallery-empty"]').text()).toContain(m.emptyState())
      expect(w.get('[data-testid="gallery-count"]').text()).toBe(m.countLabel(0))
      expect(w.get('[data-testid="gallery-storage-line"]').text()).toBe(m.storageLinePersisted())
      const open = w.findAll('button').find((b) => b.text() === 'Open image')!
      await open.trigger('click')
      expect(w.emitted('open-image')).toHaveLength(1)
    })

    it('omits Open image without showOpenImage', async () => {
      const w = await show({ showClose: true })
      expect(w.text()).toContain(m.emptyState())
      expect(w.findAll('button').some((b) => b.text() === 'Open image')).toBe(false)
    })
  })

  describe('unavailable (AC-12)', () => {
    it.each(['refused', 'held'] as const)(
      'shows the %s reason instead of grid, count and line',
      async (reason) => {
        autosave.available(false)
        gallery.connect(err(appError('STORAGE_UNAVAILABLE', { reason })))
        const w = await show()
        const box = w.get('[data-testid="gallery-unavailable"]')
        expect(box.text()).toContain(m.unavailableTitle())
        expect(box.text()).toContain(m.unavailableBody(reason))
        expect(w.find('.gallery-entry').exists()).toBe(false)
        expect(w.find('[data-testid="gallery-count"]').exists()).toBe(false)
        expect(w.find('[data-testid="gallery-storage-line"]').exists()).toBe(false)
      },
    )

    it('shows the newer-version reason', async () => {
      autosave.available(false)
      const w = await show()
      expect(w.get('[data-testid="gallery-unavailable"]').text()).toContain(
        m.unavailableBody('newer-version'),
      )
    })
  })

  describe('resources', () => {
    it('revokes every created object URL when the list unmounts', async () => {
      await seed(db, 'A.png', NOW - MINUTE)
      await seed(db, 'B.png', NOW - 2 * MINUTE)
      const w = await show()
      expect(created).toHaveLength(2)
      w.unmount()
      wrapper = undefined
      expect([...revoked].sort()).toEqual([...created].sort())
    })
  })
})
