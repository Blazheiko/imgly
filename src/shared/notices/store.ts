import { defineStore } from 'pinia'
import { ref } from 'vue'
import { newId } from '../ids'

/** An informational notice dismisses itself after this long (tasks/_epic.md). */
export const INFO_NOTICE_MS = 6000

/**
 * `info` dismisses itself; `failure` stays until the Editor dismisses it (AC-11b); `lasting` has the
 * `info` look but never times out (pwa-install-update AC-06).
 */
export type NoticeKind = 'info' | 'failure' | 'lasting'

/**
 * An optional button before Dismiss. Running it also dismisses the notice unless `run` returns
 * `'keep-open'`. While `busy`, it shows `busyLabel` with a spinner and ignores clicks.
 */
export interface NoticeAction {
  label: string
  run: () => void | 'keep-open'
  busy?: boolean
  busyLabel?: string
}

export interface NoticeInput {
  kind: NoticeKind
  text: string
  action?: NoticeAction
  /** A push into an occupied slot replaces that notice in place (pwa-install-update AC-14). */
  slot?: string
}

export interface Notice extends NoticeInput {
  id: string
}

/** The single notice queue behind the bottom-right toast boundary. */
export const useNotices = defineStore('notices', () => {
  const items = ref<Notice[]>([])

  /**
   * Adds every notice of one open in one step, after whatever is already shown. A notice whose slot
   * is taken replaces that notice at the same position, under a new id.
   */
  function pushAll(notices: NoticeInput[]): string[] {
    const added = notices.map((n) => ({ ...n, id: newId() }))
    for (const notice of added) {
      const index = notice.slot ? items.value.findIndex((n) => n.slot === notice.slot) : -1
      if (index === -1) items.value.push(notice)
      else items.value.splice(index, 1, notice)
      if (notice.kind === 'info') setTimeout(() => dismiss(notice.id), INFO_NOTICE_MS)
    }
    return added.map((n) => n.id)
  }

  /** Changes a shown notice in place, keeping its id and position; a gone id is ignored. */
  function update(id: string, patch: Partial<NoticeInput>): void {
    const index = items.value.findIndex((n) => n.id === id)
    if (index !== -1) items.value.splice(index, 1, { ...items.value[index]!, ...patch, id })
  }

  function dismiss(id: string): void {
    items.value = items.value.filter((n) => n.id !== id)
  }

  return { items, pushAll, update, dismiss }
})
