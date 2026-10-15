/**
 * Test-only fixtures for the Gallery stores. Production code never imports this. The PNGs are real
 * (a 4 x 3 and a 5 x 5 transparent image), so a codec size check passes against a 4 x 3 record.
 */
import { NEUTRAL_ADJUSTMENTS, identityGeometry } from '../../core'
import type { IDBPDatabase } from 'idb'
import { newId } from '../../shared/ids'
import { openDb, DB_NAME } from './open-db'
import { LATEST_VERSION, migrations } from './migrations'
import type { ImglyDb, WorkBlobRecord, WorkRecord } from './schema'

const PNG_4X3 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAADElEQVR4nGNgIBkAAAAzAAGHXpxVAAAAAElFTkSuQmCC'
const PNG_5X5 =
  'iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAADElEQVR4nGNgoBMAAABpAAERPu2nAAAAAElFTkSuQmCC'

const FIXTURE_TOUCHED_AT = 1_700_000_000_000

function pngBlob(base64: string): Blob {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: 'image/png' })
}

/** A valid `WorkRecord` (4 x 3, no layer). */
export function workRecordFixture(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: newId(),
    sourceName: 'test-photo',
    sourceFormat: 'jpeg',
    touchedAt: FIXTURE_TOUCHED_AT,
    width: 4,
    height: 3,
    hasTransparency: false,
    geometry: identityGeometry({ width: 4, height: 3 }),
    adjustments: { ...NEUTRAL_ADJUSTMENTS },
    layerId: null,
    thumbnail: pngBlob(PNG_4X3),
    formatVersion: 1,
    ...overrides,
  }
}

export interface StoredWorkFixture {
  record: WorkRecord
  original: WorkBlobRecord
  layer: WorkBlobRecord | null
}

/** A stored Work as read back, possibly missing its Original. */
export interface DamagedWorkFixture extends Omit<StoredWorkFixture, 'original'> {
  original: WorkBlobRecord | null
}

export interface StoredWorkOverrides {
  record?: Partial<WorkRecord>
  /** `null` stores the Work without a Drawing layer (and sets `layerId` to `null`). */
  layer?: null
}

/** A stored Work: record, Original and (by default) a layer, linked by `workId`. */
export function storedWorkFixture(overrides: StoredWorkOverrides = {}): StoredWorkFixture {
  const withLayer = overrides.layer !== null
  const record = workRecordFixture({
    layerId: withLayer ? newId() : null,
    ...overrides.record,
  })
  if (!withLayer) record.layerId = null
  return {
    record,
    original: { workId: record.id, png: pngBlob(PNG_4X3) },
    layer: withLayer ? { workId: record.id, png: pngBlob(PNG_4X3) } : null,
  }
}

export type DamageKind =
  | 'missing-original'
  | 'layer-without-record-id'
  | 'size-mismatch'
  | 'bad-geometry'
  | 'unknown-format-version'

/** A stored Work broken in exactly one way. */
export function damagedWorkFixture(kind: DamageKind): DamagedWorkFixture {
  const work = storedWorkFixture()
  switch (kind) {
    case 'missing-original':
      return { ...work, original: null }
    case 'layer-without-record-id':
      return { ...work, record: { ...work.record, layerId: null } }
    case 'size-mismatch':
      return { ...work, original: { workId: work.record.id, png: pngBlob(PNG_5X5) } }
    case 'bad-geometry':
      return {
        ...work,
        record: {
          ...work.record,
          geometry: { ...work.record.geometry, crop: { x: 0, y: 0, width: 99, height: 99 } },
        },
      }
    case 'unknown-format-version':
      return { ...work, record: { ...work.record, formatVersion: 999 } }
  }
}

export interface Faults {
  /** Fails the `n`th (1-based, lifetime) `put` on a store, aborting its transaction. */
  failPut?: (store: string, n: number) => 'quota' | 'other' | null
  /** Aborts the transaction once the evictions are done, or right after the named write. */
  abortAfter?: 'evictions' | 'record' | 'original' | 'layer'
  /**
   * Called once per transaction (1-based). Returning 'quota' lets every request succeed, then aborts
   * the transaction after the last write and makes `tx.done` reject with a QuotaExceededError, as a
   * browser does when the commit itself is refused.
   */
  commitFail?: (attempt: number) => 'quota' | null
}

const ABORT_STORE = { record: 'works', original: 'originals', layer: 'layers' } as const

