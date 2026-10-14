// The e2e view of window.__imglyTest; mirrors ImglyTestHooks in src/app/test-hooks.ts (the e2e
// tsconfig can't import app code, which resolves '@/…' aliases and Vue types).
export {}

/** A stored Work record without its Blob bytes (gallery T18). */
export interface WorkRecordSummary {
  id: string
  sourceName: string
  sourceFormat: string
  touchedAt: number
  width: number
  height: number
  hasTransparency: boolean
  geometry: Geometry
  adjustments: Adjustments
  layerId: string | null
  formatVersion: number
}

/** Where `galleryHoldSave` keeps the next `storeWork` transaction open. */
export type SaveHoldPoint = 'evictions' | 'record' | 'original' | 'layer'

/** Mirrors `Geometry` in src/core/geometry/types.ts. */
export interface Geometry {
  flipH: boolean
  flipV: boolean
  rotation: 0 | 90 | 180 | 270
  /** Integer tenths of a degree, −450…450. */
  straighten: number
  crop: { x: number; y: number; width: number; height: number }
}

/** Mirrors `Adjustments` in src/core/adjust/types.ts: seven whole numbers. */
export interface Adjustments {
  brightness: number
  contrast: number
  saturation: number
  temperature: number
  tint: number
  /** 0…100 (%). */
  grayscale: number
  /** 0…100 (%). */
  sepia: number
}

/** Mirrors `BrushStyle` in src/render/drawing/painter.ts. */
export interface BrushStyle {
  mode: 'brush' | 'eraser'
  colour: string
  width: number
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
        adjustments: Adjustments
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
      setAdjustments(adjustments: Adjustments): void
      setReferenceDrawing(): void
      setFullDrawing(): void
      paintStroke(
        points: { x: number; y: number }[],
        style: BrushStyle,
        hz?: number,
        full?: boolean,
      ): Promise<{ frameIntervals: number[]; latencies: number[] }>
      drawingAlpha(): number[]
      draftAlpha(): number[]
      layers(): { created: number; released: number; retained: number }
      bitmaps(): { received: number; closed: number; retained: number }
      /** The Edit history's held layer bytes and Steps kept (undo-redo spec §6). */
      historyStats(): { heldBytes: number; steps: number }
      holdNextOpen(): void
      releaseHeldOpen(): void
      /** Every stored key per store; records come without Blob bytes (gallery T18). */
      galleryRecords(): Promise<{
        works: WorkRecordSummary[]
        originals: string[]
        layers: string[]
        meta: string[]
      }>
      /** Writes one Work in the `formatVersion: 1` layout, bypassing Autosave; returns its id. */
      galleryWriteStored(input: {
        sourceName: string
        sourceFormat: string
        geometry: Geometry
        adjustments: Adjustments
        touchedAt: number
        width?: number
        height?: number
        hasTransparency?: boolean
        originalPng: number[]
        layerPng?: number[]
      }): Promise<string>
      galleryDamage(id: string, part: 'original' | 'layer' | 'thumbnail' | 'thumbnail-bytes' | 'record'): Promise<void>
      /** Writes over the budget (total stored bytes) fail as a quota error; `null` lifts it. */
      gallerySetByteBudget(bytes: number | null): void
      /** The next `storeWork` transaction stays open at that point; `null` clears it. */
      galleryHoldSave(point: SaveHoldPoint | null): void
      /** The next save fails with a non-quota error. */
      galleryFailNextSave(): void
      /** Opens the database at `LATEST_VERSION + 1` from this page. */
      galleryOpenNextVersion(): Promise<void>
      /** `navigator.storage.persist()` calls since load. */
      galleryPersistCalls(): number
      /** Makes the next `openGalleryDb` refuse. */
      galleryFailOpen(): void
    }
  }
}
