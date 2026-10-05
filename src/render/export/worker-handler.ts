import {
  appError,
  err,
  EXPORT_MIME_TYPES,
  HEADER_WINDOW_BYTES,
  ok,
  sniffImageHeader,
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

/** The browser APIs the export needs, injected so it runs under unit tests too. */
export interface ExportEnv {
  createCanvas(width: number, height: number): OffscreenCanvas
}

export const browserExportEnv: ExportEnv = {
  createCanvas: (width, height) => new OffscreenCanvas(width, height),
}

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
    const canvas = env.createCanvas(request.width, request.height)
    const blob = render(canvas, request) ? await encode(canvas, request) : undefined
    if (!blob) return failed()
    return await verify(blob, request)
  } catch {
    return failed()
  } finally {
    bitmap.close()
  }
}

/** Draws the Work into the canvas; false when there is no usable WebGL2 context. */
function render(canvas: OffscreenCanvas, request: ExportRequest): boolean {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  })
  if (!gl) return false
  const { bitmap, width, height } = request
  const gpu = buildProgram(gl)
  const texture = uploadTexture(gl, bitmap)
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
