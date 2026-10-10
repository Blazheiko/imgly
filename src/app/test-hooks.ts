import type { Pinia } from 'pinia'
import { useEditorStore } from '@/features/editor'
import { useExportStore } from '@/features/export'
import {
  catmullRomSegment,
  cropToOriginalUv,
  identityGeometry,
  PALETTE,
  workSize,
  type Adjustments,
  type DrawMode,
  type Geometry,
  type Point,
  type Size,
} from '@/core'
import {
  buildProgram,
  createLayer,
  paintDot,
  paintSegment,
  readRect,
  releaseLayer,
  setAdjustmentUniforms,
  setLayerUniforms,
  uploadTexture,
  viewToTransform,
  type BrushStyle,
  type Layer,
} from '@/render'
import { bitmapLedger } from '@/shared'

/** What e2e tests may read and prepare. Only installed in the Playwright build (VITE_E2E_HOOKS). */
export interface ImglyTestHooks {
  work(): {
    id: string
    revision: number
    /** The Work's size: its Crop's (crop-rotate ADR-0001). */
    width: number
    height: number
    originalWidth: number
    originalHeight: number
    geometry: Geometry
    /** The Work's applied Adjustments (adjust ADR-0001). */
    adjustments: Adjustments
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
   * The Preview's own rendering of the Work at 100% (its shaders and View maths at zoom 1), with its
   * applied Adjustments, no transparency backdrop and no display scaling, as un-premultiplied RGBA rows (export §6
   * Fidelity). An empty array when no Work is open.
   */
  previewAt100(): number[]
  /** The export store's status: `idle`, `exporting` or `fileReady`. */
  exportStatus(): string
  /** Prepares Unsaved edits until an editing tool exists (spec Decision override on AC-15). */
  applyEdit(): void
  /**
   * Applies a Geometry directly, as the tool's Apply does, so the fidelity tests reach every
   * Rotation × Flip and angle without driving the UI (crop-rotate sad.md §8 Test hooks).
   */
  setGeometry(geometry: Geometry): void
  /**
   * Applies Adjustments directly, as the tool's Apply does, so the fidelity tests reach every
   * slider at its anchors without driving the UI (adjust sad.md §8 Test hooks).
   */
  setAdjustments(adjustments: Adjustments): void
  /**
   * Applies the reference drawing directly, as the tool's Apply does (draw sad.md §8 Test hooks):
   * Strokes at 1, 12 and 200 px in the 10 preset colours plus erased parts, painted through the
   * painter on the Original's grid. A no-op with no Work.
   */
  setReferenceDrawing(): void
  /**
   * Applies a layer covered by marks over the whole image (spec §6): 200 px Brush Strokes 100 px
   * apart, edge to edge. A no-op with no Work.
   */
  setFullDrawing(): void
  /**
   * The T9 hot-path spike: opens the draw tool on a fresh Draft and paints `points` (in the Crop's
   * frame) through the painter at `hz` moves per second, one segment behind the newest point as
   * the Stroke session does, handing each dirty rectangle to the Preview. Then cancels the tool.
   * Resolves with the frame intervals during the Stroke and each move's latency to the end of the
   * frame that drew it, in ms.
   */
  paintStroke(
    points: Point[],
    style: BrushStyle,
    hz?: number,
  ): Promise<{ frameIntervals: number[]; latencies: number[] }>
  /**
   * The applied Drawing layer's alpha on the Original's grid, row by row (draw QG-2c mask); an
   * empty array with no layer.
   */
  drawingAlpha(): number[]
  /** The open draw tool's Draft alpha, as `drawingAlpha`; empty with no Draft or tool. */
  draftAlpha(): number[]
  /** Drawing layers created and released by the app (draw sad.md §7); retained is their difference. */
  layers(): { created: number; released: number; retained: number }
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

/** Renders the Work the way the Preview draws it at 100%, with its layer, and reads it back. */
function renderAt100(
  bitmap: ImageBitmap,
  geometry: Geometry,
  adjustments: Adjustments,
  layer: Layer | null,
): number[] {
  const { width, height } = geometry.crop
  const canvas = new OffscreenCanvas(width, height)
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  })!
  const gpu = buildProgram(gl)
  // The Preview at zoom ≥ 1: NEAREST, or LINEAR while straightened (crop-rotate ADR-0002), on both
  // units (draw ADR-0003).
  const magFilter = geometry.straighten === 0 ? gl.NEAREST : gl.LINEAR
  const marks = layer && readRect(layer, { x: 0, y: 0, width: layer.width, height: layer.height })
  if (marks) {
    gl.activeTexture(gl.TEXTURE1)
    uploadTexture(gl, marks)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter)
    gl.activeTexture(gl.TEXTURE0)
  }
  const texture = uploadTexture(gl, bitmap)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter)
  gl.viewport(0, 0, width, height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(gpu.program)
  gl.bindVertexArray(gpu.vao)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  const size = { width, height }
  const view = { zoom: 1, panX: 0, panY: 0, autoFit: false }
  gl.uniformMatrix3fv(gpu.transform, false, viewToTransform(view, size, size))
  const original = { width: bitmap.width, height: bitmap.height }
  gl.uniformMatrix3fv(gpu.geometry, false, new Float32Array(cropToOriginalUv(geometry, original)))
  gl.uniform1i(gpu.flatten, 0)
  setLayerUniforms(gl, gpu, marks !== null)
  setAdjustmentUniforms(gl, gpu, adjustments)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  const ctx = new OffscreenCanvas(width, height).getContext('2d')!
  ctx.drawImage(canvas, 0, 0)
  // Free the context at once: engines cap live WebGL contexts (16 on Chromium) and lose the
  // oldest, which would be the Preview's, after enough calls in one test.
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  return Array.from(ctx.getImageData(0, 0, width, height).data)
}

