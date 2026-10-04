import { openDB, type IDBPDatabase } from 'idb'
import type { ImglyDb } from './schema'
import { LATEST_VERSION, migrations, type Migration } from './migrations'

export const DB_NAME = 'imgly'

/** Opens the `imgly` database at the latest version, applying every pending migration step. */
export function openDb(
  name: string = DB_NAME,
  steps: readonly Migration[] = migrations,
  version: number = LATEST_VERSION,
): Promise<IDBPDatabase<ImglyDb>> {
  return openDB<ImglyDb>(name, version, {
    upgrade(db, oldVersion, _newVersion, tx) {
      for (const step of steps) {
        if (step.version > oldVersion) step.upgrade(db, tx)
      }
    },
  })
}
