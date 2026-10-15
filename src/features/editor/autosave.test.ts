// @vitest-environment node
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NEUTRAL_ADJUSTMENTS,
  appError,
  createWork,
  err,
  ok,
  type DrawingLayer,
  type Work,
} from '@/core'
import { LATEST_VERSION, deleteWork, openGalleryDb, type ImglyDb } from '@/infra/db'
import { storedWorkFixture, withFaults, type Faults } from '@/infra/db/testing'
import type { PreviewRenderer, RendererStatus } from '@/render'
import { newId } from '@/shared/ids'
import { useNotices } from '@/shared/notices'
import { createAutosave } from './autosave'
import { failureSaveFailed, failureStorageFull, infoEvicted, infoNewerVersion } from './messages'

type W = Work<ImageBitmap, OffscreenCanvas>
type Db = IDBPDatabase<ImglyDb>

let dbCounter = 0
const freshName = () => `imgly-autosave-${++dbCounter}`
const png = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/png' })
const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0))
}

function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

const bitmap = () => ({ width: 4, height: 3, close() {} }) as unknown as ImageBitmap
const canvas = () => ({ width: 4, height: 3 }) as unknown as OffscreenCanvas

function makeWork(name = 'holiday'): W {
  return createWork<ImageBitmap, OffscreenCanvas>(
    { width: 4, height: 3, pixels: bitmap(), hasTransparency: false },
    newId(),
    { sourceName: name, sourceFormat: 'jpeg' },
    0,
  )
}

/** The same Work after one more applied change. */
function edited(work: W, revision: number, patch: Partial<W> = {}): W {
  return { ...work, revision, ...patch }
}

const layer = (id: string): DrawingLayer<OffscreenCanvas> => ({
  id,
  width: 4,
  height: 3,
  pixels: canvas(),
})

async function seed(db: Db, count: number, firstTouchedAt = 1) {
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const w = storedWorkFixture({
      record: { sourceName: `work-${i + 1}`, touchedAt: firstTouchedAt + i },
    })
    await db.put('works', w.record)
    await db.put('originals', { workId: w.record.id, png: png(10) })
    if (w.layer) await db.put('layers', { workId: w.record.id, png: png(20) })
    ids.push(w.record.id)
  }
  return ids
}

/** Everything is injected: the codec, the renderer, the thumbnail encoder, persistence and the clock. */
function setup(
  options: {
    faults?: Faults | (() => Faults)
    persist?: () => Promise<boolean>
    damagedIds?: () => ReadonlySet<string>
    onStored?: (workId: string) => void
  } = {},
) {
  setActivePinia(createPinia())
  const notices = useNotices()
  let clock = 1_000_000
  const encoded: ImageBitmap[] = []
  const codec = {
    encodePng: vi.fn(async (b: ImageBitmap) => {
      encoded.push(b)
      return ok(png(100 + encoded.length))
    }),
  }
  const rendererReady = { current: Promise.resolve() }
  const statusListeners = new Set<(status: RendererStatus) => void>()
  const renderer = {
    status: 'ready' as RendererStatus,
    renderThumbnail: vi.fn((): ImageData | null =>
      renderer.status === 'ready'
        ? ({ width: 4, height: 3, data: new Uint8ClampedArray(48) } as ImageData)
        : null,
    ),
    onStatus(listener: (status: RendererStatus) => void) {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    },
  }
  /** Moves the renderer to a new status, as a context loss, restore or give-up would. */
  const setStatus = (status: RendererStatus) => {
    renderer.status = status
    statusListeners.forEach((listener) => listener(status))
  }
  const thumbnail = { gate: null as Promise<void> | null }
  const encodeThumbnail = vi.fn(async () => {
    if (thumbnail.gate) await thumbnail.gate
    return png(7)
  })
  const requestPersistence = vi.fn(options.persist ?? (async () => true))
  const autosave = createAutosave({
    notices,
    codec,
    renderer: () => renderer as unknown as PreviewRenderer,
    rendererReady: () => rendererReady.current,
    copyBitmap: async () => bitmap(),
    encodeThumbnail,
    requestPersistence,
    now: () => clock,
    damagedIds: options.damagedIds,
    onStored: options.onStored,
  })
  const name = freshName()
  const connect = async () => {
    const opened = await openGalleryDb({ name })
    if (!opened.ok) throw new Error('open failed')
    const raw = opened.value
    const faults = options.faults
    const db = faults ? withFaults(raw, typeof faults === 'function' ? faults() : faults) : raw
    autosave.connectGallery(ok(db))
    return raw
  }
  return {
    autosave,
    notices,
    codec,
    encoded,
    renderer,
    setStatus,
    rendererReady,
    thumbnail,
    encodeThumbnail,
    requestPersistence,
    name,
    connect,
    tick: (to?: number) => (clock = to ?? clock + 1000),
  }
}

