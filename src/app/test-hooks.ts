import type { Pinia } from 'pinia'
import { useEditorStore } from '@/features/editor'
import { bitmapLedger } from '@/shared'

/** What e2e tests may read and prepare. Only installed in the Playwright build (VITE_E2E_HOOKS). */
export interface ImglyTestHooks {
  work(): {
    id: string
    revision: number
    width: number
    height: number
    sourceName: string
    sourceFormat: string
    hasTransparency: boolean
  } | null
  view(): { zoom: number; panX: number; panY: number; autoFit: boolean }
  /**
   * The Original's RGB at (x, y), drawn through a 2D canvas so it needs no WebGL and every engine
   * can check the upright pixel layout (AC-01). An empty array when no Work is open.
   */
  originalPixel(x: number, y: number): number[]
  /** Prepares Unsaved edits until an editing tool exists (spec Decision override on AC-15). */
  applyEdit(): void
  /** Bitmaps received from the decode worker and closed by the app; retained should be 1. */
  bitmaps(): { received: number; closed: number; retained: number }
  /**
   * Holds the next open's result until `releaseHeldOpen()`, so a test can act during the read
   * (AC-16b) without racing a fast decoder. The decode itself still runs in the worker.
   */
  holdNextOpen(): void
  releaseHeldOpen(): void
}

declare global {
  interface Window {
    __imglyTest?: ImglyTestHooks
  }
}

export function installTestHooks(pinia: Pinia): void {
  const editor = useEditorStore(pinia)
  let release: (() => void) | undefined
  window.__imglyTest = {
    work: () => {
      const work = editor.work
      if (!work) return null
      const { id, revision, original, sourceName, sourceFormat } = work
      return {
        id,
        revision,
        width: original.width,
        height: original.height,
        sourceName,
        sourceFormat,
        hasTransparency: original.hasTransparency,
      }
    },
    view: () => ({ ...editor.view }),
    originalPixel: (x, y) => {
      const pixels = editor.work?.original.pixels
      if (!pixels) return []
      const ctx = new OffscreenCanvas(pixels.width, pixels.height).getContext('2d')!
      ctx.drawImage(pixels, 0, 0)
      return Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3))
    },
    applyEdit: () => editor.applyEdit(),
    bitmaps: () => ({
      received: bitmapLedger.received,
      closed: bitmapLedger.closed,
      retained: bitmapLedger.received - bitmapLedger.closed,
    }),
    holdNextOpen: () => {
      const gate = new Promise<void>((resolve) => (release = resolve))
      const inner = editor.setDecoder(async (file) => {
        editor.setDecoder(inner) // only this one open is held
        const outcome = await inner(file)
        await gate
        return outcome
      })
    },
    releaseHeldOpen: () => release?.(),
  }
}
