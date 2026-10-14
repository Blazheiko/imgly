// @vitest-environment node
// T33 (S2-6): overlapping refresh() calls must not revoke URLs the DOM still loads.
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { IDBPDatabase } from 'idb'
import { ok } from '@/core'
import { openDb, type ImglyDb } from '@/infra/db'
import { storedWorkFixture } from '@/infra/db/testing'
import { useEditorStore } from '@/features/editor'
import { createFakeAutosave } from '@/features/editor/testing'
import { useGallery } from './store'

type Db = IDBPDatabase<ImglyDb>

// Each listWorks call reads the real list at call time, then waits for a gate the test controls.
const gates: Array<() => void> = []
vi.mock('@/infra/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/db')>()
  return {
    ...actual,
    listWorks: async (...args: Parameters<typeof actual.listWorks>) => {
      const result = await actual.listWorks(...args)
      await new Promise<void>((resolve) => gates.push(resolve))
      return result
    },
  }
})

const NOW = 1_700_000_000_000
let dbCounter = 0

async function seed(db: Db, sourceName: string, touchedAt: number): Promise<string> {
  const w = storedWorkFixture({ layer: null, record: { sourceName, touchedAt } })
  await db.put('works', w.record)
  await db.put('originals', w.original)
  return w.record.id
}

/** Lets the pending refresh reach its listWorks gate. */
async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve()
  await new Promise((r) => setTimeout(r, 10))
}

describe('gallery store: overlapping refresh (T33, S2-6)', () => {
  let db: Db
  let gallery: ReturnType<typeof useGallery>
  let created: string[]
  let revoked: string[]
  let revokedWhileReferenced: string[]

  beforeEach(async () => {
    gates.length = 0
    setActivePinia(createPinia())
    db = await openDb(`imgly-gallery-race-${++dbCounter}`)
    const editor = useEditorStore()
    editor.setAutosave(createFakeAutosave().fake)
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(true) } })
    gallery = useGallery()
    gallery.connect(ok(db))
    gallery.setClock(() => NOW)
    created = []
    revoked = []
    revokedWhileReferenced = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:test/${created.length}`
      created.push(url)
      return url
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
      revoked.push(url)
      if (gallery.entries.some((e) => e.thumbnailUrl === url)) revokedWhileReferenced.push(url)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    db.close()
  })

  /** First refresh reads one Work, a second Work is saved, the second refresh reads both. */
  async function overlap(finishOrder: 'second-first' | 'first-first') {
    await seed(db, 'A.png', NOW - 1000)
    const p1 = gallery.refresh()
    await settle()
    await seed(db, 'B.png', NOW)
    const p2 = gallery.refresh()
    await settle()
    expect(gates).toHaveLength(2)
    const [g1, g2] = gates as [() => void, () => void]
    if (finishOrder === 'second-first') {
      g2()
      await p2
      g1()
      await p1
    } else {
      g1()
      await p1
      g2()
      await p2
    }
  }

  it('keeps the newest call list when the first listWorks resolves after the second', async () => {
    await overlap('second-first')

    expect(gallery.entries.map((e) => e.name)).toEqual(['B.png', 'A.png'])
    for (const e of gallery.entries) expect(revoked).not.toContain(e.thumbnailUrl)
  })

  it('assigns only the newest list when the first resolves first as well', async () => {
    await overlap('first-first')

    expect(gallery.entries.map((e) => e.name)).toEqual(['B.png', 'A.png'])
    for (const e of gallery.entries) expect(revoked).not.toContain(e.thumbnailUrl)
  })

  it('revokes every URL created for a superseded list (no leak)', async () => {
    await overlap('second-first')

    const live = new Set(gallery.entries.map((e) => e.thumbnailUrl))
    const orphans = created.filter((u) => !live.has(u))
    expect(orphans.length).toBeGreaterThan(0) // the losing call's list did create URLs
    for (const u of orphans) expect(revoked).toContain(u)
  })

  it('never revokes a URL the entries currently reference, also across sequential refreshes', async () => {
    await seed(db, 'A.png', NOW)
    const p = gallery.refresh()
    await settle()
    gates[0]!()
    await p
    const first = gallery.entries[0]!.thumbnailUrl!

    const p2 = gallery.refresh()
    await settle()
    // The old list stays assigned (and its URLs unrevoked) until the new list is assigned.
    expect(revoked).not.toContain(first)
    gates[1]!()
    await p2

    expect(revoked).toContain(first)
    expect(revokedWhileReferenced).toEqual([])
    expect(gallery.entries[0]!.thumbnailUrl).not.toBe(first)
  })
})