async function save(s: ReturnType<typeof setup>, work: W) {
  s.autosave.request(work)
  await flush()
  await s.autosave.settled()
}

const texts = (s: ReturnType<typeof setup>) => s.notices.items.map((n) => n.text)

describe('Autosave pipeline (gallery AC-01)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts unavailable until a connection is handed over', () => {
    const s = setup()
    expect(s.autosave.galleryAvailable.value).toBe(false)
    expect(s.autosave.saving.value).toBe(false)
  })

  it('first save stores the record, the encoded Original and the thumbnail, stamped by the clock', async () => {
    const s = setup()
    const db = await s.connect()
    const work = makeWork('holiday')

    await save(s, work)

    const works = await db.getAll('works')
    expect(works).toHaveLength(1)
    const record = works[0]!
    expect(record.id).toBe(work.id)
    expect(record.sourceName).toBe('holiday')
    expect(record.touchedAt).toBe(1_000_000)
    expect(record.layerId).toBeNull()
    expect(record.thumbnail.size).toBe(7)
    expect(await db.getAll('originals')).toHaveLength(1)
    expect((await db.get('originals', work.id))?.png.size).toBe(101)
    expect(await db.getAll('layers')).toHaveLength(0)
    expect(s.autosave.isStored(work)).toBe(true)
    expect(s.autosave.isStored(edited(work, 1))).toBe(false)
  })

  it('encodes a copy of the Original, never the bitmap the renderer holds', async () => {
    const s = setup()
    await s.connect()
    const work = makeWork()
    await save(s, work)
    expect(s.encoded).toHaveLength(1)
    expect(s.encoded[0]).not.toBe(work.original.pixels)
  })

  it('a Crop or Adjustment save encodes nothing and updates only the record; touchedAt moves forward', async () => {
    const s = setup()
    const db = await s.connect()
    const work = makeWork()
    await save(s, work)
    s.tick()

    const adjusted = edited(work, 1, { adjustments: { ...NEUTRAL_ADJUSTMENTS, brightness: 25 } })
    await save(s, adjusted)

    expect(s.codec.encodePng).toHaveBeenCalledTimes(1)
    const record = (await db.getAll('works'))[0]!
    expect(record.adjustments.brightness).toBe(25)
    expect(record.touchedAt).toBe(1_001_000)
    expect(await db.getAll('originals')).toHaveLength(1)
    expect(s.autosave.isStored(adjusted)).toBe(true)
  })

  it('a drawing save encodes the layer once; an unchanged layer id is not encoded again', async () => {
    const s = setup()
    const db = await s.connect()
    const work = makeWork()
    await save(s, work)
    expect(s.codec.encodePng).toHaveBeenCalledTimes(1)

    const drawn = edited(work, 1, { drawing: layer('L1') })
    await save(s, drawn)
    expect(s.codec.encodePng).toHaveBeenCalledTimes(2)
    expect((await db.getAll('works'))[0]!.layerId).toBe('L1')
    expect(await db.getAll('layers')).toHaveLength(1)

    await save(s, edited(drawn, 2, { adjustments: { ...NEUTRAL_ADJUSTMENTS, tint: 5 } }))
    expect(s.codec.encodePng).toHaveBeenCalledTimes(2)

    await save(s, edited(drawn, 3, { drawing: layer('L2') }))
    expect(s.codec.encodePng).toHaveBeenCalledTimes(3)
    expect((await db.getAll('works'))[0]!.layerId).toBe('L2')
  })

  it('a Work whose layer becomes null (Undo of the only drawing) encodes nothing and deletes the stored layer', async () => {
    const s = setup()
    const db = await s.connect()
    const work = makeWork()
    await save(s, edited(work, 1, { drawing: layer('L1') }))
    expect(await db.getAll('layers')).toHaveLength(1)
    const calls = s.codec.encodePng.mock.calls.length

    await save(s, edited(work, 2, { drawing: null }))

    expect(s.codec.encodePng).toHaveBeenCalledTimes(calls)
    expect(await db.getAll('layers')).toHaveLength(0)
    expect((await db.getAll('works'))[0]!.layerId).toBeNull()
  })

  it('drops the held Blobs when the Work is replaced: reopening the first Work encodes again', async () => {
    const s = setup()
    await s.connect()
    const a = makeWork('a')
    const b = makeWork('b')
    await save(s, a)
    await save(s, b)
    expect(s.codec.encodePng).toHaveBeenCalledTimes(2)
    await save(s, edited(a, 1))
    expect(s.codec.encodePng).toHaveBeenCalledTimes(3)
  })

  it('saving is true while a save runs and settled() resolves after it commits', async () => {
    const s = setup()
    await s.connect()
    const gate = deferred()
    s.thumbnail.gate = gate.promise
    s.autosave.request(makeWork())
    await flush()
    expect(s.autosave.saving.value).toBe(true)
    gate.resolve()
    await s.autosave.settled()
    expect(s.autosave.saving.value).toBe(false)
  })

  it('waits for the renderer before preparing the save (ADR-0005)', async () => {
    const s = setup()
    const db = await s.connect()
    const ready = deferred()
    s.rendererReady.current = ready.promise
    s.autosave.request(makeWork())
    await flush()
    expect(s.renderer.renderThumbnail).not.toHaveBeenCalled()
    expect(await db.getAll('works')).toHaveLength(0)

    ready.resolve()
    await s.autosave.settled()
    expect(s.renderer.renderThumbnail).toHaveBeenCalledTimes(1)
    expect(await db.getAll('works')).toHaveLength(1)
  })

  it('a lost context that is being restored delays the save until the renderer is ready (AC-19)', async () => {
    const s = setup()
    const db = await s.connect()
    s.setStatus('restoring')
    s.autosave.request(makeWork())
    await flush()
    expect(await db.getAll('works')).toHaveLength(0)
    expect(s.autosave.saving.value).toBe(true)

    s.setStatus('ready')
    await s.autosave.settled()
    expect(await db.getAll('works')).toHaveLength(1)
    expect(texts(s)).toEqual([])
  })

  it('a context that never comes back fails the save with the failure notice', async () => {
    const s = setup()
    const db = await s.connect()
    s.setStatus('restoring')
    s.autosave.request(makeWork())
    await flush()

    s.setStatus('lost')
    await s.autosave.settled()
    expect(await db.getAll('works')).toHaveLength(0)
    expect(texts(s)).toEqual([failureSaveFailed()])
  })

  it('keepEncoded hands over loaded Blobs: a reopened Work evicted elsewhere is written back without encoding (AC-21)', async () => {
    const s = setup()
    const db = await s.connect()
    const work = edited(makeWork(), 0, { drawing: layer('L1') })
    s.autosave.keepEncoded(work.id, { original: png(55), layer: png(66), layerId: 'L1' })

    await save(s, work)

    expect(s.codec.encodePng).not.toHaveBeenCalled()
    expect((await db.get('originals', work.id))?.png.size).toBe(55)
    expect((await db.get('layers', work.id))?.png.size).toBe(66)
  })
})

