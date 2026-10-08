export interface OpenShortcutActions {
  hasWork(): boolean
  /** An export is running: the request is refused, not queued (AC-15). */
  exporting(): boolean
  /** Another feature's panel is open (`editor.activePanel`). */
  panelOpen(): boolean
  toolOpen(): boolean
  /** The replace dialog is open over the Work. */
  confirming(): boolean
  open(): void
  notifyNoImage(): void
}

/** Inputs that take no typed text (AC-20); `PRESSED_BY_ENTER` says which of them Enter presses itself. */
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
 * The C key: the letter c, or the C key itself on a layout that types no Latin letter there (a
 * Cyrillic layout types с). A Latin layout that types another letter on that key keeps it.
 */
function isC(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase()
  return key === 'c' || (event.code === 'KeyC' && !/^[a-z]$/.test(key))
}

/**
 * The C rows of screens.md §Keyboard: C (no Ctrl, Cmd or Alt) opens the tool, or with no image
 * shows the hint (AC-18). Silent for a held key's repeats, during an export, under the export
 * panel or the replace dialog, with the tool open or while a text field has focus (AC-15, AC-20).
 */
export function createOpenShortcut(actions: OpenShortcutActions): (event: KeyboardEvent) => void {
  return (event) => {
    if (!isC(event) || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
    if (isTextTarget(event.target)) return
    if (actions.exporting() || actions.panelOpen() || actions.toolOpen() || actions.confirming()) {
      return
    }
    if (!actions.hasWork()) actions.notifyNoImage()
    else actions.open()
  }
}

export interface ToolKeyActions {
  /** Another modal surface (the replace dialog) owns Enter and Escape. */
  blocked(): boolean
  apply(): void
  cancel(): void
}

/** What Enter presses itself, so it must not apply the tool as well. */
const PRESSED_BY_ENTER =
  'button, a[href], input[type="button"], input[type="submit"], input[type="reset"]'

/**
 * Enter and Escape inside the open tool (AC-20): Escape cancels from anywhere, a field included;
 * Enter applies the tool except on a button (which it presses) or in a field (which applies only
 * its value, AC-07, AC-10).
 */
export function createToolKeys(actions: ToolKeyActions): (event: KeyboardEvent) => void {
  return (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || actions.blocked()) return
    if (event.key === 'Escape') {
      event.preventDefault()
      actions.cancel()
      return
    }
    if (event.key !== 'Enter') return
    const target = event.target
    if (isTextTarget(target)) return
    if (target instanceof Element && target.closest(PRESSED_BY_ENTER)) return
    event.preventDefault()
    actions.apply()
  }
}
