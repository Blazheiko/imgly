import type { WorkState } from '../document'

/**
 * The Edit history (undo-redo ADR-0001): one line of the Work's edited states, generic over the
 * Step label (the editor passes its tool id). `entries[0]` is the state at open, with label null,
 * and `entries[cursor]` is always the Work's current edited state. Every function returns a new
 * value and never mutates the one it was given.
 */
export interface HistoryEntry<L, TLayer = unknown> {
  state: WorkState<TLayer>
  /** The tool whose Apply produced this state; null for the state at open. */
  label: L | null
}

export interface EditHistory<L, TLayer = unknown> {
  entries: readonly HistoryEntry<L, TLayer>[]
  cursor: number
}

/** What `record` leaves behind: the caller releases the evicted entries' layers. */
export interface Recorded<L, TLayer = unknown> {
  history: EditHistory<L, TLayer>
  evicted: HistoryEntry<L, TLayer>[]
}

/** A moved cursor and the state the Work must take. */
export interface Moved<L, TLayer = unknown> {
  history: EditHistory<L, TLayer>
  state: WorkState<TLayer>
}

/** A new history whose only entry is the Work's state at open (AC-10). */
export function createHistory<L, TLayer = unknown>(
  base: WorkState<TLayer>,
): EditHistory<L, TLayer> {
  return { entries: [{ state: base, label: null }], cursor: 0 }
}

/** Appends a Step, discarding the redoable entries first: the history is one line (AC-04). */
export function record<L, TLayer>(
  history: EditHistory<L, TLayer>,
  label: L,
  state: WorkState<TLayer>,
): Recorded<L, TLayer> {
  const kept = history.entries.slice(0, history.cursor + 1)
  const evicted = history.entries.slice(history.cursor + 1)
  const entries = [...kept, { state, label }]
  return { history: { entries, cursor: entries.length - 1 }, evicted }
}

export function canUndo(history: EditHistory<unknown, unknown>): boolean {
  return history.cursor > 0
}

export function canRedo(history: EditHistory<unknown, unknown>): boolean {
  return history.cursor < history.entries.length - 1
}

/** One Step back, or null when nothing is left to undo (AC-05). */
export function undo<L, TLayer>(history: EditHistory<L, TLayer>): Moved<L, TLayer> | null {
  if (!canUndo(history)) return null
  const cursor = history.cursor - 1
  return { history: { entries: history.entries, cursor }, state: history.entries[cursor]!.state }
}

/** One Step forward again, or null when nothing has been undone (AC-05). */
export function redo<L, TLayer>(history: EditHistory<L, TLayer>): Moved<L, TLayer> | null {
  if (!canRedo(history)) return null
  const cursor = history.cursor + 1
  return { history: { entries: history.entries, cursor }, state: history.entries[cursor]!.state }
}

/** The tool of the Step Undo would take back, or null at the oldest kept state. */
export function undoLabel<L>(history: EditHistory<L, unknown>): L | null {
  return history.entries[history.cursor]!.label
}

/** The tool of the Step Redo would restore, or null when nothing has been undone. */
export function redoLabel<L>(history: EditHistory<L, unknown>): L | null {
  return history.entries[history.cursor + 1]?.label ?? null
}