describe('Autosave eviction (gallery AC-09, AC-10, AC-21)', () => {
  it('AC-09: the 21st Work evicts the oldest not open here, keeps 20, and one notice names it', async () => {
    const s = setup()
    const db = await s.connect()
    await seed(db, 20)
    const work = makeWork('fresh')

    await save(s, work)

    const works = await db.getAll('works')
    expect(works).toHaveLength(20)
    expect(works.map((w) => w.sourceName)).not.toContain('work-1')
    expect(works.map((w) => w.id)).toContain(work.id)
    expect(texts(s)).toEqual([infoEvicted(['work-1'])])
    expect(s.notices.items[0]?.kind).toBe('info')
  })

  it("AC-08: the page's damaged set reaches the save: a damaged Work is evicted before the oldest", async () => {
    let damaged: ReadonlySet<string> = new Set()
    const s = setup({ damagedIds: () => damaged })
    const db = await s.connect()
    const ids = await seed(db, 20)
    damaged = new Set([ids[9]!])

    await save(s, makeWork('fresh'))

    const names = (await db.getAll('works')).map((w) => w.sourceName)
    expect(names).toHaveLength(20)
    expect(names).not.toContain('work-10')
    expect(names).toContain('work-1')
    expect(texts(s)).toEqual([infoEvicted(['work-10'])])
  })

  it('AC-09: a save that evicts nothing raises no notice', async () => {
    const s = setup()
    const db = await s.connect()
    await seed(db, 3)
    await save(s, makeWork())
    expect(texts(s)).toEqual([])
  })

  it('AC-21: a Work evicted by another tab is written back whole, evicting the oldest, with the usual notice', async () => {
    const s = setup()
    const db = await s.connect()
    const work = edited(makeWork('mine'), 0, { drawing: layer('L1') })
    await save(s, work)
    const encodes = s.codec.encodePng.mock.calls.length
    await deleteWork(db, work.id, { keep: '' })
    await seed(db, 20, 10)
    expect(await db.get('works', work.id)).toBeUndefined()

    s.tick()
    await save(s, edited(work, 1, { adjustments: { ...NEUTRAL_ADJUSTMENTS, contrast: 9 } }))

    const works = await db.getAll('works')
    expect(works).toHaveLength(20)
    const back = works.find((w) => w.id === work.id)
    expect(back?.adjustments.contrast).toBe(9)
    expect(back?.touchedAt).toBe(1_001_000)
    expect(await db.get('originals', work.id)).toBeDefined()
    expect(await db.get('layers', work.id)).toBeDefined()
    expect(s.codec.encodePng).toHaveBeenCalledTimes(encodes)
    expect(texts(s)).toEqual([infoEvicted(['work-1'])])
  })

  it('AC-10: on a full quota evicts one more Work at a time, and one notice names every one removed', async () => {
    const s = setup({
      faults: () => ({ failPut: (store, n) => (store === 'works' && n <= 2 ? 'quota' : null) }),
    })
    const db = await s.connect()
    await seed(db, 5)

    const work = makeWork()
    await save(s, work)

    const names = (await db.getAll('works')).map((w) => w.sourceName).sort()
    expect(names).toEqual(['holiday', 'work-3', 'work-4', 'work-5'])
    expect(texts(s)).toEqual([infoEvicted(['work-1', 'work-2'])])
    expect(s.autosave.isStored(work)).toBe(true)
  })

  it('AC-10: when it cannot fit even alone, nothing is evicted, the earlier stored state stays, and a failure notice says so', async () => {
    let full = false
    const s = setup({
      faults: () => ({ failPut: (store) => (full && store === 'works' ? 'quota' : null) }),
    })
    const db = await s.connect()
    const work = makeWork('mine')
    await save(s, work)
    await seed(db, 3)
    full = true
    s.tick()

    const next = edited(work, 1, { adjustments: { ...NEUTRAL_ADJUSTMENTS, tint: 4 } })
    await save(s, next)

    const works = await db.getAll('works')
    expect(works).toHaveLength(4)
    expect(works.find((w) => w.id === work.id)?.adjustments.tint).toBe(0)
    expect(texts(s)).toEqual([failureStorageFull()])
    expect(s.notices.items[0]?.kind).toBe('failure')
    expect(s.autosave.isStored(next)).toBe(false)
  })
})

