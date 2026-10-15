import type { IDBPDatabase, IDBPTransaction } from 'idb'
import { init } from './0001-init'
import { gallery } from './0002-gallery'

/**
 * One forward-only schema step. `openDb()` runs every step whose `version` is greater than the
 * database's `oldVersion`, in order. The handles are untyped so a step may name stores and
 * indexes that the latest schema has dropped. IndexedDB cannot downgrade: a "down" is a new forward step.
 */
export interface Migration {
  version: number
  upgrade(db: IDBPDatabase, tx: IDBPTransaction<unknown, string[], 'versionchange'>): void
}

/** Every step, ascending by version. Append new steps; never edit a released one. */
export const migrations: readonly Migration[] = [init, gallery]

export const LATEST_VERSION = migrations.reduce((max, m) => Math.max(max, m.version), 0)
