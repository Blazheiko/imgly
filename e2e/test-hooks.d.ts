// The e2e view of window.__imglyTest; mirrors ImglyTestHooks in src/app/test-hooks.ts (the e2e
// tsconfig can't import app code, which resolves '@/…' aliases and Vue types).
export {}

/** Mirrors `Geometry` in src/core/geometry/types.ts. */
export interface Geometry {
  flipH: boolean
  flipV: boolean
  rotation: 0 | 90 | 180 | 270
  /** Integer tenths of a degree, −450…450. */
  straighten: number
  crop: { x: number; y: number; width: number; height: number }
}

declare global {
  interface Window {
    __imglyTest?: {
      work(): {
        id: string
        revision: number
        width: number
        height: number
        originalWidth: number
        originalHeight: number
        geometry: Geometry
        sourceName: string
        sourceFormat: string
        hasTransparency: boolean
        hasUnsavedEdits: boolean
      } | null
      view(): { zoom: number; panX: number; panY: number; autoFit: boolean }
      originalPixel(x: number, y: number): number[]
      previewAt100(): number[]
      exportStatus(): string
      applyEdit(): void
      setGeometry(geometry: Geometry): void
      bitmaps(): { received: number; closed: number; retained: number }
      holdNextOpen(): void
      releaseHeldOpen(): void
    }
  }
}
