import { computed, nextTick, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import {
  createWork,
  fitView,
  hasUnsavedEdits as workHasUnsavedEdits,
  looksLikeImageFile,
  panBy as panView,
  resizeView,
  setActualSize,
  stepZoom as stepView,
  withEdit,
  zoomAt as zoomView,
  type AppError,
  type Point,
  type Result,
  type Size,
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
import {
  createPreviewRenderer,
  probeCapabilities,
  type PreviewRenderer,
  type RendererStatus,
} from '@/render'
import { closeBitmap, newId, useNotices, type NoticeInput } from '@/shared'
import {
  failureMessage,
  failureNoImageFiles,
  infoDownscaled,
  infoFirstFrame,
  infoOthersIgnored,
} from './messages'

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

export type EditorPhase = 'idle' | 'reading' | 'confirming'

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
  const work = shallowRef<Work<ImageBitmap> | null>(null)
  const pending = shallowRef<DecodedImage | null>(null)
  const view = ref<View>(UNSIZED_VIEW)
  const canvasSize = ref<Size>({ width: 0, height: 0 })
  const phase = ref<EditorPhase>('idle')
  const display = ref<DisplayState>('checking')
  let latestOpenId = 0
  let decode: Decoder = decodeImage
  let rendererFactory: RendererFactory = createPreviewRenderer
  const notices = useNotices()
  // Notices that belong to the image awaiting confirmation; raised only if it replaces (AC-15).
  let heldNotices: NoticeInput[] = []

  const hasUnsavedEdits = computed(() => (work.value ? workHasUnsavedEdits(work.value) : false))

  /** Swaps the decoder and returns the previous one, so a wrapper can delegate to it. */
  function setDecoder(next: Decoder): Decoder {
    const previous = decode
    decode = next
    return previous
  }

  function setRendererFactory(next: RendererFactory) {
    rendererFactory = next
  }

  function createRenderer(canvas: HTMLCanvasElement) {
    return rendererFactory(canvas)
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
    const { original } = work.value
    return { image: { width: original.width, height: original.height }, canvas: { width, height } }
  }

  async function openImage(file: Blob): Promise<OpenOutcome> {
    if (phase.value === 'confirming') return { kind: 'ignored' }
    const id = ++latestOpenId
    phase.value = 'reading'

    const outcome = await decode(file)
    if (isSuperseded(outcome) || id !== latestOpenId) {
      if (!isSuperseded(outcome) && outcome.ok) closeBitmap(outcome.value.bitmap)
      return { kind: 'superseded' }
    }
    phase.value = 'idle'
    if (!outcome.ok) return { kind: 'refused', error: outcome.error }

    if (work.value && workHasUnsavedEdits(work.value)) {
      heldNotices = []
      pending.value = outcome.value
      phase.value = 'confirming'
      return { kind: 'confirming' }
    }
    return replace(outcome.value)
  }

  function confirmReplace(): OpenOutcome {
    const image = pending.value
    if (phase.value !== 'confirming' || !image) return { kind: 'ignored' }
    pending.value = null
    phase.value = 'idle'
    const outcome = replace(image)
    raiseAfterReplace(outcome, heldNotices)
    heldNotices = []
    return outcome
  }

  function cancelReplace(): OpenOutcome {
    if (phase.value !== 'confirming') return { kind: 'ignored' }
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
   * named or typed as an image counts as one even when its content isn't (AC-08).
   */
  async function openDrop({ files }: { files: File[] }): Promise<OpenOutcome> {
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
        if (outcome.error.code !== 'NOT_AN_IMAGE' || looksLikeImageFile(file)) {
          firstImageRefusal ??= outcome.error
        }
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

  /** Swaps in the new Work at Fit in one step; the old Original is closed once it was picked up. */
  function replace(image: DecodedImage): OpenOutcome {
    const old = work.value?.original.pixels
    const { bitmap, ...facts } = image
    work.value = createWork({ width: image.width, height: image.height, pixels: bitmap }, newId())
    const ctx = context()
    view.value = ctx ? fitView(ctx) : UNSIZED_VIEW
    if (old) void nextTick(() => closeBitmap(old))
    return { kind: 'replaced', image: facts }
  }

  /** The edit entry point: every change to the Work goes through here and raises its revision. */
  function applyEdit() {
    if (work.value) work.value = withEdit(work.value)
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
    hasUnsavedEdits,
    setDecoder,
    setRendererFactory,
    createRenderer,
    runCapabilityGate,
    setRendererStatus,
    openImage,
    openFile,
    openDrop,
    confirmReplace,
    cancelReplace,
    applyEdit,
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
