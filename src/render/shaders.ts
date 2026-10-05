/**
 * The one shader source for every rendering of the Work: the Preview on the main thread and the
 * export worker (export ADR-0002). Runs in a window or a worker: no DOM, the context is passed in.
 */

export const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
uniform mat3 u_transform;
out vec2 v_uv;
void main() {
  v_uv = a_position;
  vec3 p = u_transform * vec3(a_position, 1.0);
  gl_Position = vec4(p.xy, 0.0, 1.0);
}`

/**
 * Samples the premultiplied Original. With `u_flatten` (JPEG export) the pixel is composited onto
 * white on the stored sRGB values: colour + (1 − opacity) × white, opacity 1 (export AC-15).
 */
export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform bool u_flatten;
in vec2 v_uv;
out vec4 outColor;
void main() {
  vec4 color = texture(u_image, v_uv);
  outColor = u_flatten ? vec4(color.rgb + (1.0 - color.a), 1.0) : color;
}`

export interface GpuProgram {
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  buffer: WebGLBuffer
  transform: WebGLUniformLocation | null
  flatten: WebGLUniformLocation | null
}

/** Compiles and links the shared program over a unit quad; throws when the context can't. */
export function buildProgram(gl: WebGL2RenderingContext): GpuProgram {
  const program = gl.createProgram()!
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX_SHADER],
    [gl.FRAGMENT_SHADER, FRAGMENT_SHADER],
  ] as const) {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`shader failed to compile: ${gl.getShaderInfoLog(shader)}`)
    }
    gl.attachShader(program, shader)
    gl.deleteShader(shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program failed to link: ${gl.getProgramInfoLog(program)}`)
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
  return {
    program,
    vao,
    buffer,
    transform: gl.getUniformLocation(program, 'u_transform'),
    flatten: gl.getUniformLocation(program, 'u_flatten'),
  }
}

/** Uploads a bitmap as a premultiplied, mipmapped sRGB texture (open-and-view ADR-0003). */
export function uploadTexture(
  gl: WebGL2RenderingContext,
  bitmap: ImageBitmap,
): WebGLTexture | null {
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
