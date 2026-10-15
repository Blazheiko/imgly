// STAGED ROLLBACK RECIPE — not promoted with the feature. IndexedDB cannot downgrade, so a "down"
// is a new forward step (CLAUDE.md §Migrations). Promote it only if the Gallery is withdrawn: as
// `src/infra/db/migrations/NNNN-remove-gallery.ts` with `version` set to LATEST_VERSION + 1 at that
// time, shipped in the release that removes the gallery code. It deletes every stored Work.
import type { Migration } from './index'

/** Undoes `0002-gallery`: drops the blob and meta stores and gives `works` back its v1 index. */
export const removeGallery: Migration = {
  version: 3, // placeholder: LATEST_VERSION + 1 when promoted
  upgrade(db, tx) {
    db.deleteObjectStore('meta')
    db.deleteObjectStore('layers')
    db.deleteObjectStore('originals')
    const works = tx.objectStore('works')
    works.deleteIndex('touchedAt')
    works.createIndex('updatedAt', 'updatedAt')
    void works.clear()
  },
}
