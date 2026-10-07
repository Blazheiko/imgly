export interface OpenShortcutActions {
  hasWork(): boolean
  /** An export is running: the request is refused, not queued (AC-15). */
  exporting(): boolean
  /** Another feature's panel is open (`editor.activePanel`). */
  panelOpen(): boolean
  toolOpen(): boolean
  open(): void
  notifyNoImage(): void
}

/** Whether keys typed at `target` belong to a text field. */
export function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  )
}

/**
 * The C rows of screens.md §Keyboard: C (no Ctrl, Cmd or Alt) opens the tool, or with no image
 * shows the hint (AC-18). Silent during an export, under the export panel, with the tool open or
 * while a text field has focus (AC-15, AC-20).
 */
export function createOpenShortcut(actions: OpenShortcutActions): (event: KeyboardEvent) => void {
  return (event) => {
    if (event.key.toLowerCase() !== 'c' || event.ctrlKey || event.metaKey || event.altKey) return
    if (isTextTarget(event.target)) return
    if (actions.exporting() || actions.panelOpen() || actions.toolOpen()) return
    if (!actions.hasWork()) actions.notifyNoImage()
    else actions.open()
  }
}
