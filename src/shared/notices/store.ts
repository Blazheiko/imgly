import { defineStore } from 'pinia'
import { ref } from 'vue'
import { newId } from '../ids'

/** An informational notice dismisses itself after this long (tasks/_epic.md). */
export const INFO_NOTICE_MS = 6000

/** `info` dismisses itself; `failure` stays until the Editor dismisses it (AC-11b). */
export type NoticeKind = 'info' | 'failure'

export interface NoticeInput {
  kind: NoticeKind
  text: string
}

export interface Notice extends NoticeInput {
  id: string
}

/** The single notice queue behind the bottom-right toast boundary. */
export const useNotices = defineStore('notices', () => {
  const items = ref<Notice[]>([])

  /** Adds every notice of one open in one step, after whatever is already shown. */
  function pushAll(notices: NoticeInput[]): void {
    const added = notices.map((n) => ({ ...n, id: newId() }))
    items.value.push(...added)
    for (const notice of added) {
      if (notice.kind === 'info') setTimeout(() => dismiss(notice.id), INFO_NOTICE_MS)
    }
  }

  function dismiss(id: string): void {
    items.value = items.value.filter((n) => n.id !== id)
  }

  return { items, pushAll, dismiss }
})
