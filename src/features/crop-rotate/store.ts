import { ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  applyProportion,
  FREE,
  flipOnScreen,
  identityGeometry,
  moveCrop,
  parseAngle,
  parseCropSize,
  ratioOf,
  resizeCropLocked,
  rotateQuarter,
  setCropSize,
  setStraighten,
  straightenAnchor,
  turnProportion,
  type CropHandle,
  type Geometry,
  type Proportion,
  type ScreenAxis,
  type StraightenAnchor,
  type TurnDirection,
} from '@/core'
import { useEditorStore } from '@/features/editor'

/** The tool's text fields, checked only when left or on Enter (AC-07, AC-10). */
export type CropField = 'angle' | 'width' | 'height'

const NO_PENDING: Record<CropField, string | null> = { angle: null, width: null, height: null }

/**
 * The "Crop and rotate" tool's state (ADR-0003): the Draft, kept apart from the Work until Apply,
 * the proportion remembered per Work (AC-08) and the text still being typed. Every rule is
 * `core/geometry`'s; the Draft reaches the Preview only through `editor.previewGeometry`.
 */
export const useCropRotateStore = defineStore('crop-rotate', () => {
  const editor = useEditorStore()
  const draft = shallowRef<Geometry | null>(null)
  const proportion = ref<Proportion>(FREE)
  const pending = ref<Record<CropField, string | null>>({ ...NO_PENDING })
  // Remembered for the open Work only, as soon as chosen, until it is replaced (AC-08).
  const remembered = new Map<string, Proportion>()
  let dragStart: Geometry | null = null
  // Kept while only the angle changes, so its steps never drift (AC-05, AC-06, AC-08).
  let angleAnchor: StraightenAnchor | null = null

  // The editor closes the slot on Apply, Cancel and a confirmed replace: the Draft goes with it.
  watch(
    () => editor.activeTool,
    (tool) => {
      if (tool === 'crop-rotate') return
      draft.value = null
      dragStart = null
      angleAnchor = null
      pending.value = { ...NO_PENDING }
    },
    { flush: 'sync' },
  )

  watch(
    () => editor.work?.id,
    (id) => {
      for (const key of remembered.keys()) if (key !== id) remembered.delete(key)
    },
  )

  const original = () => editor.work!.original

  /** Any change but the angle's ends the angle interaction, so the next one starts afresh. */
  function update(next: Geometry, keepAnchor = false) {
    draft.value = next
    if (!keepAnchor) angleAnchor = null
    editor.setPreviewGeometry(next)
  }

  /** Opens the tool with the Work's Geometry as the Draft, or answers why it may not open. */
  function open() {
    const result = editor.openTool('crop-rotate')
    if (!result.ok) return result
    const work = editor.work!
    draft.value = work.geometry
    proportion.value = remembered.get(work.id) ?? FREE
    pending.value = { ...NO_PENDING }
    return result
  }

  function rotate(dir: TurnDirection) {
    if (!draft.value) return
    update(rotateQuarter(draft.value, dir, original()))
    proportion.value = turnProportion(proportion.value)
  }

  function flip(axis: ScreenAxis) {
    if (draft.value) update(flipOnScreen(draft.value, axis, original()))
  }

  /** The Straighten angle in tenths of a degree (AC-05, AC-06). */
  function setAngle(tenths: number) {
    const g = draft.value
    if (!g) return
    angleAnchor ??= straightenAnchor(g, original(), ratioOf(proportion.value, g, original()))
    update(setStraighten(g, tenths, original(), angleAnchor), true)
  }

  /** Moves the frame by image pixels, from where it is now (arrow keys). */
  function moveBy(dx: number, dy: number) {
    if (draft.value) update(moveCrop(draft.value, dx, dy, original()))
  }

  /** Resizes by an edge or corner, from where it is now; a locked proportion follows (AC-08). */
  function resizeBy(handle: CropHandle, dx: number, dy: number) {
    if (draft.value) {
      update(resizeCropLocked(draft.value, handle, dx, dy, proportion.value, original()))
    }
  }

  /** A pointer drag counts from where it started, so going back gives the start back. */
  function beginDrag() {
    dragStart = draft.value
  }

  function dragMove(dx: number, dy: number) {
    if (dragStart) update(moveCrop(dragStart, dx, dy, original()))
  }

  function dragResize(handle: CropHandle, dx: number, dy: number) {
    if (dragStart) {
      update(resizeCropLocked(dragStart, handle, dx, dy, proportion.value, original()))
    }
  }

  function endDrag() {
    dragStart = null
  }

  /** Locks the frame to a proportion, remembered for this Work at once (AC-08). */
  function chooseProportion(next: Proportion) {
    const work = editor.work
    if (!draft.value || !work) return
    proportion.value = next
    remembered.set(work.id, next)
    update(applyProportion(draft.value, next, original()))
  }

  function setPending(field: CropField, text: string) {
    pending.value = { ...pending.value, [field]: text }
  }

  /** Applies a field's typed text through the core rules; it never applies the tool. */
  function commitField(field: CropField) {
    const text = pending.value[field]
    pending.value = { ...pending.value, [field]: null }
    const g = draft.value
    if (text === null || !g) return
    if (field === 'angle') {
      setAngle(parseAngle(text, g.straighten))
      return
    }
    const previous = field === 'width' ? g.crop.width : g.crop.height
    const px = parseCropSize(text, previous)
    if (px !== previous) update(setCropSize(g, field, px, proportion.value, original()))
  }

  /** No Geometry and Free, on the Draft only: it reaches the Work only on Apply (AC-12). */
  function reset() {
    if (!draft.value) return
    proportion.value = FREE
    update(identityGeometry(original()))
  }

  /**
   * Stores the Draft (an edit only when it differs, AC-13) and closes the tool. The proportion it
   * closes with is remembered, so a Rotate (4:3 → 3:4) or a Reset (Free) carries over (AC-08).
   */
  function apply() {
    const g = draft.value
    const work = editor.work
    if (!g || !work) return
    remembered.set(work.id, proportion.value)
    editor.applyGeometry(g)
    editor.closeTool()
  }

  /** Closes the tool; the Work keeps the Geometry it had (AC-11). */
  function cancel() {
    editor.closeTool()
  }

  return {
    draft,
    proportion,
    pending,
    open,
    rotate,
    flip,
    setAngle,
    moveBy,
    resizeBy,
    beginDrag,
    dragMove,
    dragResize,
    endDrag,
    chooseProportion,
    setPending,
    commitField,
    reset,
    apply,
    cancel,
  }
})
