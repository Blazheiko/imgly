/**
 * The one shader source for every rendering of the Work: the Preview on the main thread and the
 * export worker (export ADR-0002). Runs in a window or a worker: no DOM, the context is passed in.
 */

export const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
uniform mat3 u_transform;
uniform mat3 u_geometry;
out vec2 v_uv;
void main() {
  v_uv = (u_geometry * vec3(a_position, 1.0)).xy;
  vec3 p = u_transform * vec3(a_position, 1.0);
  gl_Position = vec4(p.xy, 0.0, 1.0);
}`

/**
 * Samples the premultiplied Original; outside it (the empty corners of a straightened image in the
 * tool, crop-rotate ADR-0002) the output is transparent. With `u_flatten` (JPEG export) the pixel is composited onto
 * white on the stored sRGB values: colour + (1 − opacity) × white, opacity 1 (export AC-15).
 */
export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform bool u_flatten;
in vec2 v_uv;
out vec4 outColor;
void main() {
  if (any(lessThan(v_uv, vec2(0.0))) || any(greaterThan(v_uv, vec2(1.0)))) {
    outColor = vec4(0.0);
    return;
  }
  vec4 color = texture(u_image, v_uv);
  outColor = u_flatten ? vec4(color.rgb + (1.0 - color.a), 1.0) : color;
}`

export interface GpuProgram {
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  buffer: WebGLBuffer
  transform: WebGLUniformLocation | null
  /** The unit quad → Original texture coordinates (`cropToOriginalUv`, crop-rotate ADR-0001). */
  geometry: WebGLUniformLocation | null
  flatten: WebGLUniformLocation | null
}

/** `u_geometry` for the identity Geometry: the quad is the whole Original. */
export const IDENTITY_GEOMETRY = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])

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
  const geometry = gl.getUniformLocation(program, 'u_geometry')
  gl.uniformMatrix3fv(geometry, false, IDENTITY_GEOMETRY)
  return {
    program,
    vao,
    buffer,
    transform: gl.getUniformLocation(program, 'u_transform'),
    geometry,
    flatten: gl.getUniformLocation(program, 'u_flatten'),
  }
}

/**
 * Uploads pixels as a premultiplied, mipmapped sRGB texture (open-and-view ADR-0003). The premultiply
 * flag is honoured for `ImageData`; for an `ImageBitmap` the bitmap's own state decides, and WebKit
 * gets that wrong for bitmap copies, so the export uploads `ImageData`.
 */
export function uploadTexture(
  gl: WebGL2RenderingContext,
  bitmap: ImageBitmap | ImageData,
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
