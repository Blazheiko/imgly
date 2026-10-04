export interface DropGuardHandlers {
  /** A drag entered the window (fires once, however many child elements it crosses). */
  onDragEnter?: () => void
  /** The drag left the window or ended in a drop. */
  onDragLeave?: () => void
  onDrop?: (dataTransfer: DataTransfer | null) => void
}

/**
 * Stops the browser from navigating to, or showing, any file dropped anywhere on the window
 * (AC-02, AC-18). Install it before anything else; whether a drop opens anything is the caller's
 * decision. Returns the uninstall function.
 */
export function installDropGuard(win: Window, handlers: DropGuardHandlers): () => void {
  let depth = 0

  const onDragEnter = () => {
    if (depth++ === 0) handlers.onDragEnter?.()
  }
  const onDragLeave = () => {
    if (depth === 0) return
    if (--depth === 0) handlers.onDragLeave?.()
  }
  const onDragOver = (event: Event) => event.preventDefault()
  const onDrop = (event: Event) => {
    event.preventDefault()
    if (depth > 0) {
      depth = 0
      handlers.onDragLeave?.()
    }
    handlers.onDrop?.((event as DragEvent).dataTransfer ?? null)
  }

  win.addEventListener('dragenter', onDragEnter)
  win.addEventListener('dragleave', onDragLeave)
  win.addEventListener('dragover', onDragOver)
  win.addEventListener('drop', onDrop)
  return () => {
    win.removeEventListener('dragenter', onDragEnter)
    win.removeEventListener('dragleave', onDragLeave)
    win.removeEventListener('dragover', onDragOver)
    win.removeEventListener('drop', onDrop)
  }
}
