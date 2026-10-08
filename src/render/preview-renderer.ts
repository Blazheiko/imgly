import {
  adjustmentsEquals,
  appError,
  NEUTRAL_ADJUSTMENTS,
  cropToOriginalUv,
  err,
  ok,
  turnedBounds,
  turnedImageToOriginalUv,
  type Adjustments,
  type AppError,
  type Geometry,
  type Result,
  type View,
} from '@/core'
import {
  buildProgram,
  IDENTITY_GEOMETRY,
  setAdjustmentUniforms,
  uploadTexture,
  type GpuProgram,
} from './shaders'
import { viewToTransform } from './view-transform'

/** Marked on the first frame drawn after a new Original; the @perf suite times opens to it. */
export const FIRST_FRAME_MARK = 'imgly:first-frame'

/** How long a lost context may take to come back before the display counts as lost (AC-19b). */
export const RESTORE_DEADLINE_MS = 5000

/** `restoring` while a lost context may still come back; `lost` once it can't (SCR-05). */
export type RendererStatus = 'ready' | 'restoring' | 'lost'

/** `crop` draws the Work (only the Crop); `whole` draws the whole turned image for a tool. */
export type GeometryMode = 'crop' | 'whole'

export interface PreviewRenderer {
  /** Uploads a new Original. The caller keeps ownership of the bitmap and closes it. */
  setOriginal(bitmap: ImageBitmap): void
  setView(view: View): void
  /**
   * Draws the Original through `g` (crop-rotate ADR-0002). The View's image is then the Crop
   * (`crop`) or the whole turned image's bounds (`whole`). Until called, the identity is drawn.
   */
  setGeometry(g: Geometry, mode: GeometryMode): void
  /**
   * Colours the Preview with `a` (adjust ADR-0002): sets uniforms and requests one frame, with no
   * texture upload. Until called, neutral values are drawn.
   */
  setAdjustments(a: Adjustments): void
  /** Sets the backing store size in device pixels. */
  resize(width: number, height: number): void
  readonly status: RendererStatus
  /** Subscribes to status changes; returns the unsubscribe function. */
  onStatus(listener: (status: RendererStatus) => void): () => void
  dispose(): void
}

export interface RendererDeps {
  requestFrame?: (draw: () => void) => number
  cancelFrame?: (handle: number) => void
  mark?: (name: string) => void
}

/**
 * One WebGL2 canvas showing the Original at the View (feature ADR 0003). Frames are drawn on
 * `requestAnimationFrame` only after something changed — there is no render loop.
 */
