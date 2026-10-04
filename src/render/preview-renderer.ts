import { appError, err, ok, type AppError, type Result, type View } from '@/core'
import { viewToTransform } from './view-transform'

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
uniform mat3 u_transform;
out vec2 v_uv;
void main() {
  v_uv = a_position;
  vec3 p = u_transform * vec3(a_position, 1.0);
  gl_Position = vec4(p.xy, 0.0, 1.0);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_image;
in vec2 v_uv;
out vec4 outColor;
void main() {
  outColor = texture(u_image, v_uv);
}`

/** Marked on the first frame drawn after a new Original; the @perf suite times opens to it. */
export const FIRST_FRAME_MARK = 'imgly:first-frame'

export interface PreviewRenderer {
  /** Uploads a new Original. The caller keeps ownership of the bitmap and closes it. */
  setOriginal(bitmap: ImageBitmap): void
  setView(view: View): void
  /** Sets the backing store size in device pixels. */
  resize(width: number, height: number): void
  dispose(): void
}

export interface RendererDeps {
  requestFrame?: (draw: () => void) => number
  cancelFrame?: (handle: number) => void
  mark?: (name: string) => void
}

interface GpuState {
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  buffer: WebGLBuffer
  transform: WebGLUniformLocation | null
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

  const gpu = buildProgram(gl)
  let bitmap: ImageBitmap | undefined
  let texture: WebGLTexture | null = null
  let view: View | undefined
  let frame: number | undefined
  let firstFramePending = false

  function invalidate() {
    if (frame === undefined) frame = requestFrame(draw)
  }

  function draw() {
    frame = undefined
    if (!bitmap || !texture || !view || canvas.width === 0 || canvas.height === 0) return
    const image = { width: bitmap.width, height: bitmap.height }
    const size = { width: canvas.width, height: canvas.height }

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
      view.zoom >= 1 ? gl!.NEAREST : gl!.LINEAR,
    )
    gl!.uniformMatrix3fv(gpu.transform, false, viewToTransform(view, image, size))
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)

    if (firstFramePending) {
      firstFramePending = false
      mark(FIRST_FRAME_MARK)
    }
  }

  return ok({
    setOriginal(next) {
      const old = texture
      texture = uploadTexture(gl, next)
      if (old) gl.deleteTexture(old)
      bitmap = next
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
    resize(width, height) {
      if (canvas.width === width && canvas.height === height) return
      canvas.width = width
      canvas.height = height
      invalidate()
    },
    dispose() {
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

function uploadTexture(gl: WebGL2RenderingContext, bitmap: ImageBitmap): WebGLTexture | null {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return texture
}

function buildProgram(gl: WebGL2RenderingContext): GpuState {
  const program = gl.createProgram()!
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX_SHADER],
    [gl.FRAGMENT_SHADER, FRAGMENT_SHADER],
  ] as const) {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`preview shader failed to compile: ${gl.getShaderInfoLog(shader)}`)
    }
    gl.attachShader(program, shader)
    gl.deleteShader(shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`preview program failed to link: ${gl.getProgramInfoLog(program)}`)
  }

  const vao = gl.createVertexArray()!
  const buffer = gl.createBuffer()!
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  gl.useProgram(program)
  gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0)
  return { program, vao, buffer, transform: gl.getUniformLocation(program, 'u_transform') }
}
