import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb'
import type { ImglyDb } from './schema'
import { appError, err, ok, type AppError, type Result } from '../../core'
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
        if (step.version > oldVersion)
          step.upgrade(
            db as unknown as IDBPDatabase,
            tx as unknown as IDBPTransaction<unknown, string[], 'versionchange'>,
          )
      }
    },
  })
}

export interface OpenGalleryDbOptions {
  name?: string
  /** How long a `blocked` open waits for an older connection to close. Default 3000 ms. */
  blockedWaitMs?: number
  /** Called with this connection when a newer version opens the database elsewhere. */
  onVersionChange?: (db: IDBPDatabase<ImglyDb>) => void
}

/**
 * Opens the Gallery database as a Result. `STORAGE_UNAVAILABLE` carries `reason: 'refused'` when
 * the browser refuses the open, and `'held'` when an older connection blocks the upgrade past
 * `blockedWaitMs`. The returned connection reports `versionchange` through `onVersionChange`.
 */
export function openGalleryDb(
  opts: OpenGalleryDbOptions = {},
): Promise<Result<IDBPDatabase<ImglyDb>, AppError>> {
  const { name = DB_NAME, blockedWaitMs = 3000, onVersionChange } = opts
  const unavailable = (reason: 'refused' | 'held') =>
    err(appError('STORAGE_UNAVAILABLE', { reason }))

  return new Promise((resolve) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (result: Result<IDBPDatabase<ImglyDb>, AppError>) => {
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    let opening: Promise<IDBPDatabase<ImglyDb>>
    try {
      opening = openDB<ImglyDb>(name, LATEST_VERSION, {
        upgrade(db, oldVersion, _newVersion, tx) {
          for (const step of migrations) {
            if (step.version > oldVersion)
              step.upgrade(
                db as unknown as IDBPDatabase,
                tx as unknown as IDBPTransaction<unknown, string[], 'versionchange'>,
              )
          }
        },
        blocked() {
          if (settled || timer !== undefined) return
          timer = setTimeout(() => {
            if (!settled) finish(unavailable('held'))
          }, blockedWaitMs)
        },
      })
    } catch {
      finish(unavailable('refused'))
      return
    }

    opening.then(
      (db) => {
        if (settled) {
          // Gave up as held; the older tab let go late. Don't leak a connection.
          db.close()
          return
        }
        db.addEventListener('versionchange', () => onVersionChange?.(db))
        finish(ok(db))
      },
      () => {
        if (!settled) finish(unavailable('refused'))
      },
    )
  })
}
