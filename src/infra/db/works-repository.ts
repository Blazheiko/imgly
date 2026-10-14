import type { IDBPDatabase } from 'idb'
import { appError, err, evictionCandidates, ok, type AppError, type Result } from '../../core'
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
