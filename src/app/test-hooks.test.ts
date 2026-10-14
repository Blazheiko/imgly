import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { IDBPDatabase } from 'idb'
import {
  createWork,
  identityGeometry,
  NEUTRAL_ADJUSTMENTS,
  type Adjustments,
  type Geometry,
} from '@/core'
import { useEditorStore } from '@/features/editor'
import {
  DB_NAME,
  LATEST_VERSION,
  listWorks,
  loadWork,
  openDb,
  openGalleryDb,
  storeWork,
  type ImglyDb,
} from '@/infra/db'
import { storedWorkFixture } from '@/infra/db/testing'
import { requestPersistence } from '@/infra/platform'
import { installTestHooks } from './test-hooks'

describe('window.__imglyTest.historyStats (undo-redo AC-11, sad §8)', () => {
  afterEach(() => {
    delete window.__imglyTest
  })

  it('reads the editor store’s held bytes and Steps kept, 0/0 with no Work', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    installTestHooks(pinia)
    expect(window.__imglyTest!.historyStats()).toEqual({ heldBytes: 0, steps: 0 })

    const editor = useEditorStore(pinia)
    const pixels = { width: 40, height: 30, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ width: 40, height: 30, pixels, hasTransparency: false }, 'w', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 20 })
    editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 30 })
    expect(window.__imglyTest!.historyStats()).toEqual({ heldBytes: 0, steps: 2 })
  })
})

// ---- Gallery hooks (gallery T18): AC-08, AC-10, AC-11, AC-14, AC-18, AC-19 ----

type Part = 'original' | 'layer' | 'thumbnail' | 'record'
type HoldPoint = 'evictions' | 'record' | 'original' | 'layer'

interface WriteInput {
  sourceName: string
  sourceFormat: string
  geometry: Geometry
  adjustments: Adjustments
  touchedAt: number
  width?: number
  height?: number
  hasTransparency?: boolean
  originalPng: number[]
  layerPng?: number[]
}

/** The Gallery half of ImglyTestHooks, typed here until src/app/test-hooks.ts declares it. */
interface GalleryHooks {
  galleryRecords(): Promise<{
    works: Array<Record<string, unknown> & { id: string }>
    originals: string[]
    layers: string[]
    meta: string[]
  }>
  galleryWriteStored(input: WriteInput): Promise<string>
  galleryDamage(id: string, part: Part): Promise<void>
  gallerySetByteBudget(bytes: number | null): void
  galleryHoldSave(point: HoldPoint | null): void
  galleryFailNextSave(): void
  galleryOpenNextVersion(): Promise<void>
  galleryPersistCalls(): number
  galleryFailOpen(): void
}

const hooks = () => window.__imglyTest as unknown as GalleryHooks

const NONE = new Set<string>()
const png = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/png' })
const pending = Symbol('pending')
const settledWithin = (p: Promise<unknown>, ms: number) =>
  Promise.race([p, new Promise((r) => setTimeout(() => r(pending), ms))])

