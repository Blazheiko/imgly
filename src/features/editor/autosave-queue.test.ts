import { describe, expect, it } from 'vitest'
import { createSaveQueue } from './autosave-queue'

type W = { id: string; revision: number }

interface Deferred {
  work: W
  finish(committed: boolean): void
}

/** An injected save whose completion the test controls. */
function harness() {
  const started: Deferred[] = []
  let running = 0
  let maxRunning = 0
  const save = (work: W) =>
    new Promise<boolean>((resolve) => {
      running++
      maxRunning = Math.max(maxRunning, running)
      started.push({
        work,
        finish(committed) {
          running--
          resolve(committed)
        },
      })
    })
  const queue = createSaveQueue<W>(save)
  return { queue, started, running: () => running, maxRunning: () => maxRunning }
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}
const w = (id: string, revision: number): W => ({ id, revision })

describe('Autosave save queue (gallery AC-16, AC-20)', () => {
  it('is idle at the start: not saving, nothing stored, settled() resolves at once', async () => {
    const { queue } = harness()
    expect(queue.saving.value).toBe(false)
    expect(queue.stored()).toBeNull()
    expect(queue.isStored(w('a', 1))).toBe(false)
    await expect(queue.settled()).resolves.toBeUndefined()
  })

  it('runs a request, reports saving, and records { workId, revision } once committed', async () => {
    const { queue, started } = harness()
    queue.request(w('a', 1))
    await flush()
    expect(started.map((s) => s.work)).toEqual([w('a', 1)])
    expect(queue.saving.value).toBe(true)
    expect(queue.stored()).toBeNull()

    started[0]!.finish(true)
    await flush()
    expect(queue.saving.value).toBe(false)
    expect(queue.stored()).toEqual({ workId: 'a', revision: 1 })
    expect(queue.isStored(w('a', 1))).toBe(true)
    expect(queue.isStored(w('a', 2))).toBe(false)
    expect(queue.isStored(w('b', 1))).toBe(false)
  })

  it('settled() stays pending while a save runs and resolves when it finishes', async () => {
    const { queue, started } = harness()
    queue.request(w('a', 1))
    await flush()
    let done = false
    void queue.settled().then(() => (done = true))
    await flush()
    expect(done).toBe(false)
    started[0]!.finish(true)
    await flush()
    expect(done).toBe(true)
  })

  it('ten quick requests: one runs, one waits with the newest, intermediate states are skipped', async () => {
    const { queue, started, maxRunning } = harness()
    for (let r = 1; r <= 10; r++) queue.request(w('a', r))
    await flush()
    expect(started.map((s) => s.work.revision)).toEqual([1])

    let done = false
    void queue.settled().then(() => (done = true))
    started[0]!.finish(true)
    await flush()
    expect(started.map((s) => s.work.revision)).toEqual([1, 10])
    expect(queue.saving.value).toBe(true)
    expect(done).toBe(false)

    started[1]!.finish(true)
    await flush()
    expect(done).toBe(true)
    expect(queue.saving.value).toBe(false)
    expect(queue.stored()).toEqual({ workId: 'a', revision: 10 })
    expect(maxRunning()).toBe(1)
  })

  it('a failed save keeps the previous stored value and leaves isStored false for the failed Work', async () => {
    const { queue, started } = harness()
    queue.request(w('a', 1))
    await flush()
    started[0]!.finish(true)
    await flush()
    queue.request(w('a', 2))
    await flush()
    started[1]!.finish(false)
    await flush()
    expect(queue.saving.value).toBe(false)
    expect(queue.stored()).toEqual({ workId: 'a', revision: 1 })
    expect(queue.isStored(w('a', 2))).toBe(false)
    await expect(queue.settled()).resolves.toBeUndefined()
  })

  it('when the running save fails and a newer one is pending, the pending one runs next', async () => {
    const { queue, started } = harness()
    queue.request(w('a', 1))
    queue.request(w('a', 2))
    await flush()
    started[0]!.finish(false)
    await flush()
    expect(started.map((s) => s.work.revision)).toEqual([1, 2])
    expect(queue.stored()).toBeNull()
    started[1]!.finish(true)
    await flush()
    expect(queue.stored()).toEqual({ workId: 'a', revision: 2 })
  })

  it('latest wins regardless of Work id, and isStored compares id and revision', async () => {
    const { queue, started } = harness()
    queue.request(w('a', 5))
    queue.request(w('b', 1))
    await flush()
    started[0]!.finish(true)
    await flush()
    expect(started.map((s) => s.work)).toEqual([w('a', 5), w('b', 1)])
    started[1]!.finish(true)
    await flush()
    expect(queue.stored()).toEqual({ workId: 'b', revision: 1 })
    expect(queue.isStored(w('a', 5))).toBe(false)
    expect(queue.isStored(w('b', 1))).toBe(true)
  })

  it('a request for the Work already stored at the same revision is still saved', async () => {
    const { queue, started } = harness()
    queue.request(w('a', 1))
    await flush()
    started[0]!.finish(true)
    await flush()
    queue.request(w('a', 1))
    await flush()
    expect(started).toHaveLength(2)
    expect(queue.saving.value).toBe(true)
    expect(queue.isStored(w('a', 1))).toBe(true)
  })

  it('dropPending() clears the waiting request without touching the running save', async () => {
    const { queue, started } = harness()
    queue.request(w('a', 1))
    queue.request(w('a', 2))
    await flush()
    queue.dropPending()
    expect(queue.saving.value).toBe(true)
    started[0]!.finish(true)
    await flush()
    expect(started).toHaveLength(1)
    expect(queue.saving.value).toBe(false)
    expect(queue.stored()).toEqual({ workId: 'a', revision: 1 })
    await expect(queue.settled()).resolves.toBeUndefined()
  })

  it('property: over random request/completion interleavings the queue keeps its invariants', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      let state = seed * 2654435761
      const rand = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        return state / 2 ** 32
      }
      const { queue, started, running, maxRunning } = harness()
      let newest = 0
      let pending: number | null = null
      let runningRev: number | null = null
      let committed: number | null = null
      let settledCalled = false

      for (let step = 0; step < 60; step++) {
        if (rand() < 0.55) {
          const rev = ++newest
          queue.request(w('a', rev))
          if (runningRev === null) runningRev = rev
          else pending = rev
        } else if (runningRev !== null) {
          const ok = rand() < 0.7
          started[started.length - 1]!.finish(ok)
          if (ok) committed = runningRev
          runningRev = pending
          pending = null
        }
        await flush()

        expect(running()).toBe(runningRev === null ? 0 : 1)
        expect(queue.saving.value).toBe(runningRev !== null || pending !== null)
        expect(queue.stored()).toEqual(
          committed === null ? null : { workId: 'a', revision: committed },
        )
        if (runningRev === null && !settledCalled) {
          settledCalled = true
          await expect(queue.settled()).resolves.toBeUndefined()
        }
        if (runningRev !== null) settledCalled = false
      }
      expect(maxRunning()).toBe(1)

      let done = false
      void queue.settled().then(() => (done = true))
      await flush()
      expect(done).toBe(runningRev === null)
      while (running() > 0) {
        started[started.length - 1]!.finish(true)
        await flush()
      }
      expect(done).toBe(true)
      expect(queue.saving.value).toBe(false)
      if (newest > 0) {
        expect(started[started.length - 1]!.work.revision).toBe(newest)
      }
    }
  })
})
