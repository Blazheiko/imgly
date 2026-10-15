// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { unwrap, type IDBPDatabase } from 'idb'
import { appError, err, ok } from '@/core'
import { loadWork, openDb, type ImglyDb } from '@/infra/db'
import { storedWorkFixture } from '@/infra/db/testing'
import { useEditorStore } from '@/features/editor'
import { createFakeAutosave } from '@/features/editor/testing'
import { useNotices } from '@/shared'
import { useGallery } from './store'

type Db = IDBPDatabase<ImglyDb>

const NOW = 1_700_000_000_000
const MINUTE = 60_000
let dbCounter = 0

/** Seeds one complete Work (no layer) and returns its id. */
async function seed(db: Db, sourceName: string, touchedAt: number): Promise<string> {
  const w = storedWorkFixture({ layer: null, record: { sourceName, touchedAt } })
  await db.put('works', w.record)
  await db.put('originals', w.original)
  return w.record.id
}

/** Seeds a Work whose thumbnail is not a PNG, so listing marks it damaged. */
async function seedDamaged(db: Db, sourceName: string, touchedAt: number): Promise<string> {
  const w = storedWorkFixture({ layer: null, record: { sourceName, touchedAt } })
  await db.put('works', { ...w.record, thumbnail: new Blob(['x'], { type: 'text/plain' }) })
  await db.put('originals', w.original)
  return w.record.id
}

const LINE_PERSISTED = 'Works are kept in this browser. Export a Work to keep a copy elsewhere.'
const LINE_NOT_PERSISTED =
  'Works are saved in this browser only, and the browser may clear them when space runs low. Export to keep a copy.'

