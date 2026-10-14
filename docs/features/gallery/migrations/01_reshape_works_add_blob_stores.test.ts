// STAGED — promoted by `implement` into `src/infra/db/migrations.test.ts` next to the 0001 cases.
// The v1 cases there ("updatedAt" index, the `{ id, name, createdAt, updatedAt }` record) are
// replaced by these, deliberately, since v2 is now the latest version.
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { openDb } from './open-db'
import { LATEST_VERSION, migrations } from './migrations'

let dbCounter = 0
const freshName = () => `imgly-test-0002-${++dbCounter}`
const png = (bytes: number[]) => new Blob([new Uint8Array(bytes)], { type: 'image/png' })

const record = {
  id: '01920000-0000-7000-8000-000000000001',
  sourceName: 'test-photo',
  sourceFormat: 'jpeg' as const,
  touchedAt: 2,
  width: 4,
  height: 3,
  hasTransparency: false,
  geometry: {
    flipH: false,
    flipV: true,
    rotation: 90 as const,
    straighten: -15,
    crop: { x: 0, y: 0, width: 3, height: 4 },
  },
  adjustments: {
    brightness: 10,
    contrast: -5,
    saturation: 0,
    temperature: 3,
    tint: 0,
    grayscale: 0,
    sepia: 40,
  },
  layerId: '01920000-0000-7000-8000-0000000000aa',
  thumbnail: png([1, 2, 3]),
  formatVersion: 1,
}

describe('migration 0002-gallery', () => {
  it('brings a fresh database to v2 with the four stores and the touchedAt index', async () => {
    const db = await openDb(freshName())

    expect(db.version).toBe(LATEST_VERSION)
    expect([...db.objectStoreNames].sort()).toEqual(['layers', 'meta', 'originals', 'works'])
    const tx = db.transaction(['works', 'originals', 'layers', 'meta'])
    expect([...tx.objectStore('works').indexNames]).toEqual(['touchedAt'])
    expect(tx.objectStore('originals').keyPath).toBe('workId')
    expect(tx.objectStore('layers').keyPath).toBe('workId')
    expect(tx.objectStore('meta').keyPath).toBe('key')
    db.close()
  })

  it('upgrades a v1 database and clears its records, which can never be valid Works', async () => {
    const name = freshName()
    const v1 = await openDb(name, migrations.slice(0, 1), 1)
    await v1.put('works', { id: 'old', name: 'x', createdAt: 1, updatedAt: 1 } as never)
    v1.close()

    const db = await openDb(name)

    expect(db.version).toBe(LATEST_VERSION)
    expect(await db.count('works')).toBe(0)
    expect([...db.transaction('works').store.indexNames]).toEqual(['touchedAt'])
    db.close()
  })

  it('stores and reads every part of a Work and the persistence marker', async () => {
    const db = await openDb(freshName())
    const original = { workId: record.id, png: png([4, 5, 6]) }
    const layer = { workId: record.id, png: png([7, 8]) }

    const tx = db.transaction(['works', 'originals', 'layers', 'meta'], 'readwrite')
    await Promise.all([
      tx.objectStore('works').put(record),
      tx.objectStore('originals').put(original),
      tx.objectStore('layers').put(layer),
      tx.objectStore('meta').put({ key: 'persistenceRequested' }),
      tx.done,
    ])

    expect(await db.get('works', record.id)).toMatchObject({ ...record, thumbnail: expect.any(Blob) })
    expect(await db.getAllFromIndex('works', 'touchedAt')).toHaveLength(1)
    expect((await db.get('originals', record.id))?.workId).toBe(record.id)
    expect((await db.get('layers', record.id))?.workId).toBe(record.id)
    expect(await db.get('meta', 'persistenceRequested')).toEqual({ key: 'persistenceRequested' })
    db.close()
  })
})
