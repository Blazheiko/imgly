export interface DroppedFiles {
  /** Real files only, in the order the browser lists them. */
  files: File[]
}

/** Keeps only files from a drop — never folders, links or text — in browser order (AC-04). */
export function filesFromDataTransfer(dt: DataTransfer | null): DroppedFiles {
  if (!dt) return { files: [] }
  if (!dt.items) return { files: Array.from(dt.files ?? []) }

  const files: File[] = []
  for (const item of Array.from(dt.items)) {
    if (item.kind !== 'file' || item.webkitGetAsEntry?.()?.isDirectory) continue
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return { files }
}