/** The reference drawing on the Original's grid (draw sad.md §8): every colour, three widths, erasing. */
function referenceDrawing(original: Size): Layer {
  const layer = createLayer(original)
  const g = identityGeometry(original)
  const { width: W, height: H } = original
  const widths = [1, 12, 200]
  PALETTE.forEach(({ hex }, i) => {
    const y = ((i + 0.5) / PALETTE.length) * H
    const width = widths[i % widths.length]!
    const points = [
      { x: 0.05 * W, y },
      { x: 0.3 * W, y: y - 0.04 * H },
      { x: 0.6 * W, y: y + 0.04 * H },
      { x: 0.9 * W, y },
    ]
    paintPath(layer, points, { mode: 'brush', colour: hex, width }, g)
    paintDot(layer, { x: 0.95 * W, y }, { mode: 'brush', colour: hex, width: 12 }, g)
  })
  const erase = (x: number, width: number) =>
    paintPath(
      layer,
      [
        { x: x * W, y: 0 },
        { x: (x + 0.05) * W, y: 0.5 * H },
        { x: x * W, y: H },
      ],
      { mode: 'eraser' as DrawMode, colour: '#000000', width },
      g,
    )
  erase(0.45, 40)
  erase(0.75, 7)
  return layer
}

/** Paints a whole Stroke through the painter, every segment with its Catmull–Rom neighbours. */
function paintPath(layer: Layer, points: Point[], style: BrushStyle, g: Geometry) {
  for (let i = 1; i < points.length; i++) {
    const segment = catmullRomSegment(
      points[i - 2] ?? points[i - 1]!,
      points[i - 1]!,
      points[i]!,
      points[i + 1] ?? points[i]!,
    )
    paintSegment(layer, segment, style, g)
  }
}

/** A layer's alpha channel, row by row; empty with no layer. */
function alphaOf(layer: Layer | null | undefined): number[] {
  const pixels = layer && readRect(layer, { x: 0, y: 0, width: layer.width, height: layer.height })
  return pixels ? Array.from(pixels.data.filter((_, i) => i % 4 === 3)) : []
}

