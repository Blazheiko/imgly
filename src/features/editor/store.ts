import { computed, nextTick, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import {
  createWork,
  fitView,
  hasUnsavedEdits as workHasUnsavedEdits,
  panBy as panView,
  resizeView,
  setActualSize,
  stepZoom as stepView,
  withEdit,
  zoomAt as zoomView,
  type AppError,
  type Point,
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
import { newId } from '@/shared'

export type Decoder = (file: Blob) => Promise<DecodeOutcome>

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
  let latestOpenId = 0
  let decode: Decoder = decodeImage

  const hasUnsavedEdits = computed(() => (work.value ? workHasUnsavedEdits(work.value) : false))

  function setDecoder(next: Decoder) {
    decode = next
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
      if (!isSuperseded(outcome) && outcome.ok) outcome.value.bitmap.close()
      return { kind: 'superseded' }
    }
    phase.value = 'idle'
    if (!outcome.ok) return { kind: 'refused', error: outcome.error }

    if (work.value && workHasUnsavedEdits(work.value)) {
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
    return replace(image)
  }

  function cancelReplace(): OpenOutcome {
    if (phase.value !== 'confirming') return { kind: 'ignored' }
    pending.value?.bitmap.close()
    pending.value = null
    phase.value = 'idle'
    return { kind: 'cancelled' }
  }

  /** Swaps in the new Work at Fit in one step; the old Original is closed once it was picked up. */
  function replace(image: DecodedImage): OpenOutcome {
    const old = work.value?.original.pixels
    const { bitmap, ...facts } = image
    work.value = createWork({ width: image.width, height: image.height, pixels: bitmap }, newId())
    const ctx = context()
    view.value = ctx ? fitView(ctx) : UNSIZED_VIEW
    if (old) void nextTick(() => old.close())
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
    hasUnsavedEdits,
    setDecoder,
    openImage,
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
