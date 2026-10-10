export interface OpenShortcutActions {
  hasWork(): boolean
  /** An export is running: the request is refused, not queued (AC-14). */
  exporting(): boolean
  /** Another feature's panel is open (`editor.activePanel`). */
  panelOpen(): boolean
  /** This tool is open (AC-19). */
  toolOpen(): boolean
  /** Another tool is open in the slot (AC-16). */
  otherToolOpen(): boolean
  /** The replace dialog is open over the Work. */
  confirming(): boolean
  open(): void
  notifyNoImage(): void
  notifyOtherToolOpen(): void
}

/** Inputs that take no typed text. */
const NON_TEXT_INPUTS = new Set([
  'range',
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'color',
])

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
 * A letter key by the letter-first rule (AC-19): the letter itself, or that key's position on a
 * layout that types no Latin letter there. A Latin layout that types another letter keeps it.
 */
export function isLetter(event: KeyboardEvent, letter: string): boolean {
  const key = event.key.toLowerCase()
  return key === letter || (event.code === `Key${letter.toUpperCase()}` && !/^[a-z]$/.test(key))
}

/**
 * The D rows of screens.md §Keyboard: D (no Ctrl, Cmd or Alt) opens the tool (AC-19), or with no
 * image shows the hint (AC-17), or with another tool open says to apply or cancel it first
 * (AC-16). Silent for a held key's repeats, during an export, under the export panel or the
 * replace dialog, with the tool open or while a text field has focus (AC-14, AC-19).
 */
export function createOpenShortcut(actions: OpenShortcutActions): (event: KeyboardEvent) => void {
  return (event) => {
    if (!isLetter(event, 'd') || event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
      return
    }
    if (isTextTarget(event.target)) return
    if (actions.exporting() || actions.panelOpen() || actions.toolOpen() || actions.confirming()) {
      return
    }
    if (!actions.hasWork()) actions.notifyNoImage()
    else if (actions.otherToolOpen()) actions.notifyOtherToolOpen()
    else actions.open()
  }
}
