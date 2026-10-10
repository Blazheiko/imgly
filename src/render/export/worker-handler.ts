import {
  appError,
  cropToOriginalUv,
  err,
  identityGeometry,
  EXPORT_MIME_TYPES,
  HEADER_WINDOW_BYTES,
  isNeutral,
  NEUTRAL_ADJUSTMENTS,
  ok,
  sniffImageHeader,
  stripMetadata,
  type Adjustments,
  type AppError,
  type ExportFormat,
  type Geometry,
  type Result,
} from '@/core'
import {
  buildProgram,
  IDENTITY_GEOMETRY,
  setAdjustmentUniforms,
  setLayerUniforms,
  uploadTexture,
  type GpuProgram,
} from '../shaders'

/**
 * One export: a transferred copy of the Original, the Work's Geometry and applied Adjustments, the
 * output size (counted from the Crop's), format and quality (1–100).
 */
export interface ExportRequest {
  bitmap: ImageBitmap
  width: number
  height: number
  format: ExportFormat
  quality: number
  geometry: Geometry
  /** The Work's applied Adjustments (adjust ADR-0001); never an open tool's Draft. */
  adjustments: Adjustments
  /**
   * The Work's applied Drawing layer as straight RGBA on the Original's grid, transferred, or null
   * (draw ADR-0003); never the draw tool's Draft.
   */
  layer: ImageData | null
}

/** Whether any pixel inside the Crop is not fully opaque (crop-rotate ADR-0004). */
export interface AlphaRequest {
  bitmap: ImageBitmap
  geometry: Geometry
  /** The applied Drawing layer, composited before the check (draw ADR-0003), or null. */
  layer: ImageData | null
}

/** The browser APIs the export needs, injected so it runs under unit tests too. */
export interface ExportEnv {
  createCanvas(width: number, height: number): OffscreenCanvas
  /** A 2×2 semi-transparent bitmap for the session format check. */
  createSample(): ImageBitmap
}

export const browserExportEnv: ExportEnv = {
  createCanvas: (width, height) => new OffscreenCanvas(width, height),
  createSample: () => {
    const canvas = new OffscreenCanvas(2, 2)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgba(200, 40, 40, 0.5)'
    ctx.fillRect(0, 0, 2, 2)
    return canvas.transferToImageBitmap()
  },
}

/** What the worker answers to the session format check; PNG is always offered. */
export interface FormatCheck {
  /** This context can render with WebGL2; the client falls back to the window without it. */
  webgl2: boolean
  jpeg: boolean
  webp: boolean
}

/** A message to the export worker: one export, the session format check, or an alpha check. */
export type ExportWorkerMessage =
  | { kind: 'export'; request: ExportRequest }
  | { kind: 'check' }
  | { kind: 'alpha'; request: AlphaRequest }

/** Fills the canvas with the unit quad (the Crop), upright: (0,0) → top-left in clip space (AC-03). */
const FULL_QUAD = new Float32Array([2, 0, 0, 0, -2, 0, -1, 1, 1])

/**
 * Fills a framebuffer with the unit quad, v up, so the pass texture's v = 0 is the Crop's top row
 * and the second pass samples it through the identity.
 */
const PASS_QUAD = new Float32Array([2, 0, 0, 0, 2, 0, -1, -1, 1])

const failed = () => err(appError('EXPORT_FAILED'))

/**
 * Renders the Work with the Preview's shaders on a WebGL2 `OffscreenCanvas` at the export size,
 * flattens onto white for JPEG, encodes with the browser's encoder and checks the result by content
 * (export ADR-0002). Nothing unverified is returned; the bitmap copy is closed in every branch.
 */
export async function handleExport(
  request: ExportRequest,
  env: ExportEnv,
): Promise<Result<Blob, AppError>> {
  const { bitmap } = request
  try {
    const canvas = env.createCanvas(request.width, request.height)
    if (!render(canvas, request, env)) return failed()
    const encoded = await encode(copyTo2d(canvas, env), request)
    const stripped = stripMetadata(new Uint8Array(await encoded.arrayBuffer()))
    const blob = new Blob([stripped as Uint8Array<ArrayBuffer>], { type: encoded.type })
    return await verify(blob, request)
  } catch {
    return failed()
  } finally {
    bitmap.close()
  }
}

