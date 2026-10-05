/**
 * Counts the ImageBitmaps the main thread receives from the decode worker and the ones it closes,
 * so tests can prove exactly one Original stays retained (sad.md §8 resource lifetime). Counting
 * is on only in development and e2e builds; production keeps zeros.
 */
const TRACKING = import.meta.env.DEV || import.meta.env.VITE_E2E_HOOKS === 'true'

export const bitmapLedger = {
  received: 0,
  closed: 0,
  noteReceived() {
    if (TRACKING) bitmapLedger.received++
  },
}

/** Closes a bitmap the app owns and records it. */
export function closeBitmap(bitmap: ImageBitmap): void {
  bitmap.close()
  if (TRACKING) bitmapLedger.closed++
}

export function resetBitmapLedger(): void {
  bitmapLedger.received = 0
  bitmapLedger.closed = 0
}
