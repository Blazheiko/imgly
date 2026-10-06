import type { Pinia } from 'pinia'
import { useEditorStore } from '@/features/editor'
import { useExportStore } from '@/features/export'
import { buildProgram, uploadTexture, viewToTransform } from '@/render'
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
    /** The Work has Unsaved edits: its revision is past the last save point (export AC-09). */
    hasUnsavedEdits: boolean
  } | null
  view(): { zoom: number; panX: number; panY: number; autoFit: boolean }
  /**
   * The Original's RGB at (x, y), drawn through a 2D canvas so it needs no WebGL and every engine
   * can check the upright pixel layout (AC-01). An empty array when no Work is open.
   */
  originalPixel(x: number, y: number): number[]
  /**
   * The Preview's own rendering of the Work at 100% (its shaders and View maths at zoom 1), with no
   * transparency backdrop and no display scaling, as un-premultiplied RGBA rows (export §6
   * Fidelity). An empty array when no Work is open.
   */
  previewAt100(): number[]
  /** The export store's status: `idle`, `exporting` or `fileReady`. */
  exportStatus(): string
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

/** Renders a bitmap the way the Preview draws it at 100% and reads it back. */
function renderAt100(bitmap: ImageBitmap): number[] {
  const { width, height } = bitmap
  const canvas = new OffscreenCanvas(width, height)
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  })!
  const gpu = buildProgram(gl)
  const texture = uploadTexture(gl, bitmap)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST) // the Preview at zoom ≥ 1
  gl.viewport(0, 0, width, height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(gpu.program)
  gl.bindVertexArray(gpu.vao)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  const size = { width, height }
  const view = { zoom: 1, panX: 0, panY: 0, autoFit: false }
  gl.uniformMatrix3fv(gpu.transform, false, viewToTransform(view, size, size))
  gl.uniform1i(gpu.flatten, 0)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  const ctx = new OffscreenCanvas(width, height).getContext('2d')!
  ctx.drawImage(canvas, 0, 0)
  return Array.from(ctx.getImageData(0, 0, width, height).data)
}

export function installTestHooks(pinia: Pinia): void {
  const editor = useEditorStore(pinia)
  const exporter = useExportStore(pinia)
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
        hasUnsavedEdits: editor.hasUnsavedEdits,
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
    previewAt100: () => {
      const pixels = editor.work?.original.pixels
      return pixels ? renderAt100(pixels) : []
    },
    exportStatus: () => exporter.status,
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