describe('Autosave failed save (gallery AC-11)', () => {
  it('raises one failure notice per run of failures, retries without a new notice, withdraws it on success, raises it again later', async () => {
    let failing = true
    const s = setup({
      faults: () => ({ failPut: (store) => (failing && store === 'works' ? 'other' : null) }),
    })
    await s.connect()
    const work = makeWork()

    await save(s, work)
    expect(texts(s)).toEqual([failureSaveFailed()])
    expect(s.notices.items[0]?.kind).toBe('failure')
    expect(s.autosave.isStored(work)).toBe(false)

    await save(s, edited(work, 1))
    await save(s, edited(work, 2))
    expect(texts(s)).toEqual([failureSaveFailed()])

    failing = false
    const ok3 = edited(work, 3)
    await save(s, ok3)
    expect(s.autosave.isStored(ok3)).toBe(true)
    expect(texts(s)).toEqual([])

    failing = true
    await save(s, edited(work, 4))
    expect(texts(s)).toEqual([failureSaveFailed()])
  })

  it('S2-5: a successful save keeps the storage-full notice (only the save-failed one is withdrawn)', async () => {
    let mode: 'quota' | 'other' | null = 'quota'
    const s = setup({
      faults: () => ({ failPut: (store) => (store === 'works' ? mode : null) }),
    })
    await s.connect()
    const work = makeWork()

    await save(s, work)
    expect(texts(s)).toEqual([failureStorageFull()])

    mode = null
    const saved = edited(work, 1)
    await save(s, saved)
    expect(s.autosave.isStored(saved)).toBe(true)
    expect(texts(s)).toEqual([failureStorageFull()])
  })

  it('S2-5: a storage-full notice the Editor dismissed shows again at the next quota failure', async () => {
    const s = setup({
      faults: () => ({ failPut: (store) => (store === 'works' ? 'quota' : null) }),
    })
    await s.connect()
    const work = makeWork()

    await save(s, work)
    expect(texts(s)).toEqual([failureStorageFull()])
    s.notices.dismiss(s.notices.items[0]!.id)
    expect(texts(s)).toEqual([])

    await save(s, edited(work, 1))
    expect(texts(s)).toEqual([failureStorageFull()])
  })

  it('S2-5: storage full, then a failed save, then success withdraws the save-failed notice and keeps storage-full', async () => {
    let mode: 'quota' | 'other' | null = 'quota'
    const s = setup({
      faults: () => ({ failPut: (store) => (store === 'works' ? mode : null) }),
    })
    await s.connect()
    const work = makeWork()

    await save(s, work)
    mode = 'other'
    await save(s, edited(work, 1))
    expect(texts(s)).toContain(failureStorageFull())
    expect(texts(s)).toContain(failureSaveFailed())

    mode = null
    await save(s, edited(work, 2))
    expect(texts(s)).toEqual([failureStorageFull()])
  })

  it('R2-2: a committed save reports its Work to onStored; a failed one does not', async () => {
    let failing = true
    const onStored = vi.fn()
    const s = setup({
      onStored,
      faults: () => ({ failPut: (store) => (failing && store === 'works' ? 'other' : null) }),
    })
    await s.connect()
    const work = makeWork()

    await save(s, work)
    expect(onStored).not.toHaveBeenCalled()

    failing = false
    await save(s, edited(work, 1))
    expect(onStored).toHaveBeenCalledExactlyOnceWith(work.id)
  })

  it('hasStoredState: true once a save of the Work committed, and after a later failure (pwa-install-update AC-12)', async () => {
    let failing = true
    const s = setup({
      faults: () => ({ failPut: (store) => (failing && store === 'works' ? 'other' : null) }),
    })
    await s.connect()
    const work = makeWork()
    expect(s.autosave.hasStoredState(work.id)).toBe(false)

    await save(s, work)
    expect(s.autosave.hasStoredState(work.id)).toBe(false)

    failing = false
    await save(s, edited(work, 1))
    expect(s.autosave.hasStoredState(work.id)).toBe(true)

    failing = true
    await save(s, edited(work, 2))
    expect(s.autosave.hasStoredState(work.id)).toBe(true)
    expect(s.autosave.hasStoredState('other-work')).toBe(false)
  })

  it('hasStoredState: true for a Work reopened from the Gallery (pwa-install-update AC-08)', () => {
    const s = setup()
    s.autosave.keepEncoded('reopened', { original: png(1), layer: null, layerId: null })
    expect(s.autosave.hasStoredState('reopened')).toBe(true)
  })

  it('does not throw and keeps working after a failure', async () => {
    const s = setup({ faults: { failPut: (store) => (store === 'works' ? 'other' : null) } })
    await s.connect()
    await expect(save(s, makeWork())).resolves.toBeUndefined()
    expect(s.autosave.saving.value).toBe(false)
  })
})

