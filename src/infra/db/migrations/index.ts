import type { IDBPDatabase, IDBPTransaction, StoreNames } from 'idb'
import type { ImglyDb } from '../schema'
import { init } from './0001-init'

/**
 * One forward-only schema step. `openDb()` runs every step whose `version` is greater than the
 * database's `oldVersion`, in order. IndexedDB cannot downgrade: a "down" is a new forward step.
 */
export interface Migration {
  version: number
  upgrade(
    db: IDBPDatabase<ImglyDb>,
    tx: IDBPTransaction<ImglyDb, StoreNames<ImglyDb>[], 'versionchange'>,
  ): void
}

/** Every step, ascending by version. Append new steps; never edit a released one. */
export const migrations: readonly Migration[] = [init]

export const LATEST_VERSION = migrations.reduce((max, m) => Math.max(max, m.version), 0)
