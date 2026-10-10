import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import { turnedBounds, type Adjustments, type Geometry, type View, type Work } from '@/core'
import type { EditorPhase, PanelId } from './store'

/** A tool that edits the Work in the tool slot; one at a time (crop-rotate ADR-0003). */
export type ToolId = 'crop-rotate' | 'adjust'

/** Why a tool may not open: no image (AC-18), an export running (AC-15), or one already open. */
export type ToolRefusal = 'no-work' | 'exporting' | 'tool-open' | 'panel-open' | 'confirming'

/** What the slot reads from the editor store; the store owns these and composes the slot. */
export interface ToolSlotDeps {
  work: ShallowRef<Work<ImageBitmap> | null>
  phase: Ref<EditorPhase>
  activePanel: Ref<PanelId | null>
  view: Ref<View>
  fitIfSized: () => void
}

/**
 * The editor's tool slot (draw sad.md §5): which tool is open and what the Preview draws while it
 * is. A plain composable the editor store composes, so its public API is unchanged.
 */
export function createToolSlot({ work, phase, activePanel, view, fitIfSized }: ToolSlotDeps) {
  const activeTool = ref<ToolId | null>(null)
  // What the Preview draws while a tool is open, whole and turned, instead of the Work's Geometry.
  const previewGeometry = shallowRef<Geometry | null>(null)
  // What the Preview colours with while the adjust tool is open: its Draft, or neutral values while
  // Compare is held. Null otherwise, so the Preview uses the Work's Adjustments.
  const previewAdjustments = shallowRef<Adjustments | null>(null)

  /**
   * Opens a tool over the Work. Crop and rotate shows the whole turned image, fitted (crop-rotate
   * AC-19); Adjust keeps the Work's Crop and the View as they are (adjust AC-20). Refused, not
   * queued, with no Work, during an export, while a tool is open, or under another feature's panel
   * or the replace dialog (AC-15, AC-16, AC-18, AC-20).
   */
  function openTool(id: ToolId): { ok: true } | { ok: false; reason: ToolRefusal } {
    if (!work.value) return { ok: false, reason: 'no-work' }
    if (phase.value === 'exporting') return { ok: false, reason: 'exporting' }
    if (activeTool.value) return { ok: false, reason: 'tool-open' }
    if (activePanel.value) return { ok: false, reason: 'panel-open' }
    if (phase.value === 'confirming') return { ok: false, reason: 'confirming' }
    activeTool.value = id
    if (id === 'crop-rotate') {
      previewGeometry.value = work.value.geometry
      fitIfSized()
    }
    return { ok: true }
  }

  /** Empties the slot without touching the View, as a replaced Work discards the Draft (AC-17). */
  function discard() {
    activeTool.value = null
    previewGeometry.value = null
    previewAdjustments.value = null
  }

  /** Closes the tool slot; after Crop and rotate the View fits the Work again (AC-19). */
  function closeTool() {
    const closing = activeTool.value
    if (!closing) return
    discard()
    if (closing === 'crop-rotate') fitIfSized()
  }

  /** The adjust tool's Draft (or neutral values while comparing) for the Preview; never an edit. */
  function setPreviewAdjustments(next: Adjustments | null) {
    if (activeTool.value !== 'adjust') return
    previewAdjustments.value = next && { ...next }
  }

  /**
   * The open tool's Draft, for the Preview. A quarter turn re-fits the View; any other change keeps
   * the image still on screen while the turned image's bounds move. An angle step also moves the
   * frame's centre on the turned image (the image turns around it), so that is offset too (AC-05);
   * a Flip or a Reset that changes the angle moves the frame instead (AC-04, AC-12).
   */
  function setPreviewGeometry(next: Geometry, { angleStep = false } = {}) {
    const current = work.value
    const previous = previewGeometry.value
    if (!activeTool.value || !current || !previous) return
    previewGeometry.value = next
    if (next.rotation !== previous.rotation) {
      fitIfSized()
      return
    }
    const before = turnedBounds(previous, current.original)
    const after = turnedBounds(next, current.original)
    let dx = after.x - before.x
    let dy = after.y - before.y
    if (angleStep) {
      dx -= next.crop.x + next.crop.width / 2 - (previous.crop.x + previous.crop.width / 2)
      dy -= next.crop.y + next.crop.height / 2 - (previous.crop.y + previous.crop.height / 2)
    }
    const { zoom, panX, panY } = view.value
    if (dx !== 0 || dy !== 0) {
      view.value = { ...view.value, panX: panX + dx * zoom, panY: panY + dy * zoom }
    }
  }

  return {
    activeTool,
    previewGeometry,
    previewAdjustments,
    openTool,
    closeTool,
    discard,
    setPreviewAdjustments,
    setPreviewGeometry,
  }
}