describe('Autosave when the Gallery is unavailable (gallery AC-12)', () => {
  it('after a refused open every request is a no-op: nothing encoded, rendered or stored', async () => {
    const s = setup()
    s.autosave.connectGallery(err(appError('STORAGE_UNAVAILABLE', { reason: 'refused' })))
    const work = makeWork()

    s.autosave.request(work)
    await flush()
    await s.autosave.settled()

    expect(s.autosave.galleryAvailable.value).toBe(false)
    expect(s.codec.encodePng).not.toHaveBeenCalled()
    expect(s.renderer.renderThumbnail).not.toHaveBeenCalled()
    expect(s.requestPersistence).not.toHaveBeenCalled()
    expect(s.autosave.isStored(work)).toBe(false)
    expect(texts(s)).toEqual([])
  })

  it('a successful connection makes the Gallery available', async () => {
    const s = setup()
    await s.connect()
    expect(s.autosave.galleryAvailable.value).toBe(true)
  })
})

describe('Autosave persistent storage (gallery AC-14)', () => {
  it('asks once at the first save: not at connect, not at later saves', async () => {
    const s = setup()
    await s.connect()
    expect(s.requestPersistence).not.toHaveBeenCalled()

    const work = makeWork()
    await save(s, work)
    expect(s.requestPersistence).toHaveBeenCalledTimes(1)

    await save(s, edited(work, 1))
    await save(s, edited(work, 2))
    expect(s.requestPersistence).toHaveBeenCalledTimes(1)
  })

  it('asks once more after the stored data is cleared (the browser cleared site data)', async () => {
    const s = setup()
    const raw = await s.connect()
    const work = makeWork()
    await save(s, work)
    await save(s, edited(work, 1))
    expect(s.requestPersistence).toHaveBeenCalledTimes(1)

    // Clearing site data deletes the database; close our connection so the delete is not blocked.
    raw.close()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(s.name)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
    const fresh = await s.connect()
    expect(await fresh.getAll('works')).toHaveLength(0)

    await save(s, edited(work, 2))
    expect(await fresh.getAll('works')).toHaveLength(1)
    expect(s.requestPersistence).toHaveBeenCalledTimes(2)

    await save(s, edited(work, 3))
    expect(s.requestPersistence).toHaveBeenCalledTimes(2)
  })

  it('a declined request still commits the save', async () => {
    const s = setup({ persist: async () => false })
    const db = await s.connect()
    await save(s, makeWork())
    expect(await db.getAll('works')).toHaveLength(1)
    expect(texts(s)).toEqual([])
  })

  it('a request that never answers does not hold the save', async () => {
    const s = setup({ persist: () => new Promise<boolean>(() => {}) })
    const db = await s.connect()
    await save(s, makeWork())
    expect(await db.getAll('works')).toHaveLength(1)
    expect(s.autosave.saving.value).toBe(false)
  })
})