/** Wraps a database so `storeWork`'s writes fail or abort on demand. Test-only. */
export function withFaults(db: IDBPDatabase<ImglyDb>, faults: Faults): IDBPDatabase<ImglyDb> {
  const counts = new Map<string, number>()
  let attempts = 0
  const wrap = <T extends object>(target: T, intercept: (key: string | symbol) => unknown): T =>
    new Proxy(target, {
      get(t, key) {
        const hit = intercept(key)
        if (hit !== undefined) return hit
        const value = Reflect.get(t, key, t)
        return typeof value === 'function' ? value.bind(t) : value
      },
    })

  return wrap(db, (key) => {
    if (key !== 'transaction') return undefined
    return (...args: Parameters<typeof db.transaction>) => {
      const tx = db.transaction(...args)
      const commitFails = faults.commitFail?.(++attempts) === 'quota'
      return wrap(tx, (txKey) => {
        if (txKey === 'done' && commitFails) {
          const refused = () => {
            throw new DOMException('commit refused', 'QuotaExceededError')
          }
          return tx.done.then(refused, refused)
        }
        if (txKey !== 'objectStore') return undefined
        return (name: string) => {
          const store = (tx.objectStore as (n: string) => object)(name)
          return wrap(store, (storeKey) => {
            // A save ends at the marker: it reads it, and writes it only on a first save. The
            // refused commit aborts after that last step, whichever it is (R2-7).
            if (commitFails && name === 'meta' && (storeKey === 'get' || storeKey === 'put')) {
              const op = (store as Record<string, (v: unknown) => Promise<unknown>>)[storeKey]!
              return async (value: unknown) => {
                const result = await op.call(store, value)
                if (storeKey === 'put' || result !== undefined) tx.abort()
                return result
              }
            }
            if (storeKey !== 'put') return undefined
            return async (value: unknown) => {
              const n = (counts.get(name) ?? 0) + 1
              counts.set(name, n)
              if (faults.abortAfter === 'evictions' && name === 'works') {
                tx.abort()
                throw new DOMException('aborted before the record', 'AbortError')
              }
              const fail = faults.failPut?.(name, n)
              if (fail) {
                tx.abort()
                throw new DOMException(
                  'injected',
                  fail === 'quota' ? 'QuotaExceededError' : 'UnknownError',
                )
              }
              const result = await (store as { put: (v: unknown) => Promise<unknown> }).put(value)
              const after = faults.abortAfter
              if (after && after !== 'evictions' && ABORT_STORE[after] === name) {
                tx.abort()
                throw new DOMException('aborted after the write', 'AbortError')
              }
              return result
            }
          })
        }
      })
    }
  })
}

export { saveFaults } from './works-repository'
export { setOpenRefusal } from './open-db'

/** Every stored key per store; records come without their Blob bytes. Test-only. */
export async function readStoredKeys(): Promise<{
  works: Omit<WorkRecord, 'thumbnail'>[]
  originals: string[]
  layers: string[]
  meta: string[]
}> {
  const db = await openDb()
  try {
    const [works, originals, layers, meta] = await Promise.all([
      db.getAll('works'),
      db.getAllKeys('originals'),
      db.getAllKeys('layers'),
      db.getAllKeys('meta'),
    ])
    return {
      works: works.map((w) => {
        const rest: Partial<WorkRecord> = { ...w }
        delete rest.thumbnail
        return rest as Omit<WorkRecord, 'thumbnail'>
      }),
      originals,
      layers,
      meta,
    }
  } finally {
    db.close()
  }
}

export interface StoredWorkInput {
  sourceName: string
  sourceFormat: string
  geometry: WorkRecord['geometry']
  adjustments: WorkRecord['adjustments']
  touchedAt: number
  width?: number
  height?: number
  hasTransparency?: boolean
  originalPng: number[]
  layerPng?: number[]
}

const bytesBlob = (bytes: number[]) => new Blob([new Uint8Array(bytes)], { type: 'image/png' })

/** Writes one Work in the `formatVersion: 1` layout straight into the stores; returns its id. */
export async function writeStoredWork(input: StoredWorkInput): Promise<string> {
  const record: WorkRecord = {
    id: newId(),
    sourceName: input.sourceName,
    sourceFormat: input.sourceFormat as WorkRecord['sourceFormat'],
    touchedAt: input.touchedAt,
    width: input.width ?? 4,
    height: input.height ?? 3,
    hasTransparency: input.hasTransparency ?? false,
    geometry: input.geometry,
    adjustments: input.adjustments,
    layerId: input.layerPng ? newId() : null,
    thumbnail: pngBlob(PNG_4X3),
    formatVersion: 1,
  }
  const db = await openDb()
  try {
    const tx = db.transaction(['works', 'originals', 'layers'], 'readwrite')
    void tx.objectStore('works').put(record)
    void tx.objectStore('originals').put({ workId: record.id, png: bytesBlob(input.originalPng) })
    if (input.layerPng) {
      void tx.objectStore('layers').put({ workId: record.id, png: bytesBlob(input.layerPng) })
    }
    await tx.done
  } finally {
    db.close()
  }
  return record.id
}

/**
 * Breaks one stored part of a Work: deletes its Original or layer, or corrupts its record. A
 * `thumbnail` is no longer a PNG Blob (listing sees it); `thumbnail-bytes` is typed image/png but
 * will not decode (only the browser's image load sees it).
 */
export async function damageStoredPart(
  id: string,
  part: 'original' | 'layer' | 'thumbnail' | 'thumbnail-bytes' | 'record',
): Promise<void> {
  const db = await openDb()
  try {
    if (part === 'original') await db.delete('originals', id)
    else if (part === 'layer') await db.delete('layers', id)
    else {
      const record = await db.get('works', id)
      if (!record) return
      const broken =
        part === 'thumbnail'
          ? { ...record, thumbnail: new Blob([new Uint8Array(1)], { type: 'text/plain' }) }
          : part === 'thumbnail-bytes'
            ? {
                ...record,
                thumbnail: new Blob([new Uint8Array(64).fill(7)], { type: 'image/png' }),
              }
            : { ...record, width: 'broken' as unknown as number }
      await db.put('works', broken)
    }
  } finally {
    db.close()
  }
}

/** Opens the database at `LATEST_VERSION + 1`, as a newer app version in another tab would. */
export async function openNextVersion(): Promise<void> {
  const db = await openDb(DB_NAME, migrations, LATEST_VERSION + 1)
  db.close()
}
