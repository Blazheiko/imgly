// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { openDb } from './open-db'
import type { ImglyDb, WorkRecord } from './schema'
import type { IDBPDatabase } from 'idb'
import { deleteWork, listWorks, loadWork, storeWork } from './works-repository'
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

  it("a stale layerChanged:false never pairs another connection's layer with this record (AC-21, AC-19)", async () => {
    const name = freshName()
    const a = await openDb(name)
    const b = await openDb(name)
    const record = workRecordFixture({ sourceName: 'from-a', touchedAt: 10, layerId: 'LA2' })
    const opts = { keep: record.id, damaged: NONE }

    await storeWork(a, record, { original: png(111), layer: png(222), layerChanged: true }, opts)
    await storeWork(
      b,
      { ...record, sourceName: 'from-b', touchedAt: 20, layerId: 'LB' },
      { original: png(111), layer: png(333), layerChanged: false },
      opts,
    )

    const loaded = await loadWork(a, record.id)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.record.layerId).toBe('LB')
    expect(loaded.value.layer!.size).toBe(333)
    a.close()
    b.close()
  })

  it('layerId set with no layer Blob and none stored is STORAGE_FAILED and stores nothing (AC-19)', async () => {
    const db = await openDb(freshName())
    await seed(db, 3)
    const before = await snapshot(db)
    const record = workRecordFixture({ touchedAt: 100, layerId: 'layer-1' })

    const result = await storeWork(db, record, blobs({ layer: null, layerChanged: false }), {
      keep: record.id,
      damaged: NONE,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('STORAGE_FAILED')
    expect(await snapshot(db)).toEqual(before)
    expect(await db.get('works', record.id)).toBeUndefined()
    db.close()
  })

  it('evicting a damaged record whose sourceName is not a string names it as an empty string (AC-09)', async () => {
    const db = await openDb(freshName())
    const ids = await seed(db, 20)
    await putRaw(db, { ...(await db.get('works', ids[0]!))!, sourceName: 42 })
    const record = workRecordFixture({ touchedAt: 100, layerId: null })

    const result = await storeWork(db, record, blobs({ layer: null }), {
      keep: ids[19]!,
      damaged: new Set([ids[0]!]),
    })

    expect(result).toEqual({ ok: true, value: { evicted: [''], firstSave: true } })
    expect(await db.get('works', ids[0]!)).toBeUndefined()
    db.close()
  })

  it('a commit refused with quota after all writes succeeded retries with one more eviction (AC-10)', async () => {
    const raw = await openDb(freshName())
    await seed(raw, 10)
    const record = workRecordFixture({ touchedAt: 100, layerId: 'layer-1' })
    const attempts: number[] = []
    const db = withFaults(raw, {
      commitFail: (n) => {
        attempts.push(n)
        return n === 1 ? 'quota' : null
      },
    })

    const result = await storeWork(db, record, blobs(), { keep: record.id, damaged: NONE })

    expect(attempts).toEqual([1, 2])
    expect(result).toEqual({ ok: true, value: { evicted: ['work-1'], firstSave: true } })
    expect(await raw.count('works')).toBe(10)
    expect(await raw.get('works', record.id)).toBeDefined()
    raw.close()
  })

  it('a commit refused with quota on every attempt is STORAGE_QUOTA with nothing changed (AC-10)', async () => {
    const raw = await openDb(freshName())
    await seed(raw, 3)
    const before = await snapshot(raw)
    const record = workRecordFixture({ touchedAt: 100, layerId: 'layer-1' })
    let attempts = 0
    const db = withFaults(raw, {
      commitFail: () => {
        attempts++
        return 'quota'
      },
    })

    const result = await storeWork(db, record, blobs(), { keep: record.id, damaged: NONE })

    expect(attempts).toBeGreaterThan(1)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('STORAGE_QUOTA')
    expect(await snapshot(raw)).toEqual(before)
    raw.close()
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

/** Puts a complete stored Work (record, Original, layer) and returns its record. */
async function putWork(db: Db, record: Partial<WorkRecord> = {}, withLayer = true) {
  const w = storedWorkFixture(withLayer ? { record } : { record, layer: null })
  await db.put('works', w.record)
  await db.put('originals', w.original)
  if (w.layer) await db.put('layers', w.layer)
  return w.record
}

/** Puts a record bypassing the types, so a damaged one can be stored. */
async function putRaw(db: Db, record: Record<string, unknown>) {
  await db.put('works', record as unknown as WorkRecord)
}

/** Wraps a database so the first `delete` on `layers` aborts its transaction. Test-only. */
function failLayerDelete(db: Db): Db {
  const bind = (t: object, v: unknown) => (typeof v === 'function' ? v.bind(t) : v)
  return new Proxy(db, {
    get(t, key) {
      if (key !== 'transaction') return bind(t, Reflect.get(t, key, t))
      return (...args: Parameters<Db['transaction']>) => {
        const tx = t.transaction(...args)
        return new Proxy(tx, {
          get(tt, txKey) {
            if (txKey !== 'objectStore') return bind(tt, Reflect.get(tt, txKey, tt))
            return (name: string) => {
              const store = (tt.objectStore as (n: string) => object)(name)
              return new Proxy(store, {
                get(st, k) {
                  if (name === 'layers' && k === 'delete') {
                    return async () => {
                      tt.abort()
                      throw new DOMException('injected', 'UnknownError')
                    }
                  }
                  return bind(st, Reflect.get(st, k, st))
                },
              })
            }
          },
        })
      }
    },
  })
}

describe('listWorks', () => {
  it('lists newest first by touchedAt (AC-06)', async () => {
    const db = await openDb(freshName())
    const ids = await seed(db, 4)

    const result = await listWorks(db)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.map((w) => w.id)).toEqual([...ids].reverse())
    expect(result.value.map((w) => w.sourceName)).toEqual(['work-4', 'work-3', 'work-2', 'work-1'])
    expect(result.value.map((w) => w.touchedAt)).toEqual([4, 3, 2, 1])
    expect(result.value.every((w) => !w.damaged && w.record !== null)).toBe(true)
    db.close()
  })

  it('breaks equal touchedAt by id, stably (descending id)', async () => {
    const db = await openDb(freshName())
    for (const id of ['b', 'c', 'a']) await putWork(db, { id, touchedAt: 5 })

    const first = await listWorks(db)
    const second = await listWorks(db)

    expect(first.ok && first.value.map((w) => w.id)).toEqual(['c', 'b', 'a'])
    expect(second).toEqual(first)
    db.close()
  })

  it('returns an empty list for an empty Gallery', async () => {
    const db = await openDb(freshName())
    expect(await listWorks(db)).toEqual({ ok: true, value: [] })
    db.close()
  })

  it('a damaged Original lists normally; only loadWork fails (AC-08)', async () => {
    const db = await openDb(freshName())
    const good = await putWork(db, { touchedAt: 1 })
    const w = storedWorkFixture({ record: { touchedAt: 2 } })
    await db.put('works', w.record) // no Original stored
    await db.put('layers', w.layer!)

    const listed = await listWorks(db)

    expect(listed.ok).toBe(true)
    if (!listed.ok) return
    expect(listed.value.map((x) => [x.id, x.damaged])).toEqual([
      [w.record.id, false],
      [good.id, false],
    ])
    const loaded = await loadWork(db, w.record.id)
    expect(loaded.ok).toBe(false)
    if (!loaded.ok) expect(loaded.error.code).toBe('WORK_DAMAGED')
    db.close()
  })

  it.each([
    ['a bad shape', { width: 'wide' }],
    ['a missing thumbnail', { thumbnail: undefined }],
    ['a non-PNG thumbnail', { thumbnail: new Blob([new Uint8Array(4)], { type: 'image/jpeg' }) }],
    ['a thumbnail that is not a Blob', { thumbnail: 'data:image/png;base64,AAAA' }],
  ])('%s marks only that entry damaged (AC-08)', async (_label, damage) => {
    const db = await openDb(freshName())
    const before = await putWork(db, { touchedAt: 1 })
    const bad = storedWorkFixture({ record: { touchedAt: 2 } })
    await putRaw(db, { ...bad.record, ...damage })
    const after = await putWork(db, { touchedAt: 3 })

    const listed = await listWorks(db)

    expect(listed.ok).toBe(true)
    if (!listed.ok) return
    expect(listed.value.map((x) => [x.id, x.damaged])).toEqual([
      [after.id, false],
      [bad.record.id, true],
      [before.id, false],
    ])
    expect(listed.value[1]!.touchedAt).toBe(2)
    db.close()
  })

  it('sourceName that is not a string lists as an empty string, damaged', async () => {
    const db = await openDb(freshName())
    const w = storedWorkFixture({ record: { touchedAt: 2 } })
    await putRaw(db, { ...w.record, sourceName: 42 })

    const listed = await listWorks(db)

    expect(listed.ok).toBe(true)
    if (!listed.ok) return
    expect(listed.value[0]).toMatchObject({ id: w.record.id, sourceName: '', damaged: true })
    db.close()
  })

  it('does not read the Original or the layer', async () => {
    const db = await openDb(freshName())
    await seed(db, 2)
    const stores: string[][] = []
    const spy = new Proxy(db, {
      get(t, key) {
        const v = Reflect.get(t, key, t)
        if (key !== 'transaction') return typeof v === 'function' ? v.bind(t) : v
        return (names: string | string[], ...rest: unknown[]) => {
          stores.push([names].flat())
          return (v as (...a: unknown[]) => unknown).call(t, names, ...rest)
        }
      },
    })

    await listWorks(spy)

    const touched = new Set(stores.flat())
    expect(touched.has('originals')).toBe(false)
    expect(touched.has('layers')).toBe(false)
    db.close()
  })
})

describe('loadWork', () => {
  it('returns the record, the Original and the layer (AC-08)', async () => {
    const db = await openDb(freshName())
    const [id] = await seed(db, 1)

    const result = await loadWork(db, id!)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.record.id).toBe(id)
    expect(result.value.original.size).toBe(10)
    expect(result.value.layer!.size).toBe(20)
    db.close()
  })

  it('returns layer null when layerId is null and no layer is stored', async () => {
    const db = await openDb(freshName())
    const record = await putWork(db, {}, false)

    const result = await loadWork(db, record.id)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.layer).toBeNull()
    db.close()
  })

  it('an unknown id is WORK_DAMAGED', async () => {
    const db = await openDb(freshName())
    const result = await loadWork(db, 'nope')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WORK_DAMAGED')
    db.close()
  })

  it('a missing Original is WORK_DAMAGED', async () => {
    const db = await openDb(freshName())
    const w = storedWorkFixture()
    await db.put('works', w.record)
    await db.put('layers', w.layer!)
    const result = await loadWork(db, w.record.id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WORK_DAMAGED')
    db.close()
  })

  it('layerId set but no layer stored is WORK_DAMAGED', async () => {
    const db = await openDb(freshName())
    const w = storedWorkFixture()
    await db.put('works', w.record)
    await db.put('originals', w.original)
    const result = await loadWork(db, w.record.id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WORK_DAMAGED')
    db.close()
  })

  it('layerId null but a layer stored is WORK_DAMAGED', async () => {
    const db = await openDb(freshName())
    const w = storedWorkFixture({ layer: null })
    await db.put('works', w.record)
    await db.put('originals', w.original)
    await db.put('layers', { workId: w.record.id, png: png(5) })
    const result = await loadWork(db, w.record.id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WORK_DAMAGED')
    db.close()
  })

  it.each([
    ['a thumbnail that is not a PNG', () => new Blob([new Uint8Array(3)], { type: 'image/jpeg' })],
    ['a thumbnail that is not a Blob', () => 'thumb'],
  ])('%s is WORK_DAMAGED: choosing checks all of it (AC-08)', async (_label, thumbnail) => {
    const db = await openDb(freshName())
    const w = storedWorkFixture()
    await db.put('works', { ...w.record, thumbnail: thumbnail() } as WorkRecord)
    await db.put('originals', w.original)
    await db.put('layers', w.layer!)
    const result = await loadWork(db, w.record.id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WORK_DAMAGED')
    db.close()
  })
})

describe('deleteWork', () => {
  it('removes the record, Original and layer and leaves other Works untouched (AC-06)', async () => {
    const db = await openDb(freshName())
    const ids = await seed(db, 3)
    const others = (await snapshot(db)).works.filter((w) => w.id !== ids[1])

    const result = await deleteWork(db, ids[1]!, { keep: 'open-elsewhere' })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await db.get('works', ids[1]!)).toBeUndefined()
    expect(await db.get('originals', ids[1]!)).toBeUndefined()
    expect(await db.get('layers', ids[1]!)).toBeUndefined()
    expect((await snapshot(db)).works).toEqual(others)
    expect(await db.count('originals')).toBe(2)
    expect(await db.count('layers')).toBe(2)
    db.close()
  })

  it('refuses the open Work and removes nothing (AC-07)', async () => {
    const db = await openDb(freshName())
    const ids = await seed(db, 2)
    const before = await snapshot(db)

    const result = await deleteWork(db, ids[0]!, { keep: ids[0]! })

    expect(result.ok).toBe(false)
    expect(await snapshot(db)).toEqual(before)
    db.close()
  })

  it('refuses keep without touching the database (AC-07)', async () => {
    const transaction = vi.fn()
    const fake = { transaction } as unknown as Db

    const result = await deleteWork(fake, 'w1', { keep: 'w1' })

    expect(result.ok).toBe(false)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('a damaged Work (no Original) is deleted, removing whatever parts exist (AC-08)', async () => {
    const db = await openDb(freshName())
    const w = storedWorkFixture()
    await db.put('works', w.record)
    await db.put('layers', w.layer!)

    const result = await deleteWork(db, w.record.id, { keep: 'other' })

    expect(result.ok).toBe(true)
    expect(await db.count('works')).toBe(0)
    expect(await db.count('layers')).toBe(0)
    db.close()
  })

  it('a fault returns STORAGE_FAILED with all three parts still present', async () => {
    const raw = await openDb(freshName())
    const ids = await seed(raw, 2)
    const before = await snapshot(raw)

    const result = await deleteWork(failLayerDelete(raw), ids[0]!, { keep: 'other' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('STORAGE_FAILED')
    expect(await snapshot(raw)).toEqual(before)
    raw.close()
  })
})