describe('Autosave versionchange (gallery ADR-0006)', () => {
  it('lets the running save finish, drops the pending one, closes, goes unavailable and raises one notice', async () => {
    const s = setup()
    const db = await s.connect()
    const gate = deferred()
    s.thumbnail.gate = gate.promise
    const work = makeWork()

    s.autosave.request(work)
    await flush()
    s.autosave.request(edited(work, 1, { adjustments: { ...NEUTRAL_ADJUSTMENTS, brightness: 40 } }))

    // Another tab upgrades the database; the older connection must close for it to proceed.
    const upgraded = openDB(s.name, LATEST_VERSION + 1)
    await flush()
    expect(s.autosave.galleryAvailable.value).toBe(true)

    gate.resolve()
    const other = await upgraded
    await s.autosave.settled()

    expect(s.autosave.galleryAvailable.value).toBe(false)
    expect(texts(s)).toEqual([infoNewerVersion()])
    expect(s.notices.items[0]?.kind).toBe('info')
    const stored = await other.getAll('works')
    expect(stored).toHaveLength(1)
    expect(stored[0]!.adjustments.brightness).toBe(0)
    expect(() => db.transaction('works')).toThrow()
    other.close()

    s.codec.encodePng.mockClear()
    s.autosave.request(makeWork())
    await flush()
    expect(s.codec.encodePng).not.toHaveBeenCalled()
    expect(texts(s)).toEqual([infoNewerVersion()])
  })
})
