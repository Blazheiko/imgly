import { computed, nextTick, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import {
  adjustmentsEquals,
  appError,
  AUTO_SAMPLE_MAX_SIDE,
  createWork,
  err,
  fitView,
  geometryEquals,
  hasUnsavedEdits as workHasUnsavedEdits,
  isImageRefusal,
  panBy as panView,
  resizeView,
  setActualSize,
  sourceNameOf,
  stepZoom as stepView,
  turnedBounds,
  validateStoredWork,
  workSize,
  zoomAt as zoomView,
  type Adjustments,
  type AppError,
  type Geometry,
  type ImageFormat,
  type ImageSample,
  type Original,
  type Point,
  type Result,
  type Size,
  type StoredWorkFields,
  type View,
  type ViewContext,
  type Work,
} from '@/core'
import {
  decodeImage,
  isSuperseded,
  type DecodedImage,
  type DecodeOutcome,
} from '@/infra/image-decode'
import { loadWork, type LoadedWork } from '@/infra/db'
import { workCodec, type PixelSize } from '@/infra/work-codec'
import { requestPersistence } from '@/infra/platform'
import {
  createLayer,
  createPreviewRenderer,
  layerContext,
  probeCapabilities,
  releaseLayer,
  type Layer,
  type LayerRect,
  type PreviewRenderer,
  type RendererStatus,
} from '@/render'
import { closeBitmap, newId, useNotices, type NoticeInput } from '@/shared'
import {
  failureMessage,
  failureNoImageFiles,
  infoDownscaled,
  infoExportInProgress,
  infoFirstFrame,
  infoOthersIgnored,
} from './messages'
import { createAutosave } from './autosave'
import { createEditHistory } from './edit-history'
import { createToolSlot } from './tool-slot'

export type Autosave = ReturnType<typeof createAutosave>

export type Decoder = (file: Blob) => Promise<DecodeOutcome>

/** Creates the Preview's renderer on its canvas; injectable because happy-dom has no WebGL2. */
export type RendererFactory = (canvas: HTMLCanvasElement) => Result<PreviewRenderer, AppError>

/** The facts about an opened image that notices and the readout need — never the pixels. */
export type OpenedImage = Omit<DecodedImage, 'bitmap'>

export type OpenOutcome =
  | { kind: 'replaced'; image: OpenedImage }
  | { kind: 'confirming' }
  | { kind: 'cancelled' }
  | { kind: 'refused'; error: AppError }
  | { kind: 'superseded' }
  | { kind: 'ignored' }

export type ReopenOutcome =
  | { kind: 'replaced' }
  | { kind: 'confirming' }
  | { kind: 'cancelled' }
  | { kind: 'damaged'; error: AppError }
  | { kind: 'refused'; reason: 'exporting' | 'confirming' | 'unavailable' }
  | { kind: 'superseded' }
  | { kind: 'already-open' }

/** Where `reopenWork` reads a stored Work from; injectable like the decoder. */
export interface ReopenSource {
  loadWork: (id: string) => Promise<Result<LoadedWork, AppError>>
  decodePng: (blob: Blob, size: PixelSize) => Promise<Result<ImageBitmap, AppError>>
}

/** A stored Work read and decoded in full, waiting for the gate (gallery AC-17). */
interface RestoredWork {
  fields: StoredWorkFields
  bitmap: ImageBitmap
  layer: Layer | null
  original: Blob
  layerBlob: Blob | null
}

function discardRestored(restored: RestoredWork) {
  closeBitmap(restored.bitmap)
  if (restored.layer) releaseLayer(restored.layer)
}

export type EditorPhase = 'idle' | 'reading' | 'confirming' | 'exporting'

export type { ToolId, ToolRefusal } from './tool-slot'

/** A panel another feature has open, so a shortcut can stay silent under it (crop-rotate AC-20). */
export type PanelId = 'export' | 'gallery'

/** The Work as it was at confirm; the export renders it and the save point is its revision. */
export interface ExportSnapshot {
  workId: string
  revision: number
  original: Original<ImageBitmap>
  /** The Work's Geometry when the export was confirmed (crop-rotate AC-14, AC-15). */
  geometry: Geometry
  /** The Work's applied Adjustments when the export was confirmed (adjust AC-14). */
  adjustments: Adjustments
  /** The Work's applied Drawing layer when the export was confirmed, or null (draw AC-10). */
  drawing: Layer | null
  sourceName: string
  sourceFormat: ImageFormat
}

/**
 * Whether the canvas area can show the Preview: `checking` until the start-up gate answers,
 * `unsupported` → SCR-04 (AC-18), `restoring` while a lost context may return (AC-19),
 * `lost` → SCR-05 (AC-19b, DISPLAY_LOST) for the rest of the page's life.
 */
export type DisplayState = 'checking' | 'ok' | 'unsupported' | 'restoring' | 'lost'

/** The info notices one opened image raises, in catalog order (AC-05, AC-11). */
function imageNotices(image: OpenedImage): NoticeInput[] {
  const notices: NoticeInput[] = []
  if (image.downscaled) {
    notices.push({
      kind: 'info',
      text: infoDownscaled(
        { width: image.sourceWidth, height: image.sourceHeight },
        { width: image.width, height: image.height },
      ),
    })
  }
  if (image.animated) notices.push({ kind: 'info', text: infoFirstFrame() })
  return notices
}

/** Before the canvas has a size the View can't be fitted; auto-fit fits it once it has one. */
const UNSIZED_VIEW: View = { zoom: 1, panX: 0, panY: 0, autoFit: true }

/**
 * The editor store — the coordination point between features (no event bus) and the one place
 * that decides whether a decoded image replaces the Work. Latest open wins (AC-16b); the Work is
 * swapped in one synchronous action; View changes never touch the Work (AC-14).
 */
export const useEditorStore = defineStore('editor', () => {
  // shallowRef: an ImageBitmap must never be wrapped in a reactive proxy.
  const work = shallowRef<Work<ImageBitmap, OffscreenCanvas> | null>(null)
  const pending = shallowRef<DecodedImage | null>(null)
  const view = ref<View>(UNSIZED_VIEW)
  const canvasSize = ref<Size>({ width: 0, height: 0 })
  const phase = ref<EditorPhase>('idle')
  const display = ref<DisplayState>('checking')
  const activePanel = ref<PanelId | null>(null)
  const slot = createToolSlot({ work, phase, activePanel, view, fitIfSized })
  const { activeTool, previewGeometry, previewAdjustments, previewLayer } = slot
  const edits = createEditHistory({ work, phase, activeTool, fitIfSized })
  /** Space is held for space-pan: a tool's overlay lets the drag through to the canvas. */
  const spacePan = ref(false)
  /** A draw Stroke is in progress: Space must not start a pan until it ends (draw AC-18). */
  const strokeActive = ref(false)
  let latestOpenId = 0
  let reopenSource: ReopenSource | null = null
  let pendingRestore: RestoredWork | null = null
  let decode: Decoder = decodeImage
  let rendererFactory: RendererFactory = createPreviewRenderer
  const notices = useNotices()
  // The real Autosave, lazy in everything it touches: no Worker or database until a Gallery connects.
  const autosave = shallowRef<Autosave>(
    createAutosave({
      notices,
      codec: workCodec,
      renderer: () => {
        if (!renderer) throw new Error('no Preview renderer')
        return renderer
      },
      // The Preview uploads the new Original on its next flush.
      rendererReady: () => nextTick(),
      copyBitmap: (source) => createImageBitmap(source),
      encodeThumbnail: async (data) => {
        const canvas = new OffscreenCanvas(data.width, data.height)
        canvas.getContext('2d')!.putImageData(data, 0, 0)
        return canvas.convertToBlob({ type: 'image/png' })
      },
      requestPersistence,
      now: Date.now,
    }),
  )
  const saving = computed(() => autosave.value.saving.value)
  const galleryAvailable = computed(() => autosave.value.galleryAvailable.value)
  const openWorkId = computed(() => work.value?.id ?? null)
  // Notices that belong to the image awaiting confirmation; raised only if it replaces (AC-15).
  let heldNotices: NoticeInput[] = []
  // The file name of the image awaiting confirmation, for its Source name (export AC-08).
  let pendingFileName = ''

  const hasUnsavedEdits = computed(() => (work.value ? workHasUnsavedEdits(work.value) : false))

  /** Swaps the decoder and returns the previous one, so a wrapper can delegate to it. */
  function setDecoder(next: Decoder): Decoder {
    const previous = decode
    decode = next
    return previous
  }

  function setAutosave(next: Autosave) {
    autosave.value = next
  }

  function setReopenSource(next: ReopenSource | null) {
    reopenSource = next
  }

  function connectGallery(result: Parameters<Autosave['connectGallery']>[0]) {
    autosave.value.connectGallery(result)
    if (result.ok) {
      const db = result.value
      reopenSource = { loadWork: (id) => loadWork(db, id), decodePng: workCodec.decodePng }
    }
  }

  /** Hands the Work to Autosave: only after a replace, an Apply, an Undo or a Redo. */
  function requestSave() {
    if (work.value) autosave.value.request(work.value)
  }

  function commit(...args: Parameters<typeof edits.commit>) {
    const next = edits.commit(...args)
    requestSave()
    return next
  }

  function undo() {
    const moved = edits.undo()
    if (moved) requestSave()
    return moved
  }

  function redo() {
    const moved = edits.redo()
    if (moved) requestSave()
    return moved
  }

  function setRendererFactory(next: RendererFactory) {
    rendererFactory = next
  }

  // The Preview's renderer, held so Auto can sample the Work without the adjust feature touching it.
  let renderer: PreviewRenderer | undefined

  function createRenderer(canvas: HTMLCanvasElement) {
    const result = rendererFactory(canvas)
    if (result.ok) renderer = result.value
    return result
  }

  /** Auto's sample of the Work with its Geometry and no Adjustments (adjust ADR-0004). */
  function sampleWork(): Result<ImageSample, AppError> {
    if (!renderer || !work.value) return err(appError('DISPLAY_LOST'))
    return renderer.sampleCrop(work.value.geometry, AUTO_SAMPLE_MAX_SIDE)
  }

  /** Runs the start-up capability gate once; the drop guard must already be installed. */
  async function runCapabilityGate(probe = probeCapabilities) {
    const result = await probe()
    display.value = result.ok ? 'ok' : 'unsupported'
  }

  /** A lost display also drops a waiting replace: SCR-05 must never sit under the dialog. */
  function setRendererStatus(status: RendererStatus) {
    if (display.value === 'lost' || display.value === 'unsupported') return
    display.value = status === 'ready' ? 'ok' : status
    if (status === 'lost') cancelReplace()
  }

  function context(): ViewContext | undefined {
    const { width, height } = canvasSize.value
    if (!work.value || width === 0 || height === 0) return undefined
    const image =
      activeTool.value && previewGeometry.value
        ? turnedBounds(previewGeometry.value, work.value.original)
        : workSize(work.value)
    return { image: { width: image.width, height: image.height }, canvas: { width, height } }
  }

  /**
   * Applies Adjustments to the Work (adjust AC-11). It counts as an edit, and so as a Step, only
   * when a value differs from the Work's, which the open tool never changes before Apply. Refused
   * while exporting.
   */
  function applyAdjustments(next: Adjustments) {
    const current = work.value
    if (!current || phase.value === 'exporting') return
    const updated = { ...current, adjustments: { ...next } }
    if (adjustmentsEquals(next, current.adjustments)) work.value = updated
    else commit('adjust', current, updated)
  }

  /** The Work's applied Drawing layer as the browser holds it, or null. */
  function appliedLayer(): Layer | null {
    return work.value?.drawing ?? null
  }

  /**
   * The draw tool's Draft for the Preview. The renderer gets it at once, not on the Preview's next
   * watcher flush: a new Draft is still blank then, so its texture is allocated without a readback
   * before the first segment paints into it (spec §6 latency).
   */
  function setPreviewLayer(next: Layer | null) {
    slot.setPreviewLayer(next)
    if (activeTool.value === 'draw') renderer?.setLayer(next)
  }

  /** The open draw tool's dirty rectangle, straight to the renderer (draw ADR-0002 hot path). */
  function layerChanged(rect: LayerRect) {
    renderer?.updateLayer(rect)
  }

  /**
   * Applies the draw tool's Draft as the Work's Drawing layer with a new id (draw ADR-0004), as a
   * Step, when the Draft's change flag says it is an edit (AC-12). The layer it replaces stays with
   * the Edit history, which alone releases layers (undo-redo ADR-0002). With no change the Work
   * keeps its layer and the Draft, a copy with the same content, is released. Refused while
   * exporting, and then false: the caller still owns the Draft and must keep or release it.
   */
  function applyDrawing(draft: Layer | null, changed: boolean): boolean {
    const current = work.value
    if (!current || phase.value === 'exporting') return false
    if (changed) {
      commit('draw', current, { ...current, drawing: draft && { ...draft, id: newId() } })
    } else if (draft && draft.pixels !== current.drawing?.pixels) {
      releaseLayer(draft)
    }
    return true
  }

  /**
   * Applies a Geometry to the Work (AC-13). It counts as an edit, and so as a Step, only when it
   * differs field by field from the Work's Geometry, which the open tool never changes before Apply.
   */
  function applyGeometry(next: Geometry) {
    const current = work.value
    if (!current || phase.value === 'exporting') return
    const updated = { ...current, geometry: next }
    if (geometryEquals(next, current.geometry)) work.value = updated
    else commit('crop-rotate', current, updated)
  }

  function setActivePanel(panel: PanelId | null) {
    activePanel.value = panel
  }

  function fitIfSized() {
    const ctx = context()
    if (ctx) view.value = fitView(ctx)
  }

  async function openImage(file: Blob): Promise<OpenOutcome> {
    if (phase.value === 'confirming' || phase.value === 'exporting') return { kind: 'ignored' }
    const id = ++latestOpenId
    phase.value = 'reading'

    const outcome = await decode(file)
    if (isSuperseded(outcome) || id !== latestOpenId) {
      if (!isSuperseded(outcome) && outcome.ok) closeBitmap(outcome.value.bitmap)
      return { kind: 'superseded' }
    }
    if (!outcome.ok) {
      phase.value = 'idle'
      return { kind: 'refused', error: outcome.error }
    }

    // Stay in `reading` while a running save finishes, so the spinner stays (gallery AC-16).
    await autosave.value.settled()
    if (id !== latestOpenId) {
      closeBitmap(outcome.value.bitmap)
      return { kind: 'superseded' }
    }
    phase.value = 'idle'

    const fileName = file instanceof File ? file.name : ''
    if (needsConfirmation()) {
      heldNotices = []
      pending.value = outcome.value
      pendingFileName = fileName
      phase.value = 'confirming'
      return { kind: 'confirming' }
    }
    return replace(outcome.value, fileName)
  }

  /** Whether the open Work has Unsaved edits that the Gallery does not hold (gallery AC-17). */
  function needsConfirmation(): boolean {
    const open = work.value
    return (
      !!open &&
      workHasUnsavedEdits(open) &&
      (!autosave.value.galleryAvailable.value || !autosave.value.isStored(open))
    )
  }

  function confirmReplace(): OpenOutcome {
    if (phase.value === 'confirming' && pendingRestore) {
      const restored = pendingRestore
      pendingRestore = null
      phase.value = 'idle'
      replaceRestored(restored)
      return { kind: 'replaced', image: restoredFacts(restored) }
    }
    const image = pending.value
    if (phase.value !== 'confirming' || !image) return { kind: 'ignored' }
    pending.value = null
    phase.value = 'idle'
    const outcome = replace(image, pendingFileName)
    raiseAfterReplace(outcome, heldNotices)
    heldNotices = []
    return outcome
  }

  function cancelReplace(): OpenOutcome {
    if (phase.value !== 'confirming') return { kind: 'ignored' }
    if (pendingRestore) discardRestored(pendingRestore)
    pendingRestore = null
    if (pending.value) closeBitmap(pending.value.bitmap)
    pending.value = null
    phase.value = 'idle'
    heldNotices = []
    return { kind: 'cancelled' }
  }

  /** Raises an opened image's notices plus `extra` in one step, once it has replaced the Work. */
  function raiseAfterReplace(outcome: OpenOutcome, extra: NoticeInput[]) {
    if (outcome.kind !== 'replaced') return
    const all = [...imageNotices(outcome.image), ...extra]
    if (all.length > 0) notices.pushAll(all)
  }

  /** Opens one chosen file and raises its notices (after the replace) or its refusal. */
  async function openFile(file: Blob): Promise<OpenOutcome> {
    const outcome = await openImage(file)
    if (outcome.kind === 'refused')
      notices.pushAll([{ kind: 'failure', text: failureMessage(outcome.error) }])
    raiseAfterReplace(outcome, [])
    return outcome
  }

  /**
   * Tries dropped files in browser order until one is read (AC-03); a newer open stops the loop.
   * None read → the first image file's reason, or the AC-04 notice when none was an image. A file
   * named or typed as an image counts as one even when its content isn't (AC-08), and a refusal
   * made before the content was read counts only for such a file.
   */
  async function openDrop({ files }: { files: File[] }): Promise<OpenOutcome> {
    if (phase.value === 'exporting') {
      notices.pushAll([{ kind: 'info', text: infoExportInProgress() }])
      return { kind: 'ignored' }
    }
    if (files.length === 0) {
      notices.pushAll([{ kind: 'failure', text: failureNoImageFiles() }])
      return { kind: 'ignored' }
    }
    const ignored: NoticeInput[] =
      files.length > 1 ? [{ kind: 'info', text: infoOthersIgnored(files.length - 1) }] : []
    let firstImageRefusal: AppError | undefined

    for (const file of files) {
      const outcome = await openImage(file)
      if (outcome.kind === 'refused') {
        if (isImageRefusal(outcome.error, file)) firstImageRefusal ??= outcome.error
        continue
      }
      if (outcome.kind === 'confirming') heldNotices = ignored
      raiseAfterReplace(outcome, ignored)
      return outcome
    }

    notices.pushAll([
      {
        kind: 'failure',
        text: firstImageRefusal ? failureMessage(firstImageRefusal) : failureNoImageFiles(),
      },
    ])
    return firstImageRefusal ? { kind: 'refused', error: firstImageRefusal } : { kind: 'ignored' }
  }

  /**
   * Swaps in the new Work at Fit in one step, named after `fileName` (export AC-08); the old
   * Original is closed once it was picked up. The new Work starts an empty Edit history, which
   * releases every layer of the old one (undo-redo AC-10).
   */
  function replace(image: DecodedImage, fileName: string): OpenOutcome {
    const { bitmap, ...facts } = image
    swapIn(
      createWork(
        {
          width: image.width,
          height: image.height,
          pixels: bitmap,
          hasTransparency: image.hasTransparency,
        },
        newId(),
        { sourceName: sourceNameOf(fileName), sourceFormat: image.format },
      ),
    )
    requestSave()
    return { kind: 'replaced', image: facts }
  }

  /** Swaps `next` in at Fit with an empty Edit history; the old Original is closed afterwards. */
  function swapIn(next: Work<ImageBitmap, OffscreenCanvas>) {
    const previous = work.value
    const old = previous?.original.pixels
    // The open tool's Draft is discarded with the old Work (AC-17).
    slot.discard()
    work.value = next
    edits.clear(next, previous)
    const ctx = context()
    view.value = ctx ? fitView(ctx) : UNSIZED_VIEW
    if (old) void nextTick(() => closeBitmap(old))
  }

  function restoredFacts(restored: RestoredWork): OpenedImage {
    const { width, height, sourceFormat, hasTransparency } = restored.fields
    return {
      sourceWidth: width,
      sourceHeight: height,
      width,
      height,
      format: sourceFormat,
      animated: false,
      downscaled: false,
      hasTransparency,
    }
  }

  /** Swaps in a stored Work, then hands Autosave its Blobs so the next save encodes nothing. */
  function replaceRestored(restored: RestoredWork) {
    const { fields } = restored
    const base = createWork<ImageBitmap, OffscreenCanvas>(
      {
        width: fields.width,
        height: fields.height,
        pixels: restored.bitmap,
        hasTransparency: fields.hasTransparency,
      },
      fields.id,
      { sourceName: fields.sourceName, sourceFormat: fields.sourceFormat },
      fields.touchedAt,
    )
    swapIn({
      ...base,
      geometry: fields.geometry,
      adjustments: fields.adjustments,
      drawing: restored.layer,
    })
    autosave.value.keepEncoded(fields.id, {
      original: restored.original,
      layer: restored.layerBlob,
      layerId: restored.layer?.id ?? null,
    })
    requestSave()
  }

  /**
   * Reopens a stored Work. It is read, validated and decoded in full before the gate, so a Work that
   * cannot be read never replaces the open one and never asks (gallery AC-08, AC-17); latest open
   * wins across `openImage` and `reopenWork`.
   */
  async function reopenWork(id: string): Promise<ReopenOutcome> {
    if (phase.value === 'exporting') return { kind: 'refused', reason: 'exporting' }
    if (phase.value === 'confirming') return { kind: 'refused', reason: 'confirming' }
    const source = reopenSource
    if (!source) return { kind: 'refused', reason: 'unavailable' }
    if (work.value?.id === id) return { kind: 'already-open' }
    const mine = ++latestOpenId
    phase.value = 'reading'
    const damaged = (error: AppError): ReopenOutcome => {
      phase.value = 'idle'
      return { kind: 'damaged', error }
    }

    const loaded = await source.loadWork(id)
    if (mine !== latestOpenId) return { kind: 'superseded' }
    if (!loaded.ok) return damaged(loaded.error)
    const { record, original, layer: layerBlob } = loaded.value
    const valid = validateStoredWork(record, { hasOriginal: !!original, hasLayer: !!layerBlob })
    if (!valid.ok) return damaged(valid.error)
    const fields = valid.value
    const size = { width: fields.width, height: fields.height }

    const [bitmap, layerBitmap] = await Promise.all([
      source.decodePng(original, size),
      layerBlob ? source.decodePng(layerBlob, size) : Promise.resolve(null),
    ])
    const closeDecoded = () => {
      if (bitmap.ok) closeBitmap(bitmap.value)
      if (layerBitmap?.ok) closeBitmap(layerBitmap.value)
    }
    if (mine !== latestOpenId) {
      closeDecoded()
      return { kind: 'superseded' }
    }
    if (!bitmap.ok || (layerBitmap && !layerBitmap.ok)) {
      closeDecoded()
      return damaged(!bitmap.ok ? bitmap.error : (layerBitmap as { error: AppError }).error)
    }
    let layer: Layer | null = null
    if (layerBitmap?.ok) {
      layer = createLayer(size)
      layerContext(layer).drawImage(layerBitmap.value, 0, 0)
      closeBitmap(layerBitmap.value)
    }
    const restored: RestoredWork = { fields, bitmap: bitmap.value, layer, original, layerBlob }

    await autosave.value.settled()
    if (mine !== latestOpenId) {
      discardRestored(restored)
      return { kind: 'superseded' }
    }
    phase.value = 'idle'
    if (needsConfirmation()) {
      heldNotices = []
      pendingRestore = restored
      phase.value = 'confirming'
      return { kind: 'confirming' }
    }
    replaceRestored(restored)
    return { kind: 'replaced' }
  }

  /**
   * The test-only edit: raises the revision without changing the image or recording a Step.
   * Refused while exporting, so the file is the Work as it was at confirm (export AC-11).
   */
  function applyEdit() {
    if (work.value && phase.value !== 'exporting') edits.touch(work.value)
  }

  /**
   * Enters the exclusive `exporting` phase and snapshots the Work, or returns null when no Work is
   * open or the editor is busy (export AC-11).
   */
  function beginExport(): ExportSnapshot | null {
    const current = work.value
    if (!current || phase.value !== 'idle' || activeTool.value) return null
    phase.value = 'exporting'
    return {
      workId: current.id,
      revision: current.revision,
      original: current.original,
      geometry: current.geometry,
      adjustments: current.adjustments,
      drawing: appliedLayer(),
      sourceName: current.sourceName,
      sourceFormat: current.sourceFormat,
    }
  }

  /**
   * Leaves `exporting`. Only a finished hand-off (`saved`) sets the save point, and only to the
   * snapshot's revision, so a cancel, refusal or failure keeps Unsaved edits (export AC-09, AC-10).
   */
  function finishExport(snapshot: ExportSnapshot, saved: boolean) {
    if (phase.value === 'exporting') phase.value = 'idle'
    const current = work.value
    if (saved && current && current.id === snapshot.workId) {
      work.value = { ...current, cleanRevision: snapshot.revision }
    }
  }

  function updateView(next: (view: View, ctx: ViewContext) => View) {
    const ctx = context()
    if (ctx) view.value = next(view.value, ctx)
  }

  return {
    work,
    pending,
    view,
    canvasSize,
    phase,
    display,
    activeTool,
    previewGeometry,
    previewAdjustments,
    previewLayer,
    activePanel,
    spacePan,
    strokeActive,
    hasUnsavedEdits,
    editHistory: edits.history,
    canUndo: edits.canUndo,
    canRedo: edits.canRedo,
    undoTool: edits.undoTool,
    redoTool: edits.redoTool,
    historyStats: edits.stats,
    openTool: slot.openTool,
    closeTool: slot.closeTool,
    setPreviewGeometry: slot.setPreviewGeometry,
    applyGeometry,
    setPreviewAdjustments: slot.setPreviewAdjustments,
    applyAdjustments,
    setPreviewLayer,
    layerChanged,
    applyDrawing,
    setActivePanel,
    setSpacePan: (on: boolean) => (spacePan.value = on),
    setStrokeActive: (on: boolean) => (strokeActive.value = on),
    setDecoder,
    setAutosave,
    connectGallery,
    setReopenSource,
    reopenWork,
    saving,
    galleryAvailable,
    openWorkId,
    setRendererFactory,
    createRenderer,
    sampleWork,
    runCapabilityGate,
    setRendererStatus,
    openImage,
    openFile,
    openDrop,
    confirmReplace,
    cancelReplace,
    applyEdit,
    undo,
    redo,
    beginExport,
    finishExport,
    zoomAt: (factor: number, point: Point) => updateView((v, c) => zoomView(v, factor, point, c)),
    stepZoom: (direction: 1 | -1) => updateView((v, c) => stepView(v, direction, c)),
    panBy: (dx: number, dy: number) => updateView((v, c) => panView(v, dx, dy, c)),
    fit: () => updateView((_v, c) => fitView(c)),
    actualSize: () => updateView((v, c) => setActualSize(v, c)),
    setCanvasSize(width: number, height: number) {
      canvasSize.value = { width, height }
      updateView((v, c) => resizeView(v, c))
    },
  }
})
