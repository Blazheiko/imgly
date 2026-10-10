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

export interface ToolKeyActions {
  /** Another modal surface (the replace dialog) owns the keys. */
  blocked(): boolean
  /** Applies the tool; the store waits for a Stroke in progress to end (AC-18). */
  apply(): void
  cancel(): void
  setMode(mode: 'brush' | 'eraser'): void
  stepWidth(delta: number): void
}

/** What Enter presses itself, so it must not apply the tool as well. */
const PRESSED_BY_ENTER =
  'button, a[href], input[type="button"], input[type="submit"], input[type="reset"]'

/**
 * `[` or `]`: the character it types, or on a layout that types another character there, the key
 * position right of P (German ü and +); Shift+[ types "{" and still counts (AC-19).
 */
function bracket(event: KeyboardEvent): -1 | 1 | null {
  if (event.key === '[' || event.key === '{') return -1
  if (event.key === ']' || event.key === '}') return 1
  if (event.code === 'BracketLeft') return -1
  if (event.code === 'BracketRight') return 1
  return null
}

/**
 * The keys inside the open tool (screens.md §Keyboard): Escape cancels from anywhere, a field
 * included (AC-06); Enter applies except on a button, which it presses, or in a field, which
 * commits only its width (AC-03); B and E pick the mode and [ ] step the width (Shift ×10), all
 * silent in a text field (AC-19).
 */
export function createToolKeys(actions: ToolKeyActions): (event: KeyboardEvent) => void {
  return (event) => {
    if (event.defaultPrevented) return
    if (event.ctrlKey || event.metaKey || event.altKey || actions.blocked()) return
    if (event.key === 'Escape') {
      event.preventDefault()
      actions.cancel()
      return
    }
    const target = event.target
    if (isTextTarget(target)) return
    if (event.key === 'Enter') {
      if (target instanceof Element && target.closest(PRESSED_BY_ENTER)) return
      event.preventDefault()
      actions.apply()
      return
    }
    const step = bracket(event)
    if (step !== null) {
      event.preventDefault()
      actions.stepWidth(step * (event.shiftKey ? 10 : 1))
      return
    }
    if (event.repeat) return
    if (isLetter(event, 'b')) actions.setMode('brush')
    else if (isLetter(event, 'e')) actions.setMode('eraser')
  }
}
