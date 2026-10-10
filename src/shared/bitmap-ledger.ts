/**
 * Counts the ImageBitmaps (and the Drawing layers' canvases, draw ADR-0001) the main thread receives from the decode worker and the ones it closes,
 * so tests can prove exactly one Original stays retained (sad.md §8 resource lifetime). Counting
 * is on only in development and e2e builds; production keeps zeros.
 */
const TRACKING = import.meta.env.DEV || import.meta.env.VITE_E2E_HOOKS === 'true'

export const bitmapLedger = {
  received: 0,
  closed: 0,
  layersCreated: 0,
  layersReleased: 0,
  noteReceived() {
    if (TRACKING) bitmapLedger.received++
  },
  noteLayerCreated() {
    if (TRACKING) bitmapLedger.layersCreated++
  },
  noteLayerReleased() {
    if (TRACKING) bitmapLedger.layersReleased++
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
  bitmapLedger.layersCreated = 0
  bitmapLedger.layersReleased = 0
}
