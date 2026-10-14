// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { openDb } from './open-db'
import type { ImglyDb } from './schema'
import type { IDBPDatabase } from 'idb'
import { storeWork } from './works-repository'
import { storedWorkFixture, workRecordFixture, withFaults } from './testing'

let dbCounter = 0
const freshName = () => `imgly-works-repo-${++dbCounter}`
const png = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/png' })
const NONE = new Set<string>()

type Db = IDBPDatabase<ImglyDb>

/** Seeds `count` complete Works, touchedAt 1..count, named `work-<i>`; returns their ids oldest first. */
async function seed(db: Db, count: number): Promise<string[]> {
  const ids: string[] = []
  for (let i = 1; i <= count; i++) {
    const w = storedWorkFixture({ record: { sourceName: `work-${i}`, touchedAt: i } })
    await db.put('works', w.record)
    await db.put('originals', { workId: w.record.id, png: png(10) })
    await db.put('layers', { workId: w.record.id, png: png(20) })
    ids.push(w.record.id)
  }
  return ids
}

/** Everything observable in the four stores; blobs reduced to their sizes. */
async function snapshot(db: Db) {
  const works = (await db.getAll('works')).map((r) => ({ ...r, thumbnail: r.thumbnail.size }))
  const originals = (await db.getAll('originals')).map((r) => [r.workId, r.png.size])
  const layers = (await db.getAll('layers')).map((r) => [r.workId, r.png.size])
  const meta = await db.getAll('meta')
  const byKey = (a: unknown, b: unknown) => JSON.stringify(a).localeCompare(JSON.stringify(b))
  return {
    works: works.sort(byKey),
    originals: originals.sort(byKey),
    layers: layers.sort(byKey),
    meta,
  }
}

const blobs = (over: Partial<{ layer: Blob | null; layerChanged: boolean }> = {}) => ({
  original: png(111),
  layer: png(222) as Blob | null,
  layerChanged: true,
  ...over,
})

async function markPersistenceRequested(db: Db) {
  await db.put('meta', { key: 'persistenceRequested' })
}

