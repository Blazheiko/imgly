import { computed, shallowRef, type Ref, type ShallowRef } from 'vue'
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  createHistory,
  editStateOf,
  heldLayerBytes,
  record,
  redo as redoStep,
  redoLabel,
  undo as undoStep,
  undoLabel,
  withEdit,
  withState,
  workSize,
  type EditHistory,
  type Moved,
  type Work,
} from '@/core'
import { isReleasedLayer, releaseLayer, type Layer } from '@/render'
import type { EditorPhase } from './store'
import type { ToolId } from './tool-slot'

type EditorWork = Work<ImageBitmap, OffscreenCanvas>

/** The open Work's Edit history; each Step is labelled with the tool whose Apply made it. */
export type EditorHistory = EditHistory<ToolId, OffscreenCanvas>

/** What the e2e memory checks read (spec §6): the bytes the kept layers hold and the Steps kept. */
export interface HistoryStats {
  heldBytes: number
  steps: number
}

/** What the composable reads from the editor store; the store owns these. */
export interface EditHistoryDeps {
  work: ShallowRef<EditorWork | null>
  phase: Ref<EditorPhase>
  activeTool: Ref<ToolId | null>
  /** Fits the View to the Work, once the canvas has a size. */
  fitIfSized: () => void
}

/**
 * The editor's Edit history (undo-redo ADR-0004): composed by the store like the tool slot. It
 * issues every revision from a high-water mark that never goes down, so no two states of one Work
 * share a revision (ADR-0003), and it is the one place a Drawing layer is released: only once no
 * kept state and not the Work refers to it (ADR-0002).
 */
export function createEditHistory({ work, phase, activeTool, fitIfSized }: EditHistoryDeps) {
  // shallowRef: the states refer to OffscreenCanvas layers, which must never be proxied.
  const history = shallowRef<EditorHistory | null>(null)
  let workId: string | null = null
  let highWater = 0

  function start(base: EditorWork) {
    history.value = createHistory(editStateOf(base))
    workId = base.id
    highWater = base.revision
  }

  /**
   * The history `current` is at. A Work it has not followed (set directly, as test hooks and
   * other features' tests do) starts a new history at that Work.
   */
  function follow(current: EditorWork): EditorHistory {
    const kept = history.value
    if (
      kept &&
      workId === current.id &&
      kept.entries[kept.cursor]!.state.revision === current.revision
    ) {
      return kept
    }
    start(current)
    return history.value!
  }

  /**
   * Makes `updated` the Work with a fresh revision and records it as a Step of `tool`. `current`
   * is the Work before the Apply. The discarded and dropped entries' layers are released.
   */
  function commit(tool: ToolId, current: EditorWork, updated: EditorWork): EditorWork {
    const kept = follow(current)
    const next = withEdit(updated, ++highWater)
    work.value = next
    const result = record(kept, tool, editStateOf(next))
    history.value = result.history
    release(result.evicted.map((entry) => entry.state.drawing))
    return next
  }

  /** The test-only edit: a fresh revision and no Step; the current entry takes the revision. */
  function touch(current: EditorWork) {
    const kept = follow(current)
    const next = withEdit(current, ++highWater)
    work.value = next
    const entries = kept.entries.map((entry, i) =>
      i === kept.cursor ? { ...entry, state: editStateOf(next) } : entry,
    )
    history.value = { entries, cursor: kept.cursor }
  }

  /** The history of the open Work, or null with no Work or one it has not followed. */
  const current = computed(() => {
    const kept = history.value
    const open = work.value
    if (!kept || !open || workId !== open.id) return null
    return kept.entries[kept.cursor]!.state.revision === open.revision ? kept : null
  })

  /**
   * Undo and Redo may run with a Work open, no tool open (AC-08), no export running (AC-07) and the
   * replace dialog closed. Reading a new image and the open export panel don't stop them.
   */
  const available = computed(
    () =>
      !!work.value &&
      !activeTool.value &&
      phase.value !== 'exporting' &&
      phase.value !== 'confirming',
  )

  /** The history Undo and Redo may move, or null while they are refused. */
  const usable = computed(() => (available.value ? current.value : null))
  const canUndo = computed(() => !!usable.value && historyCanUndo(usable.value))
  const canRedo = computed(() => !!usable.value && historyCanRedo(usable.value))
  const undoTool = computed(() => (usable.value ? undoLabel(usable.value) : null))
  const redoTool = computed(() => (usable.value ? redoLabel(usable.value) : null))
  const stats = computed<HistoryStats>(() => {
    const kept = current.value
    return kept
      ? { heldBytes: heldLayerBytes(kept), steps: kept.entries.length - 1 }
      : { heldBytes: 0, steps: 0 }
  })

  function move(step: (h: EditorHistory) => Moved<ToolId, OffscreenCanvas> | null): boolean {
    const open = work.value
    if (!open || !available.value) return false
    const moved = step(follow(open))
    if (!moved) return false
    history.value = moved.history
    const before = workSize(open)
    const restored = withState(open, moved.state)
    work.value = restored
    assertKeptLayersLive()
    // A size change fits the View, as a "Crop and rotate" Apply does; otherwise it stays (AC-12).
    const after = workSize(restored)
    if (after.width !== before.width || after.height !== before.height) fitIfSized()
    return true
  }

  /**
   * Puts the state before the last Step into the Work; false, with nothing changed, when nothing
   * is left to undo or Undo is refused.
   */
  const undo = () => move(undoStep)

  /** Puts the most recently undone state back into the Work; false as for `undo`. */
  const redo = () => move(redoStep)

  /**
   * Starts the history of a new Work (AC-10) and releases every layer of the old one: its kept
   * states' layers and the `previous` Work's own.
   */
  function clear(next: EditorWork, previous: EditorWork | null) {
    const old = history.value?.entries ?? []
    start(next)
    release([...old.map((entry) => entry.state.drawing), previous?.drawing ?? null])
  }

  /** Releases each candidate layer that no kept state and not the Work refers to. */
  function release(candidates: (Layer | null)[]) {
    const kept = new Set<OffscreenCanvas>()
    for (const { state } of history.value?.entries ?? []) {
      if (state.drawing) kept.add(state.drawing.pixels)
    }
    if (work.value?.drawing) kept.add(work.value.drawing.pixels)
    for (const layer of candidates) {
      if (layer && !kept.has(layer.pixels)) releaseLayer(layer)
    }
    assertKeptLayersLive()
  }

  /** In DEV, a kept state pointing at a released layer would make an Undo show no marks. */
  function assertKeptLayersLive() {
    if (!import.meta.env.DEV) return
    for (const { state } of history.value?.entries ?? []) {
      if (state.drawing && isReleasedLayer(state.drawing)) {
        throw new Error('edit-history: a kept Step refers to a released layer')
      }
    }
  }

  return { history, canUndo, canRedo, undoTool, redoTool, stats, commit, touch, undo, redo, clear }
}
