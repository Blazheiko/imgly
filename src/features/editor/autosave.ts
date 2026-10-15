import { readonly, ref } from 'vue'
import { toStoredFields, type AppError, type DrawingLayer, type Result, type Work } from '@/core'
import { storeWork, type ImglyDb } from '@/infra/db'
import { RESTORE_DEADLINE_MS, type PreviewRenderer, type RendererStatus } from '@/render'
import type { useNotices } from '@/shared/notices'
import { createSaveQueue } from './autosave-queue'
import { failureSaveFailed, failureStorageFull, infoEvicted } from './messages'
import type { IDBPDatabase } from 'idb'

type W = Work<ImageBitmap, OffscreenCanvas>
type Db = IDBPDatabase<ImglyDb>

/**
 * Resolves once a restoring renderer is ready or has given up. The renderer itself turns `lost`
 * after RESTORE_DEADLINE_MS; the same bound here covers one disposed while restoring.
 */
function untilRestored(renderer: PreviewRenderer): Promise<RendererStatus> {
  if (renderer.status !== 'restoring') return Promise.resolve(renderer.status)
  return new Promise((resolve) => {
    const done = (status: RendererStatus) => {
      clearTimeout(timer)
      off()
      resolve(status)
    }
    const timer = setTimeout(() => done(renderer.status), RESTORE_DEADLINE_MS)
    const off = renderer.onStatus((status) => {
      if (status !== 'restoring') done(status)
    })
  })
}

/** The thumbnail, waiting out a lost context that is being restored (open-and-view AC-19). */
async function thumbnailOf(renderer: PreviewRenderer, work: W) {
  // A context may be lost again right after a restore: try again while it keeps coming back.
  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await untilRestored(renderer)) !== 'ready') return null
    const pixels = renderer.renderThumbnail(work)
    if (pixels || renderer.status !== 'restoring') return pixels
  }
  return null
}

export interface AutosaveDeps {
  notices: Pick<ReturnType<typeof useNotices>, 'items' | 'pushAll' | 'dismiss'>
  codec: { encodePng(bitmap: ImageBitmap): Promise<Result<Blob, AppError>> }
  renderer: () => PreviewRenderer
  rendererReady: () => Promise<unknown>
  /** A bitmap the codec may transfer away; the renderer's own bitmap is never handed over. */
  copyBitmap: (source: ImageBitmap | OffscreenCanvas) => Promise<ImageBitmap>
  encodeThumbnail: (data: ImageData) => Promise<Blob>
  requestPersistence: () => Promise<boolean>
  now: () => number
  damagedIds?: () => ReadonlySet<string>
  /** A save of this Work committed: it is stored whole again. */
  onStored?: (workId: string) => void
}

/** The codec worker of this build is gone: a newer build replaced it (pwa-install-update AC-14). */
class PartUnavailable extends Error {}

interface Held {
  workId: string
  original: Blob | null
  layer: Blob | null
  layerId: string | null
}

