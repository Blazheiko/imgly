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
import { drawsIcon } from '@/shared/ui/testing'

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

  describe('header and Storage note (ui-refresh AC-09, AC-10)', () => {
    it('shows the used places as a count and a hidden meter, a Damaged Work included', async () => {
      await seed(db, 'A.png', NOW - MINUTE)
      await seedDamaged(db, 'X.png', NOW - 2 * MINUTE)
      const w = await show()
      expect(w.get('[data-testid="gallery-count"]').text()).toBe(m.countLabel(2))
      const meter = w.get('meter')
      expect(meter.attributes('aria-hidden')).toBe('true')
      expect([meter.attributes('min'), meter.attributes('max')]).toEqual(['0', '20'])
      // happy-dom has no HTMLMeterElement.value, so the rendered attribute is checked.
      expect(meter.attributes('value')).toBe('2')
    })

    it('shows the Storage line unchanged in a note after an info icon', async () => {
      const w = await show()
      const line = w.get('[data-testid="gallery-storage-line"]')
      expect(line.text()).toBe(m.storageLinePersisted())
      const note = line.element.closest('.gallery-list__storage-note')!
      expect(note).not.toBeNull()
      expect(drawsIcon(note, 'info')).toBe(true)
    })

    it('shows Close with the x icon (SCR-03)', async () => {
      const w = await show({ showClose: true })
      const close = w.findAll('button').find((b) => b.text() === m.closeButton())!
      expect(drawsIcon(close.element, 'x')).toBe(true)
      expect(close.classes()).toContain('base-button--ghost')
    })

    it("shows the empty state's Open image with the image-plus icon", async () => {
      const w = await show({ showOpenImage: true })
      const open = w.findAll('button').find((b) => b.text() === 'Open image')!
      expect(drawsIcon(open.element, 'image-plus')).toBe(true)
    })

    it('leaves out the meter and the note icon when the Gallery is unavailable', async () => {
      autosave.available(false)
      gallery.connect(err(appError('STORAGE_UNAVAILABLE', { reason: 'refused' })))
      const w = await show()
      expect(w.find('meter').exists()).toBe(false)
      expect(w.get('[data-testid="gallery-unavailable"]').find('svg').exists()).toBe(false)
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

    it('the list itself shows the delete confirmation, so both homes can delete (AC-06)', async () => {
      await seed(db, 'A.png', NOW - MINUTE)
      const w = await show()
      await entryButton(w, m.deleteButtonName('A.png')).trigger('click')
      await nextTick()
      const dialog = document.querySelector('[role="alertdialog"]')
      expect(dialog?.textContent).toContain(m.deleteDialogTitle('A.png'))
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

    it('Cancel on a delete asked from the damaged notice puts focus on that entry’s Delete (T53, R4-4)', async () => {
      await seed(db, 'A.png', NOW - MINUTE)
      const b = await seed(db, 'B.png', NOW - 2 * MINUTE)
      const w = await show()
      // The notice's "Delete…" leaves with its toast, so the dialog opens with no opener on the page.
      ;(document.activeElement as HTMLElement | null)?.blur()
      gallery.requestDelete(b)
      await nextTick()
      const cancel = Array.from(
        document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button'),
      ).find((el) => el.textContent?.trim() === m.deleteDialogCancel())!

      cancel.click()
      await nextTick()

      expect(gallery.pendingDelete).toBeNull()
      expect(document.activeElement).toBe(entryButton(w, m.deleteButtonName('B.png')).element)
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

  describe('thumbnail that fails to decode (AC-08, S1-4)', () => {
    it('shows the Damaged mark when the img errors, and records the id as damaged', async () => {
      const id = await seed(db, 'Cat.png', NOW - MINUTE)
      await seed(db, 'Ok.png', NOW - 2 * MINUTE)
      // Bytes the list accepts (image/png type) but no decoder can read.
      const stored = await db.get('works', id)
      await db.put('works', { ...stored!, thumbnail: new Blob(['garbage'], { type: 'image/png' }) })
      const w = await show()
      const first = w.findAll('.gallery-entry')[0]!
      expect(first.classes()).not.toContain('gallery-entry--damaged')

      await first.get('img').trigger('error')
      await nextTick()

      const after = w.findAll('.gallery-entry')[0]!
      expect(after.classes()).toContain('gallery-entry--damaged')
      expect(after.text()).toContain(m.damagedThumbnail())
      expect(after.text()).toContain(m.statusDamaged())
      expect(after.find('img').exists()).toBe(false)
      expect(editor.damagedIds.has(id)).toBe(true)
      expect(w.findAll('.gallery-entry')[1]!.classes()).not.toContain('gallery-entry--damaged')
    })
  })

  describe('thumbnail error on the open Work (T43, R3-3, AC-07, AC-03)', () => {
    it('keeps the open entry Open with its Delete aria-disabled and hinted', async () => {
      const a = await seed(db, 'A.png', NOW - MINUTE)
      await editor.reopenWork(a)
      const w = await show()
      const entry = w.findAll('.gallery-entry')[0]!

      await entry.get('img').trigger('error')
      await nextTick()

      const after = w.findAll('.gallery-entry')[0]!
      expect(after.classes()).toContain('gallery-entry--open')
      expect(after.classes()).not.toContain('gallery-entry--damaged')
      expect(after.text()).toContain(m.statusOpen())
      expect(after.text()).not.toContain(m.statusDamaged())
      expect(editor.damagedIds.has(a)).toBe(false)
      const del = entryButton(w, m.deleteButtonName('A.png'))
      expect(del.attributes('aria-disabled')).toBe('true')
      const describedBy = del.attributes('aria-describedby')!
      expect(document.getElementById(describedBy)?.textContent).toBe(
        m.hintOpenWorkCannotBeDeleted(),
      )
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

  describe('a failing listing after the list unmounts (T50, R4-1, AC-08, AC-09)', () => {
    it('shows no revoked thumbnail URL, so an image error marks nothing Damaged', async () => {
      await seed(db, 'A.png', NOW - MINUTE)
      await seed(db, 'B.png', NOW - 2 * MINUTE)
      const first = await show()
      first.unmount()
      wrapper = undefined
      vi.spyOn(db, 'getAll').mockRejectedValue(new DOMException('boom', 'UnknownError') as never)

      const w = await show()

      expect(w.findAll('.gallery-entry')).toHaveLength(2)
      const imgs = w.findAll('.gallery-entry img')
      for (const img of imgs) expect(revoked).not.toContain(img.attributes('src'))
      for (const img of imgs) await img.trigger('error')
      await nextTick()
      expect(w.findAll('.gallery-entry--damaged')).toHaveLength(0)
      expect(editor.damagedIds.size).toBe(0)
    })
  })
})
