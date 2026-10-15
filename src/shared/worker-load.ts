/**
 * Whether a worker's `error` event means its script never loaded. Every engine (Chromium, Firefox,
 * WebKit) follows the HTML spec here: a script that fails to fetch fires a plain `Event`, while an
 * exception inside a loaded worker is reported as an `ErrorEvent`. In this app a hashed script goes
 * missing only after a newer build replaced it (pwa-install-update AC-14).
 */
export function isScriptLoadFailure(event: Event): boolean {
  return typeof ErrorEvent === 'undefined' || !(event instanceof ErrorEvent)
}