describe('storeWork', () => {
  it('19 stored: a first save evicts nothing, stores 20, reports firstSave when no marker', async () => {
    const db = await openDb(freshName())
    await seed(db, 19)
    const record = workRecordFixture({ touchedAt: 100, layerId: 'layer-1' })

    const result = await storeWork(db, record, blobs(), { keep: record.id, damaged: NONE })

    expect(result).toEqual({ ok: true, value: { evicted: [], firstSave: true } })
    expect(await db.count('works')).toBe(20)
    expect((await db.get('originals', record.id))!.png.size).toBe(111)
    expect((await db.get('layers', record.id))!.png.size).toBe(222)
    db.close()
  })

  it('20 stored: the oldest Work other than keep is evicted in the same commit and named (AC-09)', async () => {
    const db = await openDb(freshName())
    const ids = await seed(db, 20)
    const record = workRecordFixture({ touchedAt: 100, layerId: null })

    const result = await storeWork(db, record, blobs({ layer: null }), {
      keep: ids[19]!,
      damaged: NONE,
    })

    expect(result).toEqual({ ok: true, value: { evicted: ['work-1'], firstSave: true } })
    expect(await db.count('works')).toBe(20)
    expect(await db.get('works', ids[0]!)).toBeUndefined()
    expect(await db.get('originals', ids[0]!)).toBeUndefined()
    expect(await db.get('layers', ids[0]!)).toBeUndefined()
    expect(await db.get('works', record.id)).toBeDefined()
    expect(await db.get('works', ids[19]!)).toBeDefined()
    db.close()
  })

  it('never evicts keep even when it is the oldest (AC-09)', async () => {
    const db = await openDb(freshName())
    const ids = await seed(db, 20)
    const record = workRecordFixture({ touchedAt: 100, layerId: null })

    const result = await storeWork(db, record, blobs({ layer: null }), {
      keep: ids[0]!,
      damaged: NONE,
    })

    expect(result).toEqual({ ok: true, value: { evicted: ['work-2'], firstSave: true } })
    expect(await db.get('works', ids[0]!)).toBeDefined()
    db.close()
  })

  it('quota on attempts 1 and 2: attempt 3 evicts two, commits, and names both once (AC-10)', async () => {
    const name = freshName()
    const raw = await openDb(name)
    await seed(raw, 10)
    const record = workRecordFixture({ touchedAt: 100, layerId: 'layer-1' })
    const db = withFaults(raw, {
      failPut: (store, n) => (store === 'works' && n <= 2 ? 'quota' : null),
    })

    const result = await storeWork(db, record, blobs(), { keep: record.id, damaged: NONE })

    expect(result).toEqual({
      ok: true,
      value: { evicted: ['work-1', 'work-2'], firstSave: true },
    })
    expect(await raw.count('works')).toBe(9)
    expect(await raw.get('works', record.id)).toBeDefined()
    raw.close()
  })

  it('quota on every attempt: STORAGE_QUOTA, nothing evicted, earlier state of this id unchanged (AC-10)', async () => {
    const raw = await openDb(freshName())
    await seed(raw, 5)
    const earlier = storedWorkFixture({ record: { sourceName: 'open', touchedAt: 50 } })
    await raw.put('works', earlier.record)
    await raw.put('originals', { workId: earlier.record.id, png: png(7) })
    await raw.put('layers', { workId: earlier.record.id, png: png(8) })
    await markPersistenceRequested(raw)
    const before = await snapshot(raw)
    const db = withFaults(raw, { failPut: (store) => (store === 'works' ? 'quota' : null) })

    const result = await storeWork(
      db,
      { ...earlier.record, touchedAt: 200, sourceName: 'open-new' },
      blobs(),
      { keep: earlier.record.id, damaged: NONE },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('STORAGE_QUOTA')
    expect(await snapshot(raw)).toEqual(before)
    raw.close()
  })

  it.each(['evictions', 'record', 'original', 'layer'] as const)(
    'abort after %s leaves the database as before; a first save leaves the Work absent (AC-19)',
    async (abortAfter) => {
      const raw = await openDb(freshName())
      await seed(raw, 20)
      const before = await snapshot(raw)
      const record = workRecordFixture({ touchedAt: 100, layerId: 'layer-1' })
      const db = withFaults(raw, { abortAfter })

      const result = await storeWork(db, record, blobs(), { keep: record.id, damaged: NONE })

      expect(result.ok).toBe(false)
      expect(await snapshot(raw)).toEqual(before)
      expect(await raw.get('works', record.id)).toBeUndefined()
      expect(await raw.get('originals', record.id)).toBeUndefined()
      expect(await raw.get('layers', record.id)).toBeUndefined()
      raw.close()
    },
  )

  it('a Work missing from the store is written back with record, Original and layer (AC-21)', async () => {
    const db = await openDb(freshName())
    const ids = await seed(db, 20)
    const record = workRecordFixture({ touchedAt: 500, layerId: 'layer-1' })

    const result = await storeWork(db, record, blobs(), { keep: record.id, damaged: NONE })

    expect(result).toEqual({ ok: true, value: { evicted: ['work-1'], firstSave: true } })
    expect(await db.get('works', ids[0]!)).toBeUndefined()
    expect((await db.get('works', record.id))!.touchedAt).toBe(500)
    expect((await db.get('originals', record.id))!.png.size).toBe(111)
    expect((await db.get('layers', record.id))!.png.size).toBe(222)
    db.close()
  })

  it('the same id saved by two connections in turn stores the later record (AC-21)', async () => {
    const name = freshName()
    const a = await openDb(name)
    const b = await openDb(name)
    const record = workRecordFixture({ sourceName: 'from-a', touchedAt: 10, layerId: null })
    const opts = { keep: record.id, damaged: NONE }

    await storeWork(a, record, blobs({ layer: null }), opts)
    await storeWork(
      b,
      { ...record, sourceName: 'from-b', touchedAt: 20 },
      blobs({ layer: null }),
      opts,
    )

    const stored = await a.get('works', record.id)
    expect(stored!.sourceName).toBe('from-b')
    expect(stored!.touchedAt).toBe(20)
    expect(await a.count('works')).toBe(1)
    a.close()
    b.close()
  })

  it('writes the persistence marker on the first save and calls onFirstSave once (AC-14)', async () => {
    const db = await openDb(freshName())
    const onFirstSave = vi.fn()
    const record = workRecordFixture({ layerId: null })

    const result = await storeWork(db, record, blobs({ layer: null }), {
      keep: record.id,
      damaged: NONE,
      onFirstSave,
    })

    expect(result.ok && result.value.firstSave).toBe(true)
    expect(onFirstSave).toHaveBeenCalledTimes(1)
    expect(await db.get('meta', 'persistenceRequested')).toEqual({ key: 'persistenceRequested' })
    db.close()
  })

  it('does not call onFirstSave when the marker is present (AC-14)', async () => {
    const db = await openDb(freshName())
    await markPersistenceRequested(db)
    const onFirstSave = vi.fn()
    const record = workRecordFixture({ layerId: null })

    const result = await storeWork(db, record, blobs({ layer: null }), {
      keep: record.id,
      damaged: NONE,
      onFirstSave,
    })

    expect(result).toEqual({ ok: true, value: { evicted: [], firstSave: false } })
    expect(onFirstSave).not.toHaveBeenCalled()
    db.close()
  })

  it('keeps a stored Original and layer when nothing changed', async () => {
    const db = await openDb(freshName())
    const w = storedWorkFixture()
    await db.put('works', w.record)
    await db.put('originals', { workId: w.record.id, png: png(7) })
    await db.put('layers', { workId: w.record.id, png: png(8) })

    await storeWork(db, { ...w.record, touchedAt: 9 }, blobs({ layerChanged: false }), {
      keep: w.record.id,
      damaged: NONE,
    })

    expect((await db.get('originals', w.record.id))!.png.size).toBe(7)
    expect((await db.get('layers', w.record.id))!.png.size).toBe(8)
    expect((await db.get('works', w.record.id))!.touchedAt).toBe(9)
    db.close()
  })

  it('replaces the layer when it changed', async () => {
    const db = await openDb(freshName())
    const w = storedWorkFixture()
    await db.put('works', w.record)
    await db.put('originals', { workId: w.record.id, png: png(7) })
    await db.put('layers', { workId: w.record.id, png: png(8) })

    await storeWork(db, w.record, blobs({ layerChanged: true }), {
      keep: w.record.id,
      damaged: NONE,
    })

    expect((await db.get('layers', w.record.id))!.png.size).toBe(222)
    db.close()
  })

  it('deletes the layer entry when layerId became null', async () => {
    const db = await openDb(freshName())
    const w = storedWorkFixture()
    await db.put('works', w.record)
    await db.put('originals', { workId: w.record.id, png: png(7) })
    await db.put('layers', { workId: w.record.id, png: png(8) })

    await storeWork(
      db,
      { ...w.record, layerId: null },
      blobs({ layer: null, layerChanged: true }),
      {
        keep: w.record.id,
        damaged: NONE,
      },
    )

    expect(await db.get('layers', w.record.id)).toBeUndefined()
    expect(await db.get('works', w.record.id)).toBeDefined()
    db.close()
  })

  it('a non-quota error returns STORAGE_FAILED and changes nothing', async () => {
    const raw = await openDb(freshName())
    await seed(raw, 20)
    const before = await snapshot(raw)
    const record = workRecordFixture({ layerId: 'layer-1' })
    const db = withFaults(raw, { failPut: (store) => (store === 'originals' ? 'other' : null) })

    const result = await storeWork(db, record, blobs(), { keep: record.id, damaged: NONE })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('STORAGE_FAILED')
    expect(await snapshot(raw)).toEqual(before)
    raw.close()
  })
})
