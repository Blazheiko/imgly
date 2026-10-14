import type { IDBPDatabase } from 'idb'
import {
  appError,
  err,
  evictionCandidates,
  ok,
  validateRecordShape,
  type AppError,
  type Result,
} from '../../core'
import type { ImglyDb, WorkRecord } from './schema'

export interface StoreWorkBlobs {
  original: Blob
  layer: Blob | null
  layerChanged: boolean
}

export interface StoreWorkOptions {
  keep: string
  damaged: ReadonlySet<string>
  /** Called synchronously once the first save has committed, so the caller can ask for `persist()`. */
  onFirstSave?: () => void
}

export interface StoreWorkOutcome {
  /** Source names of the evicted Works, in eviction order. */
  evicted: string[]
  firstSave: boolean
}

const MARKER = 'persistenceRequested'

function isQuota(e: unknown): boolean {
  return (e as { name?: string } | null)?.name === 'QuotaExceededError'
}

/**
 * Evicts to make room and stores the Work in one read-write transaction (gallery ADR-0004). A full
 * quota aborts the whole transaction and retries with one more eviction, until the Work fits alone.
 */
export async function storeWork(
  db: IDBPDatabase<ImglyDb>,
  record: WorkRecord,
  blobs: StoreWorkBlobs,
  opts: StoreWorkOptions,
): Promise<Result<StoreWorkOutcome, AppError>> {
  let previous = -1
  for (let extra = 0; ; extra++) {
    const tx = db.transaction(['works', 'originals', 'layers', 'meta'], 'readwrite')
    const done = tx.done
    done.catch(() => {})
    try {
      const works = tx.objectStore('works')
      const originals = tx.objectStore('originals')
      const layers = tx.objectStore('layers')
      const meta = tx.objectStore('meta')

      const records = await works.getAll()
      const ids = evictionCandidates(records, {
        keep: opts.keep,
        damaged: opts.damaged,
        extra,
        incoming: record.id,
      })
      if (ids.length <= previous) return err(appError('STORAGE_QUOTA'))
      previous = ids.length
      const names = new Map(records.map((r) => [r.id, r.sourceName]))

      for (const id of ids) {
        await Promise.all([works.delete(id), originals.delete(id), layers.delete(id)])
      }
      await works.put(record)
      if ((await originals.getKey(record.id)) === undefined) {
        await originals.put({ workId: record.id, png: blobs.original })
      }
      if (record.layerId === null) {
        await layers.delete(record.id)
      } else if (
        blobs.layer &&
        (blobs.layerChanged || (await layers.getKey(record.id)) === undefined)
      ) {
        await layers.put({ workId: record.id, png: blobs.layer })
      }
      const firstSave = (await meta.get(MARKER)) === undefined
      if (firstSave) await meta.put({ key: MARKER })

      await done
      if (firstSave) opts.onFirstSave?.()
      return ok({ evicted: ids.map((id) => names.get(id) ?? ''), firstSave })
    } catch (e) {
      if (isQuota(e) || isQuota(tx.error)) {
        // The transaction is aborted, so nothing changed; try again with one more eviction.
        await done.catch(() => {})
        continue
      }
      return err(appError('STORAGE_FAILED'))
    }
  }
}

export interface ListedWork {
  id: string
  /** The record when it is usable; null when the shape or thumbnail check failed. */
  record: WorkRecord | null
  sourceName: string
  touchedAt: number
  damaged: boolean
}

export interface LoadedWork {
  record: WorkRecord
  original: Blob
  layer: Blob | null
}

/** Lists the Gallery newest first, reading only `works` and checking only shape and thumbnail. */
export async function listWorks(
  db: IDBPDatabase<ImglyDb>,
): Promise<Result<ListedWork[], AppError>> {
  try {
    const raw: unknown[] = await db.getAllFromIndex('works', 'touchedAt')
    const listed = raw.reverse().map((r): ListedWork => {
      const o = r as Partial<WorkRecord>
      const thumb: unknown = o.thumbnail
      const damaged =
        !validateRecordShape(r) || !(thumb instanceof Blob) || thumb.type !== 'image/png'
      return {
        id: String(o.id),
        record: damaged ? null : (r as WorkRecord),
        sourceName: typeof o.sourceName === 'string' ? o.sourceName : '',
        touchedAt: o.touchedAt as number,
        damaged,
      }
    })
    return ok(listed)
  } catch {
    return err(appError('STORAGE_FAILED'))
  }
}

/** Reads every part of a Work; a missing part or a layer/layerId mismatch is WORK_DAMAGED. */
export async function loadWork(
  db: IDBPDatabase<ImglyDb>,
  id: string,
): Promise<Result<LoadedWork, AppError>> {
  try {
    const tx = db.transaction(['works', 'originals', 'layers'], 'readonly')
    const [record, original, layer] = await Promise.all([
      tx.objectStore('works').get(id),
      tx.objectStore('originals').get(id),
      tx.objectStore('layers').get(id),
    ])
    await tx.done
    const damaged = (reason: string) => err(appError('WORK_DAMAGED', { reason }))
    if (!record) return damaged('missing-record')
    if (!original) return damaged('missing-original')
    if ((record.layerId !== null) !== (layer !== undefined)) return damaged('layer-mismatch')
    return ok({ record, original: original.png, layer: layer ? layer.png : null })
  } catch {
    return err(appError('STORAGE_FAILED'))
  }
}

/** Deletes all three parts of a Work in one transaction; never the Work open in this tab. */
export async function deleteWork(
  db: IDBPDatabase<ImglyDb>,
  id: string,
  opts: { keep: string },
): Promise<Result<void, AppError>> {
  if (id === opts.keep) return err(appError('STORAGE_FAILED', { reason: 'open-work' }))
  try {
    const tx = db.transaction(['works', 'originals', 'layers'], 'readwrite')
    tx.done.catch(() => {})
    const deletes = [
      tx.objectStore('works').delete(id),
      tx.objectStore('originals').delete(id),
      tx.objectStore('layers').delete(id),
    ]
    // Promise.all reports only the first rejection; silence the rest so an abort stays handled.
    for (const d of deletes) d.catch(() => {})
    await Promise.all(deletes)
    await tx.done
    return ok(undefined)
  } catch {
    return err(appError('STORAGE_FAILED'))
  }
}