/** Prepares, stores and reports every save of the open Work (gallery ADR-0003, 0004, 0006). */
export function createAutosave(deps: AutosaveDeps) {
  const available = ref(false)
  /** A newer version took the Gallery; this window stopped saving (pwa-install-update ADR-0002). */
  const superseded = ref(false)
  let db: Db | null = null
  let closing = false
  let held: Held | null = null
  // Works with a Stored state in the Gallery: a save of theirs committed, or they were reopened.
  const storedIds = new Set<string>()
  const failures: { full: string | null; failed: string | null } = { full: null, failed: null }
  const noDamage: ReadonlySet<string> = new Set()

  function holdFor(workId: string): Held {
    if (!held || held.workId !== workId) {
      held = { workId, original: null, layer: null, layerId: null }
    }
    return held
  }

  function withdraw(kind: 'full' | 'failed') {
    const id = failures[kind]
    if (id === null) return
    deps.notices.dismiss(id)
    failures[kind] = null
  }

  function fail(kind: 'full' | 'failed') {
    // One notice per run (AC-11). Success never ends a storage-full run, so once the Editor has
    // dismissed that notice the next quota failure shows it again.
    const shown = failures[kind]
    if (shown !== null && (kind === 'failed' || deps.notices.items.some((n) => n.id === shown)))
      return
    const [id] = deps.notices.pushAll([
      { kind: 'failure', text: kind === 'full' ? failureStorageFull() : failureSaveFailed() },
    ])
    failures[kind] = id!
  }

  async function encode(source: ImageBitmap | OffscreenCanvas): Promise<Blob | null> {
    const result = await deps.codec.encodePng(await deps.copyBitmap(source))
    if (!result.ok && result.error.code === 'APP_PART_UNAVAILABLE') throw new PartUnavailable()
    return result.ok ? result.value : null
  }

  async function prepareAndStore(work: W, target: Db): Promise<boolean> {
    await deps.rendererReady()
    const mine = holdFor(work.id)
    let layerChanged = false
    mine.original ??= await encode(work.original.pixels)
    const drawing: DrawingLayer<OffscreenCanvas> | null = work.drawing
    if (!drawing) {
      mine.layer = null
      mine.layerId = null
    } else if (mine.layerId !== drawing.id || !mine.layer) {
      mine.layer = await encode(drawing.pixels)
      mine.layerId = drawing.id
      layerChanged = true
    }
    const pixels = await thumbnailOf(deps.renderer(), work)
    if (!mine.original || (drawing && !mine.layer) || !pixels) {
      if (drawing && !mine.layer) mine.layerId = null
      fail('failed')
      return false
    }
    const thumbnail = await deps.encodeThumbnail(pixels)

    const stored = await storeWork(
      target,
      { ...toStoredFields(work, deps.now()), thumbnail },
      { original: mine.original, layer: mine.layer, layerChanged },
      {
        keep: work.id,
        damaged: deps.damagedIds?.() ?? noDamage,
        onFirstSave: () => {
          // Never awaited: the browser may ask the person, and the save has already committed.
          void Promise.resolve(deps.requestPersistence()).catch(() => {})
        },
      },
    )
    if (!stored.ok) {
      fail(stored.error.code === 'STORAGE_QUOTA' ? 'full' : 'failed')
      return false
    }
    withdraw('failed')
    storedIds.add(work.id)
    deps.onStored?.(work.id)
    if (stored.value.evicted.length > 0) {
      deps.notices.pushAll([{ kind: 'info', text: infoEvicted(stored.value.evicted) }])
    }
    return true
  }

  const queue = createSaveQueue<W>(async (work) => {
    if (!db || closing) return false
    const target = db
    try {
      return await prepareAndStore(work, target)
    } catch (error) {
      // Not awaited: the stop waits for this very save to settle.
      if (error instanceof PartUnavailable) void stop(target)
      else fail('failed')
      return false
    }
  })

  /**
   * A newer version took the Gallery (`versionchange`) or replaced this build's codec worker: let
   * the running save finish, drop the pending one, close, and go unavailable (gallery ADR-0006).
   * The update notice says so; Autosave raises only `superseded` (pwa-install-update ADR-0002).
   */
  async function stop(connection: Db) {
    if (closing) return
    closing = true
    queue.dropPending()
    await queue.settled()
    connection.close()
    db = null
    available.value = false
    superseded.value = true
  }

  return {
    request(work: W) {
      if (db && !closing) queue.request(work)
    },
    saving: queue.saving,
    settled: () => queue.settled(),
    isStored: (work: W) => available.value && queue.isStored(work),
    /** The Work has a Stored state to reopen, whether or not its latest revision is stored. */
    hasStoredState: (workId: string) => storedIds.has(workId),
    galleryAvailable: readonly(available),
    superseded: readonly(superseded),
    connectGallery(result: Result<Db, AppError>) {
      if (!result.ok) return
      db = result.value
      closing = false
      available.value = true
      db.addEventListener('versionchange', () => void stop(result.value))
    },
    keepEncoded(
      workId: string,
      blobs: { original: Blob; layer: Blob | null; layerId: string | null },
    ) {
      held = { workId, ...blobs }
      storedIds.add(workId)
    },
  }
}