/**
 * Renders the Crop at its full size through the export path, unflattened, and reads the alpha
 * channel back: true when any pixel is not fully opaque (crop-rotate ADR-0004). The bitmap copy is
 * closed in every branch.
 */
export async function handleAlpha(
  request: AlphaRequest,
  env: ExportEnv,
): Promise<Result<boolean, AppError>> {
  const { bitmap, geometry } = request
  try {
    const { width, height } = geometry.crop
    const canvas = env.createCanvas(width, height)
    const gl = render(
      canvas,
      { ...request, width, height, format: 'png', quality: 100, adjustments: NEUTRAL_ADJUSTMENTS },
      env,
    )
    if (!gl) return failed()
    const pixels = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    if (gl.isContextLost()) return failed()
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i]! < 255) return ok(true)
    }
    return ok(false)
  } catch {
    return failed()
  } finally {
    bitmap.close()
  }
}

/**
 * Trial-encodes a 2×2 sample in JPEG and WebP through the very path an export takes, judged by
 * content; any error counts as unavailable (AC-12).
 */
export async function handleCheck(env: ExportEnv): Promise<FormatCheck> {
  if (!canRender(env)) return { webgl2: false, jpeg: false, webp: false }
  const check = async (format: 'jpeg' | 'webp') => {
    try {
      const sample = env.createSample()
      const result = await handleExport(
        {
          bitmap: sample,
          width: 2,
          height: 2,
          format,
          quality: 90,
          geometry: identityGeometry({ width: 2, height: 2 }),
          adjustments: NEUTRAL_ADJUSTMENTS,
          layer: null,
        },
        env,
      )
      return result.ok
    } catch {
      return false
    }
  }
  return { webgl2: true, jpeg: await check('jpeg'), webp: await check('webp') }
}

/** Whether a WebGL2 context can be made here at all (Linux WebKit has none in workers). */
function canRender(env: ExportEnv): boolean {
  try {
    const gl = env.createCanvas(1, 1).getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return gl !== null && gl !== undefined
  } catch {
    return false
  }
}

/**
 * The bitmap's straight RGBA through a 2D canvas: the one readback every engine agrees on, whatever
 * premultiplication state a transferred bitmap carries (WebKit's copies disagree with WebGL).
 */
function readPixels(bitmap: ImageBitmap, env: ExportEnv): ImageData {
  const ctx = env
    .createCanvas(bitmap.width, bitmap.height)
    .getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(bitmap, 0, 0)
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
}

/**
 * Draws the Work through its Geometry and Adjustments, with its Drawing layer on top, into the
 * canvas; the context, or null when there is no usable WebGL2 context. A smaller Export with
 * Adjustments or a layer takes two passes (adjust sad.md §5, draw ADR-0003): the Crop at full size
 * with the Adjustments and the layer into a texture, then that texture reduced through its mipmaps,
 * flattened for JPEG in that last pass. Otherwise one pass, as before.
 */
function render(
  canvas: OffscreenCanvas,
  request: ExportRequest,
  env: ExportEnv,
): WebGL2RenderingContext | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  })
  if (!gl) return null
  const { bitmap, width, height, geometry, adjustments } = request
  const gpu = buildProgram(gl)
  let layer: WebGLTexture | null = null
  if (request.layer) {
    gl.activeTexture(gl.TEXTURE1)
    layer = uploadTexture(gl, request.layer)
    gl.activeTexture(gl.TEXTURE0)
  }
  const texture = uploadTexture(gl, readPixels(bitmap, env))
  const original = { width: bitmap.width, height: bitmap.height }
  const uv = new Float32Array(cropToOriginalUv(geometry, original))
  const flatten = request.format === 'jpeg'
  const full = width === geometry.crop.width && height === geometry.crop.height
  const unturned = geometry.straighten === 0

  if (full || (isNeutral(adjustments) && !layer)) {
    draw(gl, gpu, texture, {
      width,
      height,
      uv,
      adjustments,
      flatten,
      exact: full && unturned,
      layer,
    })
  } else {
    const { width: cw, height: ch } = geometry.crop
    const pass = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, pass)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cw, ch, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const framebuffer = gl.createFramebuffer()
    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pass, 0)
      draw(gl, gpu, texture, {
        width: cw,
        height: ch,
        uv,
        adjustments,
        flatten: false,
        exact: unturned,
        transform: PASS_QUAD,
        layer,
      })
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.bindTexture(gl.TEXTURE_2D, pass)
      gl.generateMipmap(gl.TEXTURE_2D)
      draw(gl, gpu, pass, {
        width,
        height,
        uv: IDENTITY_GEOMETRY,
        adjustments: NEUTRAL_ADJUSTMENTS,
        flatten,
        exact: false,
        layer: null,
      })
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.deleteFramebuffer(framebuffer)
      gl.deleteTexture(pass)
    }
  }
  gl.finish()
  if (layer) gl.deleteTexture(layer)
  return gl.isContextLost() ? null : gl
}

