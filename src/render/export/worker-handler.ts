import {
  appError,
  err,
  EXPORT_MIME_TYPES,
  HEADER_WINDOW_BYTES,
  ok,
  sniffImageHeader,
  stripMetadata,
  type AppError,
  type ExportFormat,
  type Result,
} from '@/core'
import { buildProgram, uploadTexture } from '../shaders'

/** One export: a transferred copy of the Original, the output size, format and quality (1–100). */
export interface ExportRequest {
  bitmap: ImageBitmap
  width: number
  height: number
  format: ExportFormat
  quality: number
}

/** A canvas the export renders into with WebGL2. */
export type RenderCanvas = OffscreenCanvas | HTMLCanvasElement

/** The browser APIs the export needs, injected so it runs under unit tests too. */
export interface ExportEnv {
  createCanvas(width: number, height: number): OffscreenCanvas
  /** The WebGL2 render target; `createCanvas` when absent. */
  createRenderCanvas?(width: number, height: number): RenderCanvas
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

/** A message to the export worker: one export, or the session format check. */
export type ExportWorkerMessage = { kind: 'export'; request: ExportRequest } | { kind: 'check' }

/** Fills the canvas with the whole Work, upright: uv (0,0) → top-left in clip space (AC-03). */
const FULL_QUAD = new Float32Array([2, 0, 0, 0, -2, 0, -1, 1, 1])

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
    const canvas = renderCanvas(env, request.width, request.height)
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
 * Trial-encodes a 2×2 sample in JPEG and WebP through the very path an export takes, judged by
 * content; any error counts as unavailable (AC-12).
 */
export async function handleCheck(env: ExportEnv): Promise<FormatCheck> {
  if (!canRender(env)) return { webgl2: false, jpeg: false, webp: false }
  const check = async (format: 'jpeg' | 'webp') => {
    try {
      const sample = env.createSample()
      const result = await handleExport(
        { bitmap: sample, width: 2, height: 2, format, quality: 90 },
        env,
      )
      return result.ok
    } catch {
      return false
    }
  }
  return { webgl2: true, jpeg: await check('jpeg'), webp: await check('webp') }
}

function renderCanvas(env: ExportEnv, width: number, height: number): RenderCanvas {
  return env.createRenderCanvas?.(width, height) ?? env.createCanvas(width, height)
}

/** Whether a WebGL2 context can be made here at all (Linux WebKit has none in workers). */
function canRender(env: ExportEnv): boolean {
  try {
    const gl = renderCanvas(env, 1, 1).getContext('webgl2')
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

/** Draws the Work into the canvas; false when there is no usable WebGL2 context. */
function render(canvas: RenderCanvas, request: ExportRequest, env: ExportEnv): boolean {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  })
  if (!gl) return false
  const { bitmap, width, height } = request
  const gpu = buildProgram(gl)
  const texture = uploadTexture(gl, readPixels(bitmap, env))
  // Full size samples texel centres 1:1, as the Preview at 100%; smaller sizes use the mipmaps.
  const fullSize = width === bitmap.width && height === bitmap.height
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    fullSize ? gl.NEAREST : gl.LINEAR_MIPMAP_LINEAR,
  )
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, fullSize ? gl.NEAREST : gl.LINEAR)

  gl.viewport(0, 0, width, height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(gpu.program)
  gl.bindVertexArray(gpu.vao)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.uniformMatrix3fv(gpu.transform, false, FULL_QUAD)
  gl.uniform1i(gpu.flatten, request.format === 'jpeg' ? 1 : 0)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  gl.finish()
  return !gl.isContextLost()
}

/**
 * Copies the render into a 2D canvas for encoding. Engines differ on encoding a premultiplied
 * WebGL canvas directly (WebKit writes premultiplied colour); a 2D copy is un-premultiplied
 * correctly everywhere, as the Preview's readback is.
 */
function copyTo2d(source: RenderCanvas, env: ExportEnv): OffscreenCanvas {
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