describe('window.__imglyTest Gallery hooks (gallery T18)', () => {
  beforeEach(async () => {
    // happy-dom's Blob does not survive fake-indexeddb's structured clone; Node's does.
    const { Blob: NodeBlob } = await vi.importActual<{ Blob: typeof Blob }>('node:buffer')
    vi.stubGlobal('Blob', NodeBlob)
    vi.stubGlobal('indexedDB', new IDBFactory())
    const pinia = createPinia()
    setActivePinia(pinia)
    installTestHooks(pinia)
  })

  afterEach(() => {
    delete window.__imglyTest
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function seedStored(db: IDBPDatabase<ImglyDb>, withLayer = true) {
    const w = storedWorkFixture({ layer: withLayer ? undefined : null })
    await db.put('works', w.record)
    await db.put('originals', w.original)
    if (w.layer) await db.put('layers', w.layer)
    return w
  }

  const input = (over: Partial<WriteInput> = {}): WriteInput => ({
    sourceName: 'earlier.jpg',
    sourceFormat: 'jpeg',
    geometry: identityGeometry({ width: 4, height: 3 }),
    adjustments: { ...NEUTRAL_ADJUSTMENTS, contrast: 12 },
    touchedAt: 1_600_000_000_000,
    width: 4,
    height: 3,
    originalPng: [1, 2, 3, 4],
    layerPng: [5, 6, 7],
    ...over,
  })

  it('only exist once installTestHooks ran (no hook in a normal build)', () => {
    delete window.__imglyTest
    expect(window.__imglyTest).toBeUndefined()
    installTestHooks(createPinia())
    for (const name of [
      'galleryRecords',
      'galleryWriteStored',
      'galleryDamage',
      'gallerySetByteBudget',
      'galleryHoldSave',
      'galleryFailNextSave',
      'galleryOpenNextVersion',
      'galleryPersistCalls',
      'galleryFailOpen',
    ] as const) {
      expect(typeof hooks()[name], name).toBe('function')
    }
  })

  it('galleryRecords reads every key per store, records without Blob bytes', async () => {
    const db = await openDb()
    const withLayer = await seedStored(db)
    const bare = await seedStored(db, false)
    await db.put('meta', { key: 'persistenceRequested' })

    const stored = await hooks().galleryRecords()

    expect(stored.works.map((w) => w.id).sort()).toEqual(
      [withLayer.record.id, bare.record.id].sort(),
    )
    expect(stored.works.find((w) => w.id === withLayer.record.id)).toMatchObject({
      sourceName: 'test-photo',
      layerId: withLayer.record.layerId,
      formatVersion: 1,
    })
    expect(stored.works.every((w) => !(w.thumbnail instanceof Blob))).toBe(true)
    expect(stored.originals.sort()).toEqual([withLayer.record.id, bare.record.id].sort())
    expect(stored.layers).toEqual([withLayer.record.id])
    expect(stored.meta).toEqual(['persistenceRequested'])
  })

  it('galleryWriteStored stores a formatVersion 1 Work that loads back as written (AC-18)', async () => {
    const id = await hooks().galleryWriteStored(input())
    expect(typeof id).toBe('string')

    const db = await openDb()
    const loaded = await loadWork(db, id)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.record).toMatchObject({
      id,
      sourceName: 'earlier.jpg',
      sourceFormat: 'jpeg',
      touchedAt: 1_600_000_000_000,
      formatVersion: 1,
      adjustments: { ...NEUTRAL_ADJUSTMENTS, contrast: 12 },
    })
    expect(loaded.value.record.layerId).not.toBeNull()
    expect(loaded.value.original.size).toBe(4)
    expect(loaded.value.layer?.size).toBe(3)

    const listed = await listWorks(db)
    expect(listed.ok && listed.value.map((w) => [w.id, w.damaged])).toEqual([[id, false]])
  })

  it('galleryWriteStored without layerPng stores no layer', async () => {
    const id = await hooks().galleryWriteStored(input({ layerPng: undefined }))
    const stored = await hooks().galleryRecords()
    expect(stored.layers).toEqual([])
    expect(stored.works.find((w) => w.id === id)?.layerId).toBeNull()
  })

  it('galleryDamage original: lists normally, fails only when chosen (AC-08)', async () => {
    const id = await hooks().galleryWriteStored(input())
    await hooks().galleryDamage(id, 'original')
    const db = await openDb()
    const listed = await listWorks(db)
    expect(listed.ok && listed.value[0]).toMatchObject({ id, damaged: false })
    const loaded = await loadWork(db, id)
    expect(!loaded.ok && loaded.error.code).toBe('WORK_DAMAGED')
  })

  it('galleryDamage thumbnail: the entry lists as damaged (AC-08)', async () => {
    const id = await hooks().galleryWriteStored(input())
    await hooks().galleryDamage(id, 'thumbnail')
    const db = await openDb()
    const listed = await listWorks(db)
    expect(listed.ok && listed.value[0]).toMatchObject({ id, damaged: true })
  })

  it('galleryDamage layer: the Work can no longer be chosen (AC-08)', async () => {
    const id = await hooks().galleryWriteStored(input())
    await hooks().galleryDamage(id, 'layer')
    const loaded = await loadWork(await openDb(), id)
    expect(!loaded.ok && loaded.error.code).toBe('WORK_DAMAGED')
  })

  it('galleryDamage record: the entry lists as damaged (AC-08)', async () => {
    const id = await hooks().galleryWriteStored(input())
    await hooks().galleryDamage(id, 'record')
    const listed = await listWorks(await openDb())
    expect(listed.ok && listed.value.find((w) => w.id === id)?.damaged).toBe(true)
  })

  it('gallerySetByteBudget smaller than one Work: STORAGE_QUOTA and nothing evicted (AC-10)', async () => {
    const db = await openDb()
    const old = await seedStored(db)
    hooks().gallerySetByteBudget(1)

    const fresh = storedWorkFixture({ record: { touchedAt: 2_000_000_000_000 } })
    const result = await storeWork(
      db,
      fresh.record,
      { original: png(100), layer: png(100), layerChanged: true },
      { keep: fresh.record.id, damaged: NONE },
    )

    expect(!result.ok && result.error.code).toBe('STORAGE_QUOTA')
    const stored = await hooks().galleryRecords()
    expect(stored.works.map((w) => w.id)).toEqual([old.record.id])
  })

  it('gallerySetByteBudget(null) lifts the budget', async () => {
    const db = await openDb()
    hooks().gallerySetByteBudget(1)
    hooks().gallerySetByteBudget(null)
    const fresh = storedWorkFixture()
    const result = await storeWork(
      db,
      fresh.record,
      { original: png(100), layer: png(100), layerChanged: true },
      { keep: fresh.record.id, damaged: NONE },
    )
    expect(result.ok).toBe(true)
  })

  it.each<HoldPoint>(['evictions', 'record', 'original', 'layer'])(
    'galleryHoldSave(%s) keeps storeWork pending (AC-19)',
    async (point) => {
      const db = await openDb()
      hooks().galleryHoldSave(point)
      const fresh = storedWorkFixture()
      const saving = storeWork(
        db,
        fresh.record,
        { original: png(10), layer: png(10), layerChanged: true },
        { keep: fresh.record.id, damaged: NONE },
      )
      expect(await settledWithin(saving, 200)).toBe(pending)
    },
  )

  it('without a hold, storeWork settles (control for the hold test)', async () => {
    const db = await openDb()
    hooks().galleryHoldSave(null)
    const fresh = storedWorkFixture()
    const saving = storeWork(
      db,
      fresh.record,
      { original: png(10), layer: png(10), layerChanged: true },
      { keep: fresh.record.id, damaged: NONE },
    )
    expect(await settledWithin(saving, 2000)).not.toBe(pending)
  })

  it('galleryFailNextSave fails one save with STORAGE_FAILED, then saves normally (AC-11)', async () => {
    const db = await openDb()
    hooks().galleryFailNextSave()
    const fresh = storedWorkFixture()
    const save = () =>
      storeWork(
        db,
        fresh.record,
        { original: png(10), layer: png(10), layerChanged: true },
        { keep: fresh.record.id, damaged: NONE },
      )

    const first = await save()
    expect(!first.ok && first.error.code).toBe('STORAGE_FAILED')
    expect((await hooks().galleryRecords()).works).toEqual([])

    expect((await save()).ok).toBe(true)
    expect((await hooks().galleryRecords()).works.map((w) => w.id)).toEqual([fresh.record.id])
  })

  it('galleryFailOpen makes openGalleryDb refuse (storage blocked)', async () => {
    const control = await openGalleryDb()
    expect(control.ok).toBe(true)
    if (control.ok) control.value.close()

    hooks().galleryFailOpen()
    const refused = await openGalleryDb()
    expect(!refused.ok && refused.error.code).toBe('STORAGE_UNAVAILABLE')
    expect(!refused.ok && refused.error.details?.reason).toBe('refused')
  })

  it('galleryOpenNextVersion gives this page a real versionchange (two tabs)', async () => {
    let first: IDBPDatabase<ImglyDb> | undefined
    const onVersionChange = vi.fn((db: IDBPDatabase<ImglyDb>) => db.close())
    const opened = await openGalleryDb({ onVersionChange })
    expect(opened.ok).toBe(true)
    if (opened.ok) first = opened.value

    await hooks().galleryOpenNextVersion()

    expect(onVersionChange).toHaveBeenCalledWith(first)
    const databases = await indexedDB.databases()
    expect(databases.find((d) => d.name === DB_NAME)?.version).toBe(LATEST_VERSION + 1)
  })

  it('galleryPersistCalls counts navigator.storage.persist() calls since load (AC-14)', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('navigator', { storage: { persist } })
    const pinia = createPinia()
    setActivePinia(pinia)
    installTestHooks(pinia)
    expect(hooks().galleryPersistCalls()).toBe(0)

    expect(await requestPersistence()).toBe(true)
    await navigator.storage.persist()

    expect(hooks().galleryPersistCalls()).toBe(2)
    expect(persist).toHaveBeenCalledTimes(2)
  })
})
