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
  type ImageSample,
  type Result,
  type View,
} from '@/core'
import {
  buildProgram,
  IDENTITY_GEOMETRY,
  setAdjustmentUniforms,
  setLayerUniforms,
  allocateBlankTexture,
  uploadTexture,
  type GpuProgram,
} from './shaders'
import { viewToTransform } from './view-transform'
import { clampToLayer, isBlankLayer, readRect, type Layer, type LayerRect } from './drawing'

const union = (a: LayerRect, b: LayerRect): LayerRect => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

/** Marked on the first frame drawn after a new Original; the @perf suite times opens to it. */
export const FIRST_FRAME_MARK = 'imgly:first-frame'

/**
 * The unit quad onto the whole sample framebuffer with v up, so `readPixels`, which reads from the
 * bottom row, returns the Crop's top row first.
 */
const SAMPLE_TRANSFORM = new Float32Array([2, 0, 0, 0, 2, 0, -1, -1, 1])

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
  /**
   * Auto's sample of the Work (adjust ADR-0004): the Crop through `g`, with no Adjustments, into a
   * framebuffer whose long side is at most `maxSide`, one exact texel per pixel (NEAREST), read back
   * premultiplied and row-major from the top. Everything it allocates is freed before it returns.
   * `DISPLAY_LOST` while the context is not ready.
   */
  sampleCrop(g: Geometry, maxSide: number): Result<ImageSample, AppError>
  /**
   * Shows `layer` over the image (draw ADR-0003), or no marks for null. The whole layer is uploaded
   * only when its canvas differs from the one held, so an Apply (same canvas, new id) uploads
   * nothing. Requests one frame. The caller keeps ownership of the layer.
   */
  setLayer(layer: Layer | null): void
  /**
   * Marks a dirty rectangle of the held layer (ADR-0002) and requests one frame. Rectangles marked
   * before that frame are uploaded once, as their union, when it is drawn.
   */
  updateLayer(rect: LayerRect): void
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
  let layer: Layer | null = null
  let layerTexture: WebGLTexture | null = null
  // The layer changed at 100% or above without new mipmaps; regenerated before a draw below 100%.
  let layerMipmapsStale = false
  // Below 100% the whole layer's mipmaps cost most of a frame (T9 spike), so a run of changed
  // frames regenerates them at most every other frame, with a follow-up frame to catch up.
  let regeneratedLastFrame = false
  // The union of the layer rectangles changed since the last frame, uploaded when it is drawn.
  let layerDirty: LayerRect | null = null
  let view: View | undefined
  let shown: { geometry: Geometry; mode: GeometryMode } | undefined
  let adjustments: Adjustments = NEUTRAL_ADJUSTMENTS
  let frame: number | undefined
  let firstFramePending = false
  let disposed = false

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
      layerTexture = null
      layerDirty = null
      uploadLayer()
    } catch {
      setStatus('lost')
      return
    }
    setStatus('ready')
    invalidate()
  }

  /**
   * Uploads the whole held layer on unit 1 as straight `ImageData` with the premultiply flag. A
   * blank layer (the first mark's new Draft) is allocated zero-filled instead: no readback.
   */
  function uploadLayer() {
    if (layer && isBlankLayer(layer)) {
      gl!.activeTexture(gl!.TEXTURE1)
      layerTexture = allocateBlankTexture(gl!, layer.width, layer.height)
      layerMipmapsStale = false
      gl!.activeTexture(gl!.TEXTURE0)
      return
    }
    const pixels =
      layer && readRect(layer, { x: 0, y: 0, width: layer.width, height: layer.height })
    if (!pixels) return
    gl!.activeTexture(gl!.TEXTURE1)
    layerTexture = uploadTexture(gl!, pixels)
    layerMipmapsStale = false
    gl!.activeTexture(gl!.TEXTURE0)
  }

  /** Uploads the dirty union to the bound layer texture and marks its mipmaps stale. */
  function uploadDirtyLayer() {
    const r = layer && layerDirty && clampToLayer(layer, layerDirty)
    layerDirty = null
    const pixels = r && readRect(layer!, r)
    if (!r || !pixels) return
    gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl!.texSubImage2D(gl!.TEXTURE_2D, 0, r.x, r.y, gl!.RGBA, gl!.UNSIGNED_BYTE, pixels)
    layerMipmapsStale = true
  }

  /** Regenerates stale mipmaps below 100%, skipping a frame right after a regeneration. */
  function refreshLayerMipmaps(zoom: number) {
    const due = layerMipmapsStale && zoom < 1
    if (due && regeneratedLastFrame) {
      regeneratedLastFrame = false
      invalidate()
      return
    }
    if (due) {
      gl!.generateMipmap(gl!.TEXTURE_2D)
      layerMipmapsStale = false
    }
    regeneratedLastFrame = due
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
    const magFilter = view.zoom >= 1 && !straightened ? gl!.NEAREST : gl!.LINEAR
    const drawing = layer !== null && layerTexture !== null
    if (drawing) {
      // The same filters as the Original's unit, so marks and image line up texel for texel.
      gl!.activeTexture(gl!.TEXTURE1)
      gl!.bindTexture(gl!.TEXTURE_2D, layerTexture)
      uploadDirtyLayer()
      refreshLayerMipmaps(view.zoom)
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, magFilter)
    }
    setLayerUniforms(gl!, gpu, drawing)
    gl!.activeTexture(gl!.TEXTURE0)
    gl!.bindTexture(gl!.TEXTURE_2D, texture)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, magFilter)
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
    sampleCrop(geometry, maxSide) {
      if (disposed || status !== 'ready' || !bitmap || !texture)
        return err(appError('DISPLAY_LOST'))
      const original = { width: bitmap.width, height: bitmap.height }
      const { width: cw, height: ch } = geometry.crop
      const scale = Math.min(1, maxSide / Math.max(cw, ch))
      const width = Math.max(1, Math.round(cw * scale))
      const height = Math.max(1, Math.round(ch * scale))
      const target = gl.createTexture()
      const framebuffer = gl.createFramebuffer()
      try {
        gl.bindTexture(gl.TEXTURE_2D, target)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0)
        gl.viewport(0, 0, width, height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.useProgram(gpu.program)
        gl.bindVertexArray(gpu.vao)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.uniformMatrix3fv(
          gpu.geometry,
          false,
          new Float32Array(cropToOriginalUv(geometry, original)),
        )
        gl.uniformMatrix3fv(gpu.transform, false, SAMPLE_TRANSFORM)
        gl.uniform1i(gpu.flatten, 0)
        setLayerUniforms(gl, gpu, false)
        setAdjustmentUniforms(gl, gpu, NEUTRAL_ADJUSTMENTS)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        const data = new Uint8Array(width * height * 4)
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data)
        return ok({ width, height, data })
      } catch {
        return err(appError('DISPLAY_LOST'))
      } finally {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.deleteFramebuffer(framebuffer)
        gl.deleteTexture(target)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      }
    },
    setLayer(next) {
      if (next?.pixels !== layer?.pixels) {
        if (layerTexture) gl.deleteTexture(layerTexture)
        layerTexture = null
        layerDirty = null
        layer = next
        if (status === 'ready') uploadLayer()
      } else {
        layer = next
      }
      invalidate()
    },
    updateLayer(rect) {
      if (!layer || !layerTexture || !clampToLayer(layer, rect)) return
      layerDirty = layerDirty ? union(layerDirty, rect) : rect
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
      disposed = true
      clearTimeout(deadline)
      listeners.clear()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      if (frame !== undefined) cancelFrame(frame)
      frame = undefined
      if (texture) gl.deleteTexture(texture)
      if (layerTexture) gl.deleteTexture(layerTexture)
      texture = null
      layerTexture = null
      layer = null
      bitmap = undefined
      gl.deleteBuffer(gpu.buffer)
      gl.deleteVertexArray(gpu.vao)
      gl.deleteProgram(gpu.program)
    },
  })
}
