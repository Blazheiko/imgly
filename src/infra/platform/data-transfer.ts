export interface DroppedFiles {
  /** Real files only, in the order the browser lists them. */
  files: File[]
  /** Dropped things that are not files: each folder, plus one for any dragged link or text. */
  nonFileCount: number
}

/** Keeps only files from a drop — never folders, links or text — in browser order (AC-04). */
export function filesFromDataTransfer(dt: DataTransfer | null): DroppedFiles {
  if (!dt) return { files: [], nonFileCount: 0 }
  if (!dt.items) return { files: Array.from(dt.files ?? []), nonFileCount: 0 }

  const files: File[] = []
  let folders = 0
  let hasText = false
  for (const item of Array.from(dt.items)) {
    if (item.kind !== 'file') {
      hasText = true
      continue
    }
    if (item.webkitGetAsEntry?.()?.isDirectory) {
      folders++
      continue
    }
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return { files, nonFileCount: folders + (hasText ? 1 : 0) }
}