describe('gallery store', () => {
  let db: Db
  let editor: ReturnType<typeof useEditorStore>
  let gallery: ReturnType<typeof useGallery>
  let notices: ReturnType<typeof useNotices>
  let autosave: ReturnType<typeof createFakeAutosave>
  let persisted: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    setActivePinia(createPinia())
    db = await openDb(`imgly-gallery-store-${++dbCounter}`)
    autosave = createFakeAutosave()
    editor = useEditorStore()
    editor.setAutosave(autosave.fake)
    // Pinned API: the Works the editor can reopen come from the same database handle.
    editor.setReopenSource({
      loadWork: (id) => loadWork(db, id),
      decodePng: async () => ok({ width: 4, height: 3, close: vi.fn() } as unknown as ImageBitmap),
    })
    notices = useNotices()
    persisted = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('navigator', { storage: { persisted } })
    gallery = useGallery()
    // Pinned API: the app hands the Result of openGalleryDb to the gallery store, and a clock.
    gallery.connect(ok(db))
    gallery.setClock(() => NOW)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    db.close()
  })

  describe('refresh (AC-03, AC-08, AC-13)', () => {
    it('lists every Work newest first with name, touched label, status and thumbnail', async () => {
      const oldest = await seed(db, 'Old.jpg', NOW - 3 * 60 * MINUTE)
      const damaged = await seedDamaged(db, 'Cat.png', NOW - 5 * MINUTE)
      const newest = await seed(db, '', NOW - 10_000)

      await gallery.refresh()

      expect(gallery.entries.map((e) => e.id)).toEqual([newest, damaged, oldest])
      expect(gallery.entries.map((e) => e.name)).toEqual(['Untitled', 'Cat.png', 'Old.jpg'])
      expect(gallery.entries.map((e) => e.status)).toEqual(['touched', 'damaged', 'touched'])
      expect(gallery.entries[0]!.label).toBe('Just now')
      expect(gallery.entries[2]!.label).toBe('3 hours ago')
      expect(gallery.entries[0]!.thumbnailUrl).toEqual(expect.stringMatching(/^blob:/))
      expect(gallery.entries[1]!.thumbnailUrl).toBeNull()
      expect(gallery.count).toBe(3)
      expect(gallery.unavailableReason).toBeNull()
    })

    it('marks the open Work Open, and counts only stored Works', async () => {
      const a = await seed(db, 'A.png', NOW - MINUTE)
      await seed(db, 'B.png', NOW - 2 * MINUTE)
      expect(await editor.reopenWork(a)).toEqual({ kind: 'replaced' })

      await gallery.refresh()

      expect(gallery.entries.map((e) => [e.id === a, e.status])).toEqual([
        [true, 'open'],
        [false, 'touched'],
      ])
      expect(gallery.count).toBe(2)
    })

    it('marks no entry Open when the open Work was never stored', async () => {
      const a = await seed(db, 'A.png', NOW - MINUTE)
      await editor.reopenWork(a)
      await db.delete('works', a)
      await db.delete('originals', a)

      await gallery.refresh()

      expect(gallery.entries).toEqual([])
      expect(gallery.count).toBe(0)
    })

    it('stores the name as text, never as markup', async () => {
      await seed(db, '<img src=x onerror=alert(1)>', NOW)
      await gallery.refresh()
      expect(gallery.entries[0]!.name).toBe('<img src=x onerror=alert(1)>')
    })

    it('reads persisted() on every refresh and follows the answer (AC-13)', async () => {
      await gallery.refresh()
      expect(gallery.storageLine).toBe(LINE_PERSISTED)

      persisted.mockResolvedValue(false)
      await gallery.refresh()
      expect(gallery.storageLine).toBe(LINE_NOT_PERSISTED)
      expect(persisted).toHaveBeenCalledTimes(2)
    })

    it('uses the not-persisted line when the API is missing, also when empty (AC-13)', async () => {
      vi.stubGlobal('navigator', {})
      await gallery.refresh()
      expect(gallery.entries).toEqual([])
      expect(gallery.storageLine).toBe(LINE_NOT_PERSISTED)
    })

    it('revokes the earlier object URLs when it refreshes again', async () => {
      await seed(db, 'A.png', NOW)
      const revoke = vi.spyOn(URL, 'revokeObjectURL')

      await gallery.refresh()
      const first = gallery.entries[0]!.thumbnailUrl!
      await gallery.refresh()

      expect(revoke).toHaveBeenCalledWith(first)
      expect(gallery.entries[0]!.thumbnailUrl).not.toBe(first)
    })
  })

  describe('a record with an unusable touchedAt (T34, R2-1)', () => {
    it.each([
      ['NaN', NaN],
      ['null', null],
      ['missing', undefined],
      ['string', 'yesterday'],
      ['out of the date range', -1e17],
    ])('a %s touchedAt lists Damaged and every other Work still lists', async (_l, bad) => {
      const a = await seed(db, 'A.png', NOW - MINUTE)
      const w = storedWorkFixture({ layer: null, record: { sourceName: 'Bad.png' } })
      const record: Record<string, unknown> = { ...w.record, touchedAt: bad }
      if (bad === undefined) delete record.touchedAt
      await db.put('works', record as never)
      await db.put('originals', w.original)

      await gallery.open()

      expect(gallery.overlayOpen).toBe(true)
      expect(gallery.entries.map((e) => [e.id, e.name, e.status])).toEqual(
        expect.arrayContaining([
          [a, 'A.png', 'touched'],
          [w.record.id, 'Bad.png', 'damaged'],
        ]),
      )
      expect(gallery.count).toBe(2)
    })
  })

  describe('the page damaged mark ends when the Work proves whole (T35, R2-2)', () => {
    it('a marked Work that reopens lists Open, not Damaged, and is no longer marked', async () => {
      const a = await seed(db, 'A.png', NOW - MINUTE)
      await seed(db, 'B.png', NOW - 2 * MINUTE)
      editor.markDamaged(a)

      expect(await editor.reopenWork(a)).toEqual({ kind: 'replaced' })
      await gallery.refresh()

      expect(editor.damagedIds.has(a)).toBe(false)
      expect(gallery.entries.find((e) => e.id === a)!.status).toBe('open')
    })

    it('the open Work lists Open even while it is still marked', async () => {
      const a = await seed(db, 'A.png', NOW - MINUTE)
      expect(await editor.reopenWork(a)).toEqual({ kind: 'replaced' })
      editor.markDamaged(a)

      await gallery.refresh()

      expect(gallery.entries.find((e) => e.id === a)!.status).toBe('open')
    })
  })

  describe('markDamaged with the erroring thumbnail URL (T33, S2-6)', () => {
    it('ignores an error for a URL that is no longer the entry thumbnail', async () => {
      const id = await seed(db, 'A.png', NOW)
      await gallery.refresh()
      const stale = gallery.entries[0]!.thumbnailUrl!
      await gallery.refresh()
      expect(gallery.entries[0]!.thumbnailUrl).not.toBe(stale)

      gallery.markDamaged(id, stale)

      expect(gallery.entries[0]!.status).toBe('touched')
      expect(editor.damagedIds.has(id)).toBe(false)
    })

    it('marks the entry damaged when the erroring URL is the current thumbnail', async () => {
      const id = await seed(db, 'A.png', NOW)
      await gallery.refresh()

      gallery.markDamaged(id, gallery.entries[0]!.thumbnailUrl!)

      expect(gallery.entries[0]!.status).toBe('damaged')
      expect(editor.damagedIds.has(id)).toBe(true)
    })
  })

  describe('a thumbnail error never damages the open Work (T43, R3-3, AC-07, AC-03)', () => {
    it('leaves the open Work entry Open and out of the editor damaged set', async () => {
      const a = await seed(db, 'A.png', NOW - MINUTE)
      expect(await editor.reopenWork(a)).toEqual({ kind: 'replaced' })
      await gallery.refresh()
      expect(gallery.entries.find((e) => e.id === a)!.status).toBe('open')

      gallery.markDamaged(a, gallery.entries.find((e) => e.id === a)!.thumbnailUrl!)

      expect(gallery.entries.find((e) => e.id === a)!.status).toBe('open')
      expect(editor.damagedIds.has(a)).toBe(false)
    })

    it('control: a non-open entry still turns Damaged beside the open Work', async () => {
      const a = await seed(db, 'A.png', NOW - MINUTE)
      const b = await seed(db, 'B.png', NOW - 2 * MINUTE)
      expect(await editor.reopenWork(a)).toEqual({ kind: 'replaced' })
      await gallery.refresh()

      gallery.markDamaged(b, gallery.entries.find((e) => e.id === b)!.thumbnailUrl!)

      expect(gallery.entries.find((e) => e.id === b)!.status).toBe('damaged')
      expect(editor.damagedIds.has(b)).toBe(true)
      expect(gallery.entries.find((e) => e.id === a)!.status).toBe('open')
    })
  })

  describe('open and close the overlay (AC-03)', () => {
    it('opens with a fresh list and tells the editor, then closes without changing anything', async () => {
      await seed(db, 'A.png', NOW)

      await gallery.open()

      expect(gallery.overlayOpen).toBe(true)
      expect(editor.activePanel).toBe('gallery')
      expect(gallery.entries).toHaveLength(1)

      gallery.close()

      expect(gallery.overlayOpen).toBe(false)
      expect(editor.activePanel).toBeNull()
      expect(gallery.entries).toHaveLength(1)
    })
  })

  describe('unavailable (AC-12)', () => {
    it('reports refused with no list, count or line', async () => {
      autosave.available(false)
      gallery.connect(err(appError('STORAGE_UNAVAILABLE', { reason: 'refused' })))

      await gallery.refresh()

      expect(gallery.unavailableReason).toBe('refused')
      expect(gallery.entries).toEqual([])
      expect(gallery.count).toBe(0)
      expect(gallery.storageLine).toBe('')
    })

    it('reports held by an older tab', async () => {
      autosave.available(false)
      gallery.connect(err(appError('STORAGE_UNAVAILABLE', { reason: 'held' })))
      await gallery.refresh()
      expect(gallery.unavailableReason).toBe('held')
    })

    it('reports nothing before the database connection arrives (S1-8)', async () => {
      setActivePinia(createPinia())
      const freshAutosave = createFakeAutosave()
      useEditorStore().setAutosave(freshAutosave.fake)
      freshAutosave.available(false) // not connected yet, so the editor reports unavailable
      const fresh = useGallery()
      expect(fresh.unavailableReason).toBeNull()
      await fresh.refresh()
      expect(fresh.unavailableReason).toBeNull()
      fresh.connect(ok(db))
      expect(fresh.unavailableReason).toBe('newer-version')
    })

    it('reports closed for a newer version when a connected database becomes unavailable', async () => {
      autosave.available(false)
      await gallery.refresh()
      expect(gallery.unavailableReason).toBe('newer-version')
    })
  })

  describe('choose (AC-08, AC-15)', () => {
    it('closes the overlay when the entry is the open Work, without reopening', async () => {
      const a = await seed(db, 'A.png', NOW)
      await editor.reopenWork(a)
      await gallery.open()
      const reopen = vi.spyOn(editor, 'reopenWork')

      await gallery.choose(a)

      expect(reopen).not.toHaveBeenCalled()
      expect(gallery.overlayOpen).toBe(false)
    })

    it('reopens another Work, shows reopening meanwhile, and closes on replaced', async () => {
      const b = await seed(db, 'B.png', NOW)
      await gallery.open()
      let release!: () => void
      vi.spyOn(editor, 'reopenWork').mockImplementation(
        () => new Promise((resolve) => (release = () => resolve({ kind: 'replaced' }))),
      )

      const choosing = gallery.choose(b)
      expect(gallery.reopening).toBe(b)
      release()
      await choosing

      expect(gallery.reopening).toBeNull()
      expect(gallery.overlayOpen).toBe(false)
    })

    it.each([
      ['exporting', 'Wait for the export to finish, then choose a Work.'],
      ['confirming', 'Answer the open question first, then choose a Work.'],
    ] as const)('refused while %s shows the hint and keeps the overlay', async (reason, text) => {
      const b = await seed(db, 'B.png', NOW)
      await gallery.open()
      vi.spyOn(editor, 'reopenWork').mockResolvedValue({ kind: 'refused', reason })

      await gallery.choose(b)

      expect(notices.items.map((n) => [n.kind, n.text])).toEqual([['info', text]])
      expect(gallery.overlayOpen).toBe(true)
      expect(gallery.reopening).toBeNull()
    })

    it('keeps the Damaged mark across refresh even though the list reports it as normal (S1-4)', async () => {
      const b = await seed(db, 'Beach.jpg', NOW - MINUTE)
      const c = await seed(db, 'C.png', NOW - 2 * MINUTE)
      await gallery.open()
      // listWorks sees a normal entry; only the load on reopen finds the damage.
      editor.setReopenSource({
        loadWork: async () => err(appError('WORK_DAMAGED', { reason: 'missing-original' })),
        decodePng: async () =>
          ok({ width: 4, height: 3, close: vi.fn() } as unknown as ImageBitmap),
      })
      await gallery.choose(b)
      expect(gallery.entries.find((e) => e.id === b)!.status).toBe('damaged')

      await gallery.refresh()

      expect(gallery.entries.find((e) => e.id === b)!.status).toBe('damaged')
      expect(gallery.entries.find((e) => e.id === c)!.status).toBe('touched')
    })

    it('markDamaged(id) turns a listed entry Damaged now, records it in the editor set, and survives refresh', async () => {
      const b = await seed(db, 'Beach.jpg', NOW - MINUTE)
      await gallery.open()

      gallery.markDamaged(b)

      expect(gallery.entries.find((e) => e.id === b)!.status).toBe('damaged')
      expect(editor.damagedIds.has(b)).toBe(true)
      await gallery.refresh()
      expect(gallery.entries.find((e) => e.id === b)!.status).toBe('damaged')
    })

    it('damaged: names the Work, offers Delete…, marks the entry damaged, others untouched', async () => {
      const b = await seed(db, 'Beach.jpg', NOW - MINUTE)
      const c = await seed(db, 'C.png', NOW - 2 * MINUTE)
      await gallery.open()
      vi.spyOn(editor, 'reopenWork').mockResolvedValue({
        kind: 'damaged',
        error: appError('WORK_DAMAGED'),
      })

      await gallery.choose(b)

      expect(notices.items).toHaveLength(1)
      const notice = notices.items[0]!
      expect(notice.kind).toBe('failure')
      expect(notice.text).toBe("“Beach.jpg” can't be opened: its stored data is damaged.")
      expect(notice.action?.label).toBe('Delete…')
      expect(gallery.entries.find((e) => e.id === b)!.status).toBe('damaged')
      expect(gallery.entries.find((e) => e.id === c)!.status).toBe('touched')
      expect(gallery.overlayOpen).toBe(true)

      notice.action!.run()
      expect(gallery.pendingDelete).toEqual({ id: b, name: 'Beach.jpg' })
    })

    it('STORAGE_FAILED: says so, leaves the entry as it was, offers no Delete… (R3-2)', async () => {
      const b = await seed(db, 'Beach.jpg', NOW - MINUTE)
      await gallery.open()
      vi.spyOn(editor, 'reopenWork').mockResolvedValue({
        kind: 'damaged',
        error: appError('STORAGE_FAILED'),
      })

      await gallery.choose(b)

      expect(notices.items).toHaveLength(1)
      const notice = notices.items[0]!
      expect(notice.kind).toBe('failure')
      expect(notice.text).toBe("“Beach.jpg” couldn't be opened. Try again.")
      expect(notice.action).toBeUndefined()
      expect(gallery.entries.find((e) => e.id === b)!.status).toBe('touched')
      expect(editor.damagedIds.has(b)).toBe(false)
    })

    it.each([['confirming'], ['cancelled'], ['superseded']] as const)(
      'a %s outcome raises no notice',
      async (kind) => {
        const b = await seed(db, 'B.png', NOW)
        await gallery.open()
        vi.spyOn(editor, 'reopenWork').mockResolvedValue({ kind })

        await gallery.choose(b)

        expect(notices.items).toEqual([])
        expect(gallery.reopening).toBeNull()
      },
    )
  })

  describe('delete (AC-06, AC-07 hint)', () => {
    it('refuses the open Work with the hint and asks nothing', async () => {
      const a = await seed(db, 'A.png', NOW)
      await editor.reopenWork(a)
      await gallery.refresh()

      gallery.requestDelete(a)

      expect(gallery.pendingDelete).toBeNull()
      expect(notices.items.map((n) => [n.kind, n.text])).toEqual([
        ['info', "The open Work can't be deleted. Open another image first."],
      ])
    })

    it('asks first, naming the Work, and cancelling keeps everything', async () => {
      await seed(db, 'Keep.png', NOW)
      const b = await seed(db, 'B.png', NOW - MINUTE)
      await gallery.refresh()

      gallery.requestDelete(b)
      expect(gallery.pendingDelete).toEqual({ id: b, name: 'B.png' })
      gallery.cancelDelete()

      expect(gallery.pendingDelete).toBeNull()
      expect(gallery.entries).toHaveLength(2)
      expect(await db.get('works', b)).toBeDefined()
    })

    it('confirming removes the Work from storage and the list, and the count goes down by one', async () => {
      await seed(db, 'Keep.png', NOW)
      const b = await seed(db, 'B.png', NOW - MINUTE)
      await gallery.refresh()
      expect(gallery.count).toBe(2)

      gallery.requestDelete(b)
      await gallery.confirmDelete()

      expect(gallery.pendingDelete).toBeNull()
      expect(gallery.count).toBe(1)
      expect(gallery.entries.map((e) => e.name)).toEqual(['Keep.png'])
      expect(await db.get('works', b)).toBeUndefined()
      expect(await db.get('originals', b)).toBeUndefined()
    })

    it('deletes a damaged Work like any other', async () => {
      const d = await seedDamaged(db, 'Cat.png', NOW)
      await gallery.refresh()
      gallery.requestDelete(d)
      await gallery.confirmDelete()
      expect(gallery.entries).toEqual([])
    })

    it('a failed delete keeps the entry and the count and raises the failure notice', async () => {
      const b = await seed(db, 'B.png', NOW)
      await gallery.refresh()
      gallery.requestDelete(b)
      const real = db.transaction.bind(db) as unknown as (...a: unknown[]) => never
      vi.spyOn(db, 'transaction').mockImplementation(((...a: unknown[]) => {
        // Hand back the raw transaction: idb wraps a mocked method's result again, and wrapping
        // an already wrapped one would add a second, unhandled `done` promise.
        const tx = unwrap(real(...a) as never) as unknown as IDBTransaction
        queueMicrotask(() => tx.abort())
        return tx
      }) as never)

      await gallery.confirmDelete()
      vi.restoreAllMocks()

      expect(gallery.entries.map((e) => e.id)).toEqual([b])
      expect(gallery.count).toBe(1)
      expect(notices.items.map((n) => [n.kind, n.text])).toEqual([
        ['failure', "“B.png” couldn't be deleted. Try again."],
      ])
      expect(await db.get('works', b)).toBeDefined()
    })
  })

  describe('a listing that fails (T45, R3-4, AC-03, AC-05)', () => {
    const COULD_NOT_LIST = "The Gallery couldn't be read. Try again."
    const failListing = () =>
      vi.spyOn(db, 'getAll').mockRejectedValue(new DOMException('boom', 'UnknownError') as never)

    it('a first listing that fails reads nothing: no false empty Gallery, one notice', async () => {
      failListing()

      await gallery.refresh()

      expect(gallery.listRead).toBe(false)
      expect(gallery.entries).toEqual([])
      expect(notices.items.map((n) => [n.kind, n.text])).toEqual([['failure', COULD_NOT_LIST]])
    })

    it('a later failing refresh keeps the list, listRead, and the thumbnail URLs', async () => {
      await seed(db, 'A.png', NOW)
      await seed(db, 'B.png', NOW - MINUTE)
      await gallery.refresh()
      const names = gallery.entries.map((e) => e.name)
      const urls = gallery.entries.map((e) => e.thumbnailUrl)
      expect(names).toHaveLength(2)
      const revoke = vi.spyOn(URL, 'revokeObjectURL')
      failListing()

      await gallery.refresh()

      expect(gallery.entries.map((e) => e.name)).toEqual(names)
      expect(gallery.listRead).toBe(true)
      for (const u of urls) expect(revoke).not.toHaveBeenCalledWith(u)
      expect(notices.items.map((n) => [n.kind, n.text])).toEqual([['failure', COULD_NOT_LIST]])
    })
  })
})