interface Pass {
  width: number
  height: number
  /** The unit quad → the source texture's coordinates. */
  uv: Float32Array
  adjustments: Adjustments
  flatten: boolean
  /**
   * Texel centres 1:1 (NEAREST): full size without a Straighten angle, as the Preview at 100%. A
   * Straighten angle magnifies bilinearly, as the Preview does; smaller sizes use the mipmaps.
   */
  exact: boolean
  transform?: Float32Array
  /** The Drawing layer's texture, composited on unit 1 with the same filters, or null. */
  layer: WebGLTexture | null
}

/** One textured quad over the bound framebuffer at `width`×`height`. */
function draw(gl: WebGL2RenderingContext, gpu: GpuProgram, source: WebGLTexture | null, p: Pass) {
  const filters = () => {
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      p.exact ? gl.NEAREST : gl.LINEAR_MIPMAP_LINEAR,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, p.exact ? gl.NEAREST : gl.LINEAR)
  }
  if (p.layer) {
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, p.layer)
    filters()
    gl.activeTexture(gl.TEXTURE0)
  }
  gl.bindTexture(gl.TEXTURE_2D, source)
  filters()

  gl.viewport(0, 0, p.width, p.height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(gpu.program)
  gl.bindVertexArray(gpu.vao)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, source)
  gl.uniformMatrix3fv(gpu.transform, false, p.transform ?? FULL_QUAD)
  gl.uniformMatrix3fv(gpu.geometry, false, p.uv)
  gl.uniform1i(gpu.flatten, p.flatten ? 1 : 0)
  setLayerUniforms(gl, gpu, p.layer !== null)
  setAdjustmentUniforms(gl, gpu, p.adjustments)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

/**
 * Copies the render into a 2D canvas for encoding. Engines differ on encoding a premultiplied
 * WebGL canvas directly (WebKit writes premultiplied colour); a 2D copy is un-premultiplied
 * correctly everywhere, as the Preview's readback is.
 */
function copyTo2d(source: OffscreenCanvas, env: ExportEnv): OffscreenCanvas {
  const copy = env.createCanvas(source.width, source.height)
  const ctx = copy.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(source, 0, 0)
  return copy
}

async function encode(canvas: OffscreenCanvas, request: ExportRequest): Promise<Blob> {
  const type = EXPORT_MIME_TYPES[request.format]
  return canvas.convertToBlob(
    request.format === 'png' ? { type } : { type, quality: request.quality / 100 },
  )
}

/** The file must be the asked format at the asked size, judged by its own header (AC-12). */
async function verify(blob: Blob, request: ExportRequest): Promise<Result<Blob, AppError>> {
  const head = new Uint8Array(await blob.slice(0, HEADER_WINDOW_BYTES).arrayBuffer())
  const header = sniffImageHeader(head)
  const produced = header.ok ? header.value.format : null
  if (
    !header.ok ||
    produced !== request.format ||
    header.value.width !== request.width ||
    header.value.height !== request.height
  ) {
    return err(appError('EXPORT_FORMAT_MISMATCH', { asked: request.format, produced }))
  }
  return ok(blob)
}
