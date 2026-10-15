import { readonly, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { msUntilNextCheck, nextCheckDue } from '@/core'
import { useEditorStore } from '@/features/editor'
import type { ServiceWorkerCallbacks, ServiceWorkerClient } from '@/infra/platform'
import { useNotices } from '@/shared'
import { ACTION_RELOAD, UPDATE_TEXT, infoOfflineReady, type UpdateWording } from './messages'

export type UpdateNotice = 'none' | UpdateWording

/** A later signal never has less to say: the notice only moves up this order (sad.md §5). */
const RANK: Record<UpdateNotice, number> = {
  none: 0,
  available: 1,
  'updated-elsewhere': 2,
  'reload-to-save': 3,
}

/** The notices slot the one update notice lives in (AC-14). */
export const UPDATE_SLOT = 'app-update'

/** What `connect` reads from the page; injectable so Vitest drives the clock and visibility. */
export interface UpdateEnv {
  now: () => number
  document: Pick<Document, 'visibilityState' | 'addEventListener'>
}

/**
 * The install and update feature (ADR-0004). It shows one update notice in three wordings, keeps
 * the check schedule of spec §6 and never reloads by itself.
 */
export const usePwaInstallUpdate = defineStore('pwa-install-update', () => {
  const editor = useEditorStore()
  const notices = useNotices()
  const updateNotice = ref<UpdateNotice>('none')
  let client: ServiceWorkerClient | null = null
  // The notice id in the notices store, while this store shows it.
  let noticeId: string | null = null
  // True while this store pushes its own notice, which replaces the old id in the slot.
  let rendering = false
  // Hidden by the Editor's Dismiss until the page loads again, or a newer signal arrives (AC-09).
  let hidden = false
  // The waiting worker whose `available` notice was dismissed (AC-09).
  let dismissedWaiting: object | null = null
  let offlineReadyShown = false

  function render() {
    if (updateNotice.value === 'none' || hidden) {
      const id = noticeId
      noticeId = null
      if (id) notices.dismiss(id)
      return
    }
    rendering = true
    try {
      const [id] = notices.pushAll([
        {
          kind: 'lasting',
          slot: UPDATE_SLOT,
          text: UPDATE_TEXT[updateNotice.value],
          action: { label: ACTION_RELOAD, run: () => reload() },
        },
      ])
      noticeId = id!
    } finally {
      rendering = false
    }
  }

  // The Editor's Dismiss removes the notice in the notices store; remember it here. Sync, so a
  // signal right after the Dismiss already sees it; this store's own slot replace is skipped.
  watch(
    () => notices.items.map((n) => n.id),
    (ids) => {
      if (rendering || noticeId === null || ids.includes(noticeId)) return
      noticeId = null
      hidden = true
      if (updateNotice.value === 'available') dismissedWaiting = client?.waitingKey() ?? null
    },
    { flush: 'sync' },
  )

  /** Moves the notice up to `next`, shown again even after a dismissal, except a dismissed version. */
  function raise(next: UpdateWording) {
    if (RANK[next] < RANK[updateNotice.value]) return
    if (next === 'available') {
      const waiting = client?.waitingKey() ?? null
      if (hidden && waiting !== null && waiting === dismissedWaiting) return
    }
    updateNotice.value = next
    hidden = false
    render()
  }

  watch(
    () => editor.storageSuperseded,
    (superseded) => superseded && raise('reload-to-save'),
    { immediate: true },
  )

  /** Chooses "Reload"; the notice stays open while the Reload checks run. */
  function reload(): 'keep-open' {
    return 'keep-open'
  }

  /** Connects the service-worker client and starts the check schedule (ADR-0001, ADR-0002). */
  function connect(
    create: (callbacks: ServiceWorkerCallbacks) => ServiceWorkerClient,
    env: Partial<UpdateEnv> = {},
  ) {
    const now = env.now ?? Date.now
    const page = env.document ?? document
    // A first install takes control without any version switch: that one change is not an update.
    let controlled = false
    client = create({
      onNeedRefresh: () => raise('available'),
      onOfflineReady() {
        if (offlineReadyShown) return
        offlineReadyShown = true
        notices.pushAll([{ kind: 'info', text: infoOfflineReady() }])
      },
      onControllerChange() {
        if (!controlled) {
          controlled = true
          return
        }
        raise('updated-elsewhere')
      },
    })
    controlled = client.hadControllerAtLoad

    let lastCheck: number | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      clearTimeout(timer)
      const visible = page.visibilityState === 'visible'
      if (nextCheckDue(lastCheck, now(), visible)) {
        // A failed check counts too: the next try is a full interval later (AC-15).
        lastCheck = now()
        void client!.check().catch(() => {})
      }
      if (visible) timer = setTimeout(tick, msUntilNextCheck(lastCheck, now()))
    }
    page.addEventListener('visibilitychange', tick)
    tick()
  }

  return { updateNotice: readonly(updateNotice), connect }
})
