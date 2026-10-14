import { readonly, ref, type Ref } from 'vue'

export interface StoredMark {
  workId: string
  revision: number
}

export interface SaveQueue<W extends { id: string; revision: number }> {
  request(work: W): void
  saving: Readonly<Ref<boolean>>
  settled(): Promise<void>
  stored(): StoredMark | null
  isStored(work: W): boolean
  dropPending(): void
}

/** Single flight, latest wins: one save runs, one newest request waits. */
export function createSaveQueue<W extends { id: string; revision: number }>(
  save: (work: W) => Promise<boolean>,
): SaveQueue<W> {
  const saving = ref(false)
  let running = false
  let pending: { work: W } | null = null
  let last: StoredMark | null = null
  let waiters: Array<() => void> = []

  function refresh() {
    saving.value = running || pending !== null
    if (!saving.value) {
      const toWake = waiters
      waiters = []
      for (const wake of toWake) wake()
    }
  }

  async function run(work: W) {
    running = true
    refresh()
    const committed = await save(work).catch(() => false)
    if (committed) last = { workId: work.id, revision: work.revision }
    running = false
    const next = pending
    pending = null
    if (next) void run(next.work)
    else refresh()
  }

  return {
    request(work) {
      if (running) {
        pending = { work }
        refresh()
      } else void run(work)
    },
    saving: readonly(saving),
    settled: () =>
      saving.value ? new Promise<void>((resolve) => waiters.push(resolve)) : Promise.resolve(),
    stored: () => (last ? { ...last } : null),
    isStored: (work) => last !== null && last.workId === work.id && last.revision === work.revision,
    dropPending() {
      pending = null
      refresh()
    },
  }
}
