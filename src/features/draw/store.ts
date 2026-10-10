import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  DEFAULT_COLOUR,
  DEFAULT_WIDTH,
  MAX_WIDTH,
  MIN_WIDTH,
  parseWidth,
  stepWidth as stepped,
  type DrawMode,
} from '@/core'
import { useEditorStore } from '@/features/editor'
import { copyLayer, createLayer, hasAnyMark, releaseLayer, type Layer } from '@/render'

const HEX_COLOUR = /^#[0-9a-f]{6}$/i

/**
 * The "Draw" tool's state (draw ADR-0004, sad.md §4, §5): the Draft — a full copy of the Work's
 * Drawing layer, or null while empty — the per-Draft change flag, the mode, and the colour and
 * width, which are tool settings kept until reload and never edits (AC-02). The Draft reaches the
 * Preview only through `editor.setPreviewLayer` and the Work only through `editor.applyDrawing` on
 * Apply. Its only cross-feature import is the editor store.
 */
export const useDrawStore = defineStore('draw', () => {
  const editor = useEditorStore()
  // shallowRef: a canvas must never be wrapped in a reactive proxy, and the hot path paints into
  // it without triggering any reactive update.
  const draft = shallowRef<Layer | null>(null)
  const mode = ref<DrawMode>('brush')
  const colour = ref(DEFAULT_COLOUR)
  const width = ref(DEFAULT_WIDTH)
  /** A pointer is pressed on the image: input that would change the Stroke waits (AC-18). */
  const strokeActive = ref(false)
  // AC-12: a Brush footprint inside the Crop, an Eraser that lowered some alpha, or a Clear of
  // a Draft with a mark. Never a pixel comparison.
  let changed = false

  const isOpen = computed(() => editor.activeTool === 'draw')

  // The editor closes the slot on Apply, Cancel and a confirmed replace: the Draft goes with it,
  // unless Apply has already handed it to the Work.
  watch(
    () => editor.activeTool,
    (tool) => {
      if (tool === 'draw') return
      if (draft.value) releaseLayer(draft.value)
      draft.value = null
      strokeActive.value = false
      changed = false
    },
    { flush: 'sync' },
  )

  function show(next: Layer | null) {
    draft.value = next
    editor.setPreviewLayer(next)
  }

  /** Opens on the Brush with a copy of the Work's layer, or answers why it may not open (AC-01). */
  function open() {
    const result = editor.openTool('draw')
    if (!result.ok) return result
    mode.value = 'brush'
    changed = false
    const applied = editor.work!.drawing as Layer | null
    show(applied && copyLayer(applied))
    return result
  }

  /** The Draft to paint into; the first mark on an empty Draft creates its bitmap (ADR-0001). */
  function ensureDraft(): Layer {
    if (draft.value) return draft.value
    const original = editor.work!.original
    const layer = createLayer({ width: original.width, height: original.height })
    show(layer)
    return layer
  }

  /** The Draft now holds a change that Apply must count as an edit (AC-12). */
  function markChanged() {
    changed = true
  }

  function setMode(next: DrawMode) {
    mode.value = next
  }

  /** A palette or picker colour; anything but a full `#RRGGBB` is ignored (AC-02). */
  function setColour(next: string) {
    if (HEX_COLOUR.test(next)) colour.value = next.toUpperCase()
  }

  /** A slider value, made a whole number within 1…200. */
  function setWidth(next: number) {
    width.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(next)))
  }

  /** Applies the width field's text by the AC-03 rule and answers the width, for the field to show. */
  function commitWidthText(text: string): number {
    width.value = parseWidth(text, width.value)
    return width.value
  }

  /** `[` and `]`: ±1, ±10 with Shift, within 1…200 (AC-19). */
  function stepWidth(delta: number) {
    width.value = stepped(width.value, delta)
  }

  /** Empties the whole Draft at once, without a confirmation (AC-05). */
  function clear() {
    const current = draft.value
    if (!current) return
    if (hasAnyMark(current)) changed = true
    releaseLayer(current)
    show(null)
  }

  /** Hands the Draft to the Work (an edit only with the change flag, AC-12) and closes the tool. */
  function apply() {
    if (!isOpen.value || !editor.work) return
    const handed = draft.value
    draft.value = null // the Work owns it now: the close below must not release it
    editor.applyDrawing(handed, changed)
    editor.closeTool()
  }

  /** Closes the tool; the Work keeps the layer it had, and the Draft is released (AC-06). */
  function cancel() {
    editor.closeTool()
  }

  return {
    draft,
    mode,
    colour,
    width,
    strokeActive,
    isOpen,
    open,
    ensureDraft,
    markChanged,
    setMode,
    setColour,
    setWidth,
    commitWidthText,
    stepWidth,
    clear,
    apply,
    cancel,
  }
})
