/** The one key the update reload writes and the next start takes (ADR-0003). */
export const REOPEN_KEY = 'imgly:reopen-after-update'

/** Remembers the Work to reopen after the update reload, in this tab only. Blocked storage: no-op. */
export function markReopen(workId: string, storage?: Storage): void {
  try {
    ;(storage ?? sessionStorage).setItem(REOPEN_KEY, workId)
  } catch {
    // Blocked storage: the reload opens no Work, which is the safe default.
  }
}

/** Reads and removes the marker in one step, so it reopens at most once. Blocked storage: null. */
export function takeReopen(storage?: Storage): string | null {
  try {
    const store = storage ?? sessionStorage
    const workId = store.getItem(REOPEN_KEY)
    store.removeItem(REOPEN_KEY)
    return workId || null
  } catch {
    return null
  }
}
