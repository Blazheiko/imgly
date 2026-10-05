/** Ctrl+S (Cmd+S on a Mac), with no other modifier. */
export function isSaveShortcut(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 's'
  )
}

export interface SaveShortcutActions {
  hasWork(): boolean
  /** An export is running, including File ready and the open "Save as…" dialog. */
  exporting(): boolean
  panelOpen(): boolean
  confirm(): void
  openPanel(): void
  notifyNoImage(): void
}

/**
 * The Ctrl/Cmd+S rows of screens.md §Keyboard (AC-17). The browser's "Save page" never opens:
 * no image → the hint notice; exporting → nothing; panel open → confirm; else open the panel.
 */
export function createSaveShortcut(actions: SaveShortcutActions): (event: KeyboardEvent) => void {
  return (event) => {
    if (!isSaveShortcut(event)) return
    event.preventDefault()
    if (!actions.hasWork()) actions.notifyNoImage()
    else if (actions.exporting()) return
    else if (actions.panelOpen()) actions.confirm()
    else actions.openPanel()
  }
}
