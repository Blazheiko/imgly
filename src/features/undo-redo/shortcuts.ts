import { isTextTarget } from '@/shared'

/** Ctrl+Z (Cmd+Z on a Mac), with no other modifier. */
export function isUndoShortcut(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'z'
  )
}

/** Shift+Ctrl/Cmd+Z, or Ctrl+Y. Cmd+Y is never one: it stays the browser's. */
export function isRedoShortcut(event: KeyboardEvent): boolean {
  if (event.altKey) return false
  const key = event.key.toLowerCase()
  if (key === 'z') return (event.ctrlKey || event.metaKey) && event.shiftKey
  return key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey
}

export interface UndoRedoShortcutActions {
  hasWork(): boolean
  /** The replace dialog is open and owns the keys. */
  confirming(): boolean
  /** An export is running, including File ready and the open "Save as…" dialog. */
  exporting(): boolean
  toolOpen(): boolean
  canUndo(): boolean
  canRedo(): boolean
  undo(): void
  redo(): void
  notifyToolOpen(): void
  notifyExporting(): void
}

/**
 * The Undo and Redo rows of screens.md §Keyboard. A focused text or number field keeps its own
 * undo; a held key's repeats are ignored; no Work or the replace dialog → nothing; an export →
 * its notice (AC-07); a tool open → its notice (AC-08); else Undo or Redo when there is a Step.
 */
export function createUndoRedoShortcuts(
  actions: UndoRedoShortcutActions,
): (event: KeyboardEvent) => void {
  return (event) => {
    const undo = isUndoShortcut(event)
    if (!undo && !isRedoShortcut(event)) return
    if (isTextTarget(event.target)) return
    event.preventDefault()
    if (event.repeat || !actions.hasWork() || actions.confirming()) return
    if (actions.exporting()) actions.notifyExporting()
    else if (actions.toolOpen()) actions.notifyToolOpen()
    else if (undo) {
      if (actions.canUndo()) actions.undo()
    } else if (actions.canRedo()) actions.redo()
  }
}
