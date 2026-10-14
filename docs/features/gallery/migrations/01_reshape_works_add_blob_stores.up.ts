// STAGED — promoted by `implement` to `src/infra/db/migrations/0002-gallery.ts` and appended to
// `migrations` in `migrations/index.ts`. Not compiled, linted or tested from here.
import type { Migration } from './index'

/**
 * Gallery (gallery ADR-0002): a Work is a small `works` record plus its Original and Drawing layer
 * as PNG Blobs in `originals` and `layers`, keyed by the Work's id, and `meta` holds the
 * persistent-storage marker. `works` trades its `updatedAt` index for `touchedAt`. Nothing ever
 * wrote a v1 record, and one could never be a valid Work (it has no Original), so the store is
 * cleared rather than converted.
 */
export const gallery: Migration = {
  version: 2,
  upgrade(db, tx) {
    const works = tx.objectStore('works')
    works.deleteIndex('updatedAt')
    works.createIndex('touchedAt', 'touchedAt')
    void works.clear()
    db.createObjectStore('originals', { keyPath: 'workId' })
    db.createObjectStore('layers', { keyPath: 'workId' })
    db.createObjectStore('meta', { keyPath: 'key' })
  },
}