export function installTestHooks(pinia: Pinia): void {
  const editor = useEditorStore(pinia)
  const exporter = useExportStore(pinia)
  let release: (() => void) | undefined
  window.__imglyTest = {
    work: () => {
      const work = editor.work
      if (!work) return null
      const { id, revision, original, geometry, adjustments, sourceName, sourceFormat } = work
      const size = workSize(work)
      return {
        id,
        revision,
        width: size.width,
        height: size.height,
        originalWidth: original.width,
        originalHeight: original.height,
        geometry,
        adjustments: { ...adjustments },
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
      const work = editor.work
      return work
        ? renderAt100(
            work.original.pixels,
            work.geometry,
            work.adjustments,
            work.drawing as Layer | null,
          )
        : []
    },
    exportStatus: () => exporter.status,
    applyEdit: () => editor.applyEdit(),
    setGeometry: (geometry) => editor.applyGeometry(geometry),
    setAdjustments: (adjustments) => editor.applyAdjustments(adjustments),
    setReferenceDrawing: () => {
      const work = editor.work
      if (work) editor.applyDrawing(referenceDrawing(work.original), true)
    },
    setFullDrawing: () => {
      const work = editor.work
      if (!work) return
      const layer = createLayer(work.original)
      const g = identityGeometry(work.original)
      const { width: W, height: H } = work.original
      for (let y = 0, i = 0; y <= H + 100; y += 100, i++) {
        const colour = PALETTE[i % PALETTE.length]!.hex
        paintPath(
          layer,
          [
            { x: -100, y },
            { x: W + 100, y },
          ],
          { mode: 'brush', colour, width: 200 },
          g,
        )
      }
      editor.applyDrawing(layer, true)
    },
    paintStroke: async (points, style, hz = 120) => {
      const work = editor.work
      if (!work || !editor.openTool('draw').ok) return { frameIntervals: [], latencies: [] }
      const layer = createLayer(work.original)
      editor.setPreviewLayer(layer)
      const g = work.geometry
      const frameIntervals: number[] = []
      const latencies: number[] = []
      let pendingMoves: number[] = []
      let lastFrame: number | undefined
      let stroking = true
      // Registered after the renderer's own frame request, so it runs once that frame is drawn.
      const onFrame = () => {
        const now = performance.now()
        if (lastFrame !== undefined) frameIntervals.push(now - lastFrame)
        lastFrame = now
        for (const t of pendingMoves) latencies.push(now - t)
        pendingMoves = []
        if (stroking) requestAnimationFrame(onFrame)
      }
      requestAnimationFrame(onFrame)
      const segmentTo = (i: number) =>
        catmullRomSegment(
          points[i - 2] ?? points[i - 1]!,
          points[i - 1]!,
          points[i]!,
          points[i + 1] ?? points[i]!,
        )
      const start = performance.now()
      for (let i = 0; i < points.length; i++) {
        const due = start + (i * 1000) / hz
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, due - performance.now())))
        const moved = performance.now()
        // The segment behind the newest point is painted once the point after it is known.
        if (i >= 2) editor.layerChanged(paintSegment(layer, segmentTo(i - 1), style, g))
        else if (i === 0 && points.length === 1)
          editor.layerChanged(paintDot(layer, points[0]!, style, g))
        pendingMoves.push(moved)
      }
      if (points.length >= 2) {
        editor.layerChanged(paintSegment(layer, segmentTo(points.length - 1), style, g))
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      stroking = false
      editor.closeTool()
      releaseLayer(layer)
      return { frameIntervals, latencies }
    },
    drawingAlpha: () => alphaOf(editor.work?.drawing as Layer | null | undefined),
    draftAlpha: () => (editor.activeTool === 'draw' ? alphaOf(editor.previewLayer) : []),
    layers: () => ({
      created: bitmapLedger.layersCreated,
      released: bitmapLedger.layersReleased,
      retained: bitmapLedger.layersCreated - bitmapLedger.layersReleased,
    }),
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
