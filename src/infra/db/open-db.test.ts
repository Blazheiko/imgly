// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openDb, openGalleryDb } from './open-db'
import { LATEST_VERSION, migrations } from './migrations'

let dbCounter = 0
const freshName = () => `imgly-open-gallery-${++dbCounter}`

afterEach(() => {
  vi.restoreAllMocks()
})

describe('openGalleryDb', () => {
  it('opens the latest schema as an ok Result', async () => {
    const result = await openGalleryDb({ name: freshName() })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.version).toBe(LATEST_VERSION)
    result.value.close()
  })

  it('AC-12: resolves STORAGE_UNAVAILABLE with reason refused when indexedDB.open throws', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const result = await openGalleryDb({ name: freshName() })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('STORAGE_UNAVAILABLE')
    expect(result.error.details).toMatchObject({ reason: 'refused' })
  })

  it('AC-12: resolves refused when the open request rejects', async () => {
    for (const errName of ['InvalidStateError', 'UnknownError']) {
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const request = {} as IDBOpenDBRequest
        setTimeout(() => {
          Object.defineProperty(request, 'error', { value: new DOMException('no', errName) })
          request.onerror?.(new Event('error'))
        })
        return request
      })
      const result = await openGalleryDb({ name: freshName() })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('STORAGE_UNAVAILABLE')
      expect(result.error.details).toMatchObject({ reason: 'refused' })
      vi.restoreAllMocks()
    }
  })

  it('AC-12: resolves held after the bounded wait when an older connection never closes', async () => {
    const name = freshName()
    // An older version without a versionchange handler keeps the database open.
    const older = await openDb(
      name,
      migrations.filter((step) => step.version <= 1),
      1,
    )
    const started = Date.now()
    const result = await openGalleryDb({ name, blockedWaitMs: 50 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('STORAGE_UNAVAILABLE')
      expect(result.error.details).toMatchObject({ reason: 'held' })
    }
    expect(Date.now() - started).toBeGreaterThanOrEqual(40)
    older.close()
  })

  it('fires onVersionChange once on the open connection, and the newer version then upgrades', async () => {
    const name = freshName()
    const onVersionChange = vi.fn((db: { close(): void }) => db.close())
    const first = await openGalleryDb({ name, onVersionChange })
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const newer = await openDb(name, migrations, LATEST_VERSION + 1)

    expect(onVersionChange).toHaveBeenCalledTimes(1)
    expect(onVersionChange).toHaveBeenCalledWith(first.value)
    expect(newer.version).toBe(LATEST_VERSION + 1)
    newer.close()
  })
})
