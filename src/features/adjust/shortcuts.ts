export interface OpenShortcutActions {
  hasWork(): boolean
  /** An export is running: the request is refused, not queued (AC-15). */
  exporting(): boolean
  /** Another feature's panel is open (`editor.activePanel`). */
  panelOpen(): boolean
  /** This tool is open (AC-21). */
  toolOpen(): boolean
  /** Another tool is open in the slot, such as Crop and rotate (AC-18). */
  otherToolOpen(): boolean
  /** The replace dialog is open over the Work. */
  confirming(): boolean
  open(): void
  notifyNoImage(): void
  notifyOtherToolOpen(): void
}

/** Inputs that take no typed text. */
const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset'])

/** Whether keys typed at `target` belong to a text field. */
export function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    (target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)) ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  )
}

/**
 * The A key: the letter a, or the A key itself on a layout that types no Latin letter there (a
 * Cyrillic layout types ф). A Latin layout that types another letter on that key keeps it.
 */
function isA(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase()
  return key === 'a' || (event.code === 'KeyA' && !/^[a-z]$/.test(key))
}

/**
 * The A rows of screens.md §Keyboard: A (no Ctrl, Cmd or Alt) opens the tool (AC-21), or with no
 * image shows the hint (AC-19), or with another tool open says to apply or cancel it first
 * (AC-18). Silent for a held key's repeats, during an export, under the export panel or the
 * replace dialog, with the tool open or while a text field has focus (AC-15, AC-21).
 */
export function createOpenShortcut(actions: OpenShortcutActions): (event: KeyboardEvent) => void {
  return (event) => {
    if (!isA(event) || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
    if (isTextTarget(event.target)) return
    if (actions.exporting() || actions.panelOpen() || actions.toolOpen() || actions.confirming()) {
      return
    }
    if (!actions.hasWork()) actions.notifyNoImage()
    else if (actions.otherToolOpen()) actions.notifyOtherToolOpen()
    else actions.open()
  }
}
