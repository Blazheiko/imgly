// The e2e view of window.__imglyTest; mirrors ImglyTestHooks in src/app/test-hooks.ts (the e2e
// tsconfig can't import app code, which resolves '@/…' aliases and Vue types).
export {}

declare global {
  interface Window {
    __imglyTest?: {
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
      originalPixel(x: number, y: number): number[]
      applyEdit(): void
      bitmaps(): { received: number; closed: number; retained: number }
      holdNextOpen(): void
      releaseHeldOpen(): void
    }
  }
}
