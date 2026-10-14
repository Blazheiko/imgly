import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import type { IDBPDatabase } from 'idb'
import { entryName, storageLine as storageLineKind, touchedLabel } from '@/core'
import type { AppError, Result } from '@/core'
import { deleteWork, listWorks } from '@/infra/db'
import type { ImglyDb } from '@/infra/db'
import { isPersisted } from '@/infra/platform'
import { useEditorStore } from '@/features/editor'
import { useNotices } from '@/shared'
import {
  damagedNoticeAction,
  failureCouldNotDelete,
  failureWorkDamaged,
  hintChooseWhileConfirming,
  hintChooseWhileExporting,
  hintOpenWorkCannotBeDeleted,
  storageLineNotPersisted,
  storageLinePersisted,
} from './messages'
import type { UnavailableReason } from './messages'

export interface GalleryEntry {
  id: string
  name: string
  status: 'touched' | 'open' | 'damaged'
  label: string
  thumbnailUrl: string | null
}

type Db = IDBPDatabase<ImglyDb>

/** The Gallery's view-model: what is listed, the storage line, and what choosing or deleting does. */
export const useGallery = defineStore('gallery', () => {
  const editor = useEditorStore()
  const notices = useNotices()

  const connection = shallowRef<Result<Db, AppError> | null>(null)
  const entries = ref<GalleryEntry[]>([])
  const storageLine = ref('')
  /** The list has been read at least once; until then the section shows only its title (R2-3). */
  const listRead = ref(false)
  const overlayOpen = ref(false)
  const reopening = ref<string | null>(null)
  /** GalleryLists on screen; each hosts its own delete dialog, so the app-level one stands down. */
  const listsMounted = ref(0)
  const pendingDelete = ref<{ id: string; name: string } | null>(null)
  let clock: () => number = () => Date.now()

  const count = computed(() => entries.value.length)

  const unavailableReason = computed<UnavailableReason | null>(() => {
    const c = connection.value
    if (!c) return null
    if (!c.ok) return c.error.details?.reason === 'held' ? 'held' : 'refused'
    return editor.galleryAvailable ? null : 'newer-version'
  })

  function connect(result: Result<Db, AppError>) {
    connection.value = result
  }

  function setClock(next: () => number) {
    clock = next
  }

  function revokeAll(list: GalleryEntry[]) {
    for (const e of list) if (e.thumbnailUrl) URL.revokeObjectURL(e.thumbnailUrl)
  }

  let refreshSeq = 0

  /** Reads the list again; there is no live refresh. Only the newest call assigns. */
  async function refresh() {
    const seq = ++refreshSeq
    const previous = entries.value
    const c = connection.value
    if (unavailableReason.value !== null || !c || !c.ok) {
      entries.value = []
      storageLine.value = ''
      revokeAll(previous)
      return
    }
    const listed = await listWorks(c.value)
    const persisted = await isPersisted()
    storageLine.value =
      storageLineKind(persisted) === 'persisted'
        ? storageLinePersisted()
        : storageLineNotPersisted()
    let next: GalleryEntry[] = []
    if (listed.ok) {
      const now = clock()
      const openId = editor.openWorkId
      next = listed.value.map((w) => ({
        id: w.id,
        name: entryName(w.sourceName),
        // The open Work is live and stored by Autosave, whatever this page marked earlier.
        status:
          w.id === openId
            ? 'open'
            : w.damaged || editor.damagedIds.has(w.id)
              ? 'damaged'
              : 'touched',
        label: touchedLabel(w.touchedAt, now),
        thumbnailUrl: w.record ? URL.createObjectURL(w.record.thumbnail) : null,
      }))
    }
    if (seq !== refreshSeq) {
      revokeAll(next)
      return
    }
    // The previous list's URLs go only after the DOM has moved to the new ones.
    const stale = entries.value
    entries.value = next
    listRead.value = true
    await nextTick()
    revokeAll(stale)
  }

  async function open() {
    await refresh()
    overlayOpen.value = true
    editor.setActivePanel('gallery')
  }

  function close() {
    overlayOpen.value = false
    pendingDelete.value = null
    editor.setActivePanel(null)
  }

  // A pending delete is a modal dialog over whatever is on screen: the editor holds still (R2-4).
  watch(pendingDelete, (p) => editor.setGalleryModal(p !== null), { flush: 'sync' })

  // A reopen that asked first (AC-17) completes on Replace, outside choose(): the overlay follows.
  watch(
    () => editor.openWorkId,
    () => {
      if (overlayOpen.value) close()
    },
  )

  async function choose(id: string) {
    const entry = entries.value.find((e) => e.id === id)
    if (entry?.status === 'open') {
      close()
      return
    }
    reopening.value = id
    let outcome
    try {
      outcome = await editor.reopenWork(id)
    } finally {
      reopening.value = null
    }
    switch (outcome.kind) {
      case 'replaced':
      case 'already-open':
        close()
        break
      case 'refused':
        if (outcome.reason === 'exporting')
          notices.pushAll([{ kind: 'info', text: hintChooseWhileExporting() }])
        else if (outcome.reason === 'confirming')
          notices.pushAll([{ kind: 'info', text: hintChooseWhileConfirming() }])
        break
      case 'damaged': {
        if (entry) entry.status = 'damaged'
        notices.pushAll([
          {
            kind: 'failure',
            text: failureWorkDamaged(entry?.name ?? ''),
            action: { label: damagedNoticeAction(), run: () => requestDelete(id) },
          },
        ])
        break
      }
      default:
        break
    }
  }

  /** A thumbnail that will not decode: the Work is Damaged now, and stays so across refresh. */
  function markDamaged(id: string, thumbnailUrl?: string) {
    const entry = entries.value.find((e) => e.id === id)
    if (thumbnailUrl !== undefined && entry?.thumbnailUrl !== thumbnailUrl) return
    editor.markDamaged(id)
    if (entry) entry.status = 'damaged'
  }

  function requestDelete(id: string) {
    if (id === editor.openWorkId) {
      notices.pushAll([{ kind: 'info', text: hintOpenWorkCannotBeDeleted() }])
      return
    }
    const entry = entries.value.find((e) => e.id === id)
    if (entry) pendingDelete.value = { id, name: entry.name }
  }

  async function confirmDelete() {
    const pending = pendingDelete.value
    const c = connection.value
    if (!pending || !c || !c.ok) return
    pendingDelete.value = null
    const result = await deleteWork(c.value, pending.id, { keep: editor.openWorkId ?? '' })
    if (result.ok) await refresh()
    else notices.pushAll([{ kind: 'failure', text: failureCouldNotDelete(pending.name) }])
  }

  function cancelDelete() {
    pendingDelete.value = null
  }

  return {
    entries,
    count,
    storageLine,
    listRead,
    unavailableReason,
    overlayOpen,
    reopening,
    pendingDelete,
    listsMounted,
    connect,
    setClock,
    refresh,
    open,
    close,
    choose,
    markDamaged,
    requestDelete,
    confirmDelete,
    cancelDelete,
  }
})
