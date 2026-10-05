/**
 * Opens the OS file dialog for one file, filtered to images (SCR-06). The filter is only a hint:
 * the content still decides what opens (AC-08). Resolves `null` when the dialog is cancelled.
 */
export function pickImageFile(doc: Document = document): Promise<File | null> {
  return new Promise((resolve) => {
    const input = doc.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true })
    input.addEventListener('cancel', () => resolve(null), { once: true })
    input.click()
  })
}
