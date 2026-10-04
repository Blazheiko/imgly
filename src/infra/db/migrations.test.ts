import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openDb } from './open-db'
import { LATEST_VERSION, migrations } from './migrations'

let dbCounter = 0
const freshName = () => `imgly-test-${++dbCounter}`

describe('openDb migrations', () => {
  afterEach(() => vi.restoreAllMocks())

  it('brings a fresh database to the latest version with the works store', async () => {
    const db = await openDb(freshName())

    expect(db.version).toBe(LATEST_VERSION)
    expect([...db.objectStoreNames]).toContain('works')
    const store = db.transaction('works').store
    expect(store.keyPath).toBe('id')
    expect([...store.indexNames]).toContain('updatedAt')
    db.close()
  })

  it('re-opening an up-to-date database runs no migration step', async () => {
    const name = freshName()
    ;(await openDb(name)).close()

    const spies = migrations.map((m) => vi.spyOn(m, 'upgrade'))
    const db = await openDb(name)

    expect(db.version).toBe(LATEST_VERSION)
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    db.close()
  })

  it('runs only the steps newer than the stored version', async () => {
    const name = freshName()
    ;(await openDb(name)).close()

    const next = { version: LATEST_VERSION + 1, upgrade: vi.fn() }
    const spies = migrations.map((m) => vi.spyOn(m, 'upgrade'))
    const db = await openDb(name, [...migrations, next], next.version)

    expect(db.version).toBe(next.version)
    expect(next.upgrade).toHaveBeenCalledOnce()
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    db.close()
  })

  it('stores and reads a work record', async () => {
    const db = await openDb(freshName())
    const record = { id: 'a', name: 'photo.jpg', createdAt: 1, updatedAt: 2 }

    await db.put('works', record)

    expect(await db.get('works', 'a')).toEqual(record)
    db.close()
  })
})
