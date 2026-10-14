/**
 * Test-only fixtures for the Gallery stores. Production code never imports this. The PNGs are real
 * (a 4 x 3 and a 5 x 5 transparent image), so a codec size check passes against a 4 x 3 record.
 */
import { NEUTRAL_ADJUSTMENTS, identityGeometry } from '../../core'
import type { IDBPDatabase } from 'idb'
import { newId } from '../../shared/ids'
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
}

const ABORT_STORE = { record: 'works', original: 'originals', layer: 'layers' } as const

/** Wraps a database so `storeWork`'s writes fail or abort on demand. Test-only. */
export function withFaults(db: IDBPDatabase<ImglyDb>, faults: Faults): IDBPDatabase<ImglyDb> {
  const counts = new Map<string, number>()
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
      return wrap(tx, (txKey) => {
        if (txKey !== 'objectStore') return undefined
        return (name: string) => {
          const store = (tx.objectStore as (n: string) => object)(name)
          return wrap(store, (storeKey) => {
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
