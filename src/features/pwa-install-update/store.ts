import { computed, readonly, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { msUntilNextCheck, nextCheckDue } from '@/core'
import { useEditorStore, type ReloadOutcome } from '@/features/editor'
import {
  markReopen,
  takeReopen,
  type InstallPrompt,
  type ServiceWorkerCallbacks,
  type ServiceWorkerClient,
} from '@/infra/platform'
import { useNotices, type NoticeAction } from '@/shared'
import {
  ACTION_RELOAD,
  ACTION_RELOADING,
  UPDATE_TEXT,
  failureExportRunning,
  failureInstall,
  failureReopenEvicted,
  failureReopenUnreadable,
  failureToolOpen,
  infoOfflineReady,
  type UpdateWording,
} from './messages'

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

/** What `connect` touches on the page; injectable so Vitest drives clock, visibility and reload. */
export interface UpdateEnv {
  now: () => number
  document: Pick<Document, 'visibilityState' | 'addEventListener'>
  /** Writes the take-once reopen marker (ADR-0003). */
  mark: (workId: string) => void
  reloadPage: () => void
}

/** How the reopen after the update reaches the Gallery, wired by the app shell (T9 decision). */
export interface ResumeDeps {
  /** The Work is listed in the Gallery, by a listing that is current when it resolves. */
  isListed: (workId: string) => boolean | Promise<boolean>
  /**
   * Reopens it as the Gallery does: its spinner, and its damaged notice with Delete…. A read that
   * fails is worded as `couldNotOpen` says (SCR-07 `reopen failed: can't be read`).
   */
  reopen: (workId: string, wording: { couldNotOpen: string }) => Promise<unknown>
}

/** How long Reload waits for the waiting worker to take control before it gives up (§6.1). */
export const SWITCH_WAIT_MS = 10_000

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
  // Reload is waiting for its checks, the confirmation, or the switch (AC-11).
  let busy = false
  /** The Reload confirmation is up (SCR-06, AC-12). */
  const confirming = ref<{ reopenId: string | null } | null>(null)
  // This window asked the waiting worker to take over: its controllerchange reloads (ADR-0002),
  // marking this Work to reopen only then, so a switch that never comes leaves no marker (§6.1).
  let switchRequested: { reopenId: string | null; timer: ReturnType<typeof setTimeout> } | null =
    null
  let lastRefusal: { id: string; text: string } | null = null
  let env: Pick<UpdateEnv, 'mark' | 'reloadPage'> = {
    mark: markReopen,
    reloadPage: () => location.reload(),
  }

  function action(): NoticeAction {
    return { label: ACTION_RELOAD, run: reload, busy, busyLabel: ACTION_RELOADING }
  }

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
          action: action(),
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

  function setBusy(on: boolean) {
    busy = on
    if (noticeId) notices.update(noticeId, { action: action() })
  }

  /** A refusal notice; the same refusal again replaces the earlier one (SCR-07 `repeated`). */
  function refuse(text: string) {
    if (lastRefusal?.text === text) notices.dismiss(lastRefusal.id)
    lastRefusal = { id: notices.pushAll([{ kind: 'failure', text }])[0]!, text }
  }

  function fail(text: string) {
    notices.pushAll([{ kind: 'failure', text }])
  }

  /** Chooses "Reload": the notice stays open while the Reload gate runs (ADR-0004). */
  function reload(): 'keep-open' {
    if (busy) return 'keep-open'
    setBusy(true)
    void editor.requestReload().then(onReloadOutcome)
    return 'keep-open'
  }

  function onReloadOutcome(outcome: ReloadOutcome) {
    switch (outcome.kind) {
      case 'ignored':
        setBusy(false)
        break
      case 'tool-open':
        setBusy(false)
        refuse(failureToolOpen())
        break
      case 'exporting':
        setBusy(false)
        refuse(failureExportRunning())
        break
      case 'confirm':
        editor.setReloadHeld(true)
        confirming.value = { reopenId: outcome.reopenId }
        break
      case 'ready':
        leave(outcome.reopenId)
        break
    }
  }

  function confirmReload() {
    const asked = confirming.value
    if (!asked) return
    confirming.value = null
    leave(asked.reopenId)
  }

  function cancelReload() {
    if (!confirming.value) return
    confirming.value = null
    editor.setReloadHeld(false)
    setBusy(false)
  }

  /**
   * Leaves for the new version: lets a waiting worker take over (this window marks the Work to
   * reopen and reloads on its controllerchange) or, with none waiting, marks and reloads at once.
   */
  function leave(reopenId: string | null) {
    // Nothing may open a tool or start an Export between here and the reload (AC-10, AC-13).
    editor.setReloadHeld(true)
    // Whatever the wording, a waiting worker is the newest version: Reload takes it (AC-09).
    if (client?.waitingKey()) {
      switchRequested = { reopenId, timer: setTimeout(abandonSwitch, SWITCH_WAIT_MS) }
      void client.activateWaiting()
    } else {
      reloadMarking(reopenId)
    }
  }

  function reloadMarking(reopenId: string | null) {
    if (reopenId !== null) env.mark(reopenId)
    env.reloadPage()
  }

  /** The waiting worker never took control: this window stays, held by nothing, Reload enabled. */
  function abandonSwitch() {
    switchRequested = null
    editor.setReloadHeld(false)
    setBusy(false)
  }

  /** Takes the Work the update reload marked; call it first at start, before anything can fail. */
  function takeMarkedWork(take: () => string | null = takeReopen): string | null {
    return take()
  }

  /** At start, after the Gallery connected: reopens the Work `takeMarkedWork` took (AC-08). */
  async function resumeAfterUpdate(workId: string | null, deps: ResumeDeps) {
    if (workId === null) return
    if (!editor.galleryAvailable) fail(failureReopenUnreadable())
    else if (!(await deps.isListed(workId))) fail(failureReopenEvicted())
    else await deps.reopen(workId, { couldNotOpen: failureReopenUnreadable() })
  }

  /** Connects the service-worker client and starts the check schedule (ADR-0001, ADR-0002). */
  function connect(
    create: (callbacks: ServiceWorkerCallbacks) => ServiceWorkerClient,
    options: Partial<UpdateEnv> = {},
  ) {
    const now = options.now ?? Date.now
    const page = options.document ?? document
    env = { mark: options.mark ?? env.mark, reloadPage: options.reloadPage ?? env.reloadPage }
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
        if (switchRequested) {
          clearTimeout(switchRequested.timer)
          reloadMarking(switchRequested.reopenId)
          return
        }
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

  let installClient: InstallPrompt | null = null
  const installOffered = ref(false)
  const standalone = ref(false)
  /** "Install app" shows only while the browser offers and this is not the Installed app (AC-02, AC-04). */
  const canInstall = computed(() => installOffered.value && !standalone.value)

  /** Follows the browser's install offer (sad.md §5 tactical decision 4). */
  function connectInstall(next: InstallPrompt) {
    installClient = next
    standalone.value = next.isStandalone()
    installOffered.value = next.hasOffer()
    next.onOfferChange(() => (installOffered.value = next.hasOffer()))
  }

  // The browser's confirmation is open: another click must not read as a failed install (AC-03).
  let installing = false

  /** The Editor's click on "Install app": the browser's confirmation, never a prompt of our own. */
  async function install() {
    if (!installClient || installing) return
    installing = true
    try {
      const result = await installClient.prompt()
      installOffered.value = installClient.hasOffer()
      if (!result.ok) notices.pushAll([{ kind: 'failure', text: failureInstall() }])
    } finally {
      installing = false
    }
  }

  return {
    updateNotice: readonly(updateNotice),
    canInstall,
    connectInstall,
    install,
    confirming: readonly(confirming),
    connect,
    confirmReload,
    cancelReload,
    resumeAfterUpdate,
    takeMarkedWork,
  }
})
