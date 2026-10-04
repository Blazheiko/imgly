import type { Migration } from './index'

/** Creates the `works` store: one record per Work, keyed by its UUIDv7 id. */
export const init: Migration = {
  version: 1,
  upgrade(db) {
    const works = db.createObjectStore('works', { keyPath: 'id' })
    works.createIndex('updatedAt', 'updatedAt')
  },
}