export function createPreviewRenderer(
  canvas: HTMLCanvasElement,
  deps: RendererDeps = {},
): Result<PreviewRenderer, AppError> {
  const requestFrame = deps.requestFrame ?? ((fn) => requestAnimationFrame(fn))
  const cancelFrame = deps.cancelFrame ?? ((handle) => cancelAnimationFrame(handle))
  const mark = deps.mark ?? ((name) => performance.mark(name))

  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false })
  if (!gl) return err(appError('UNSUPPORTED_BROWSER'))

  let gpu: GpuProgram
  try {
    gpu = buildProgram(gl)
  } catch {
    return err(appError('DISPLAY_LOST')) // a context that can't build the program can't show it
  }
  let status: RendererStatus = 'ready'
  let deadline: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<(status: RendererStatus) => void>()
  let bitmap: ImageBitmap | undefined
  let texture: WebGLTexture | null = null
  let view: View | undefined
  let shown: { geometry: Geometry; mode: GeometryMode } | undefined
  let adjustments: Adjustments = NEUTRAL_ADJUSTMENTS
  let frame: number | undefined
  let firstFramePending = false

  function invalidate() {
    if (frame === undefined) frame = requestFrame(draw)
  }

  function setStatus(next: RendererStatus) {
    if (status === next) return
    status = next
    for (const listener of listeners) listener(next)
  }

  /** The browser may restore a lost context only if the loss event's default is prevented. */
  function onContextLost(event: Event) {
    event.preventDefault()
    if (status === 'lost') return
    clearTimeout(deadline)
    deadline = setTimeout(() => setStatus('lost'), RESTORE_DEADLINE_MS)
    setStatus('restoring')
  }

  /** Rebuilds the program and re-uploads the kept bitmap; Work and View are untouched (AC-19). */
  function onContextRestored() {
    if (status !== 'restoring') return
    clearTimeout(deadline)
    try {
      gpu = buildProgram(gl!)
      texture = bitmap ? uploadTexture(gl!, bitmap) : null
    } catch {
      setStatus('lost')
      return
    }
    setStatus('ready')
    invalidate()
  }

  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('webglcontextrestored', onContextRestored)

  function draw() {
    frame = undefined
    if (status !== 'ready') return
    if (!bitmap || !texture || !view || canvas.width === 0 || canvas.height === 0) return
    const original = { width: bitmap.width, height: bitmap.height }
    const size = { width: canvas.width, height: canvas.height }
    let image = original
    let uvMatrix = IDENTITY_GEOMETRY
    if (shown) {
      const { geometry: g, mode } = shown
      const box = mode === 'crop' ? g.crop : turnedBounds(g, original)
      image = { width: box.width, height: box.height }
      uvMatrix = new Float32Array(
        mode === 'crop' ? cropToOriginalUv(g, original) : turnedImageToOriginalUv(g, original),
      )
    }
    // A Straighten angle maps pixel centres between texels: magnify bilinearly, as the Export does.
    const straightened = shown !== undefined && shown.geometry.straighten !== 0

    gl!.viewport(0, 0, size.width, size.height)
    gl!.clearColor(0, 0, 0, 0)
    gl!.clear(gl!.COLOR_BUFFER_BIT)
    gl!.useProgram(gpu.program)
    gl!.bindVertexArray(gpu.vao)
    gl!.activeTexture(gl!.TEXTURE0)
    gl!.bindTexture(gl!.TEXTURE_2D, texture)
    gl!.texParameteri(
      gl!.TEXTURE_2D,
      gl!.TEXTURE_MAG_FILTER,
      view.zoom >= 1 && !straightened ? gl!.NEAREST : gl!.LINEAR,
    )
    gl!.uniformMatrix3fv(gpu.geometry, false, uvMatrix)
    gl!.uniformMatrix3fv(gpu.transform, false, viewToTransform(view, image, size))
    setAdjustmentUniforms(gl!, gpu, adjustments)
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)

    if (firstFramePending) {
      firstFramePending = false
      mark(FIRST_FRAME_MARK)
    }
  }

  return ok({
    setOriginal(next) {
      bitmap = next
      if (status === 'ready') {
        const old = texture
        texture = uploadTexture(gl, next)
        if (old) gl.deleteTexture(old)
      }
      firstFramePending = true
      invalidate()
    },
    setView(next) {
      if (view && view.zoom === next.zoom && view.panX === next.panX && view.panY === next.panY) {
        view = next
        return
      }
      view = next
      invalidate()
    },
    setGeometry(geometry, mode) {
      shown = { geometry, mode }
      invalidate()
    },
    setAdjustments(next) {
      if (adjustmentsEquals(next, adjustments)) return
      adjustments = { ...next }
      invalidate()
    },
    resize(width, height) {
      if (canvas.width === width && canvas.height === height) return
      canvas.width = width
      canvas.height = height
      invalidate()
    },
    get status() {
      return status
    },
    onStatus(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      clearTimeout(deadline)
      listeners.clear()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      if (frame !== undefined) cancelFrame(frame)
      frame = undefined
      if (texture) gl.deleteTexture(texture)
      texture = null
      bitmap = undefined
      gl.deleteBuffer(gpu.buffer)
      gl.deleteVertexArray(gpu.vao)
      gl.deleteProgram(gpu.program)
    },
  })
}
