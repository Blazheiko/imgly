// The e2e view of window.__imglyTest; mirrors ImglyTestHooks in src/app/test-hooks.ts (the e2e
// tsconfig can't import app code, which resolves '@/…' aliases and Vue types).
export {}

declare global {
  interface Window {
    __imglyTest?: {
      work(): { id: string; revision: number; width: number; height: number } | null
      view(): { zoom: number; panX: number; panY: number; autoFit: boolean }
      applyEdit(): void
    }
  }
}
