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

/**
 * Whether keys typed at `target` belong to a text field, so a shortcut must leave them alone
 * (undo-redo AC-08, AC-14). Shared, so a feature needs no other feature's copy.
 */
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
 * A letter key by the letter-first rule: the letter itself, or that key's position on a layout
 * that types no Latin letter there (Ctrl+Z on a Cyrillic layout reports `я`). A Latin layout that
 * types another letter at that position keeps it.
 */
export function isLetter(event: KeyboardEvent, letter: string): boolean {
  const key = event.key.toLowerCase()
  return key === letter || (event.code === `Key${letter.toUpperCase()}` && !/^[a-z]$/.test(key))
}
