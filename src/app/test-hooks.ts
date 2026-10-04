import type { Pinia } from 'pinia'
import { useEditorStore } from '@/features/editor'
import { bitmapLedger } from '@/shared'

/** What e2e tests may read and prepare. Only installed in the Playwright build (VITE_E2E_HOOKS). */
export interface ImglyTestHooks {
  work(): { id: string; revision: number; width: number; height: number } | null
  view(): { zoom: number; panX: number; panY: number; autoFit: boolean }
  /** Prepares Unsaved edits until an editing tool exists (spec Decision override on AC-15). */
  applyEdit(): void
  /** Bitmaps received from the decode worker and closed by the app; retained should be 1. */
  bitmaps(): { received: number; closed: number; retained: number }
}

declare global {
  interface Window {
    __imglyTest?: ImglyTestHooks
  }
}

export function installTestHooks(pinia: Pinia): void {
  const editor = useEditorStore(pinia)
  window.__imglyTest = {
    work: () => {
      const work = editor.work
      if (!work) return null
      const { id, revision, original } = work
      return { id, revision, width: original.width, height: original.height }
    },
    view: () => ({ ...editor.view }),
    applyEdit: () => editor.applyEdit(),
    bitmaps: () => ({
      received: bitmapLedger.received,
      closed: bitmapLedger.closed,
      retained: bitmapLedger.received - bitmapLedger.closed,
    }),
  }
}
