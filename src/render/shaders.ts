import { toUniforms, type Adjustments } from '@/core'

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
 * With `u_adjust` the seven colour steps of adjust ADR-0003 run first, on the unpremultiplied
 * stored values in their fixed order with a clamp after each; alpha is never written (AC-06).
 * `adjust()` mirrors `applyAdjustmentsToPixel` in `src/core/adjust/formula.ts` step for step, and
 * each step is skipped at its neutral value so that value is an exact identity.
 * With `u_draw` the Drawing layer (premultiplied, unit 1) is composited "over" after the
 * Adjustments and before the flatten, so it is never adjusted (draw ADR-0003).
 */
export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform sampler2D u_layer;
uniform bool u_draw;
uniform bool u_flatten;
uniform bool u_adjust;
uniform float u_exponent;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_temperature;
uniform float u_tint;
uniform float u_grayscale;
uniform float u_sepia;
in vec2 v_uv;
out vec4 outColor;
const float PIVOT = 128.0 / 255.0;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
// The CSS sepia() matrix, column by column.
const mat3 SEPIA = mat3(0.393, 0.349, 0.272, 0.769, 0.686, 0.534, 0.189, 0.168, 0.131);
vec3 adjust(vec3 c) {
  if (u_exponent != 1.0) c = clamp(pow(c, vec3(u_exponent)), 0.0, 1.0);
  if (u_contrast != 1.0) c = clamp(PIVOT + (c - PIVOT) * u_contrast, 0.0, 1.0);
  if (u_saturation != 1.0) {
    vec3 l = vec3(dot(c, LUMA));
    c = clamp(l + (c - l) * u_saturation, 0.0, 1.0);
  }
  if (u_temperature != 0.0) {
    c = clamp(c * vec3(1.0 + u_temperature, 1.0, 1.0 - u_temperature), 0.0, 1.0);
  }
  if (u_tint != 0.0) c = clamp(c * vec3(1.0, 1.0 - u_tint, 1.0), 0.0, 1.0);
  if (u_grayscale != 0.0) c = clamp(mix(c, vec3(dot(c, LUMA)), u_grayscale), 0.0, 1.0);
  if (u_sepia != 0.0) c = clamp(mix(c, clamp(SEPIA * c, 0.0, 1.0), u_sepia), 0.0, 1.0);
  return c;
}
void main() {
  if (any(lessThan(v_uv, vec2(0.0))) || any(greaterThan(v_uv, vec2(1.0)))) {
    outColor = vec4(0.0);
    return;
  }
  vec4 color = texture(u_image, v_uv);
  if (u_adjust) {
    color = color.a > 0.0 ? vec4(adjust(color.rgb / color.a) * color.a, color.a) : vec4(0.0);
  }
  if (u_draw) {
    vec4 m = texture(u_layer, v_uv);
    color = m + (1.0 - m.a) * color;
  }
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
  /** Whether the Drawing layer on unit 1 is composited (draw ADR-0003). */
  draw: WebGLUniformLocation | null
  /** The colour block's switch and its seven step uniforms (adjust ADR-0002). */
  adjust: AdjustLocations
}

export interface AdjustLocations {
  enabled: WebGLUniformLocation | null
  exponent: WebGLUniformLocation | null
  contrast: WebGLUniformLocation | null
  saturation: WebGLUniformLocation | null
  temperature: WebGLUniformLocation | null
  tint: WebGLUniformLocation | null
  grayscale: WebGLUniformLocation | null
  sepia: WebGLUniformLocation | null
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
  gl.uniform1i(gl.getUniformLocation(program, 'u_layer'), 1)
  const draw = gl.getUniformLocation(program, 'u_draw')
  gl.uniform1i(draw, 0)
  const geometry = gl.getUniformLocation(program, 'u_geometry')
  gl.uniformMatrix3fv(geometry, false, IDENTITY_GEOMETRY)
  return {
    program,
    vao,
    buffer,
    transform: gl.getUniformLocation(program, 'u_transform'),
    geometry,
    flatten: gl.getUniformLocation(program, 'u_flatten'),
    draw,
    adjust: {
      enabled: gl.getUniformLocation(program, 'u_adjust'),
      exponent: gl.getUniformLocation(program, 'u_exponent'),
      contrast: gl.getUniformLocation(program, 'u_contrast'),
      saturation: gl.getUniformLocation(program, 'u_saturation'),
      temperature: gl.getUniformLocation(program, 'u_temperature'),
      tint: gl.getUniformLocation(program, 'u_tint'),
      grayscale: gl.getUniformLocation(program, 'u_grayscale'),
      sepia: gl.getUniformLocation(program, 'u_sepia'),
    },
  }
}

/**
 * Sets the colour block's uniforms from the Adjustments, the one way the Preview, the export worker
 * and the test hooks do it. Neutral values turn the block off (`u_adjust` false).
 */
export function setAdjustmentUniforms(gl: WebGL2RenderingContext, gpu: GpuProgram, a: Adjustments) {
  const u = toUniforms(a)
  const loc = gpu.adjust
  gl.uniform1i(loc.enabled, u.enabled ? 1 : 0)
  gl.uniform1f(loc.exponent, u.exponent)
  gl.uniform1f(loc.contrast, u.contrast)
  gl.uniform1f(loc.saturation, u.saturation)
  gl.uniform1f(loc.temperature, u.temperature)
  gl.uniform1f(loc.tint, u.tint)
  gl.uniform1f(loc.grayscale, u.grayscale)
  gl.uniform1f(loc.sepia, u.sepia)
}

/** Turns the Drawing layer composite on or off; off whenever the layer is null (draw ADR-0003). */
export function setLayerUniforms(gl: WebGL2RenderingContext, gpu: GpuProgram, on: boolean) {
  gl.uniform1i(gpu.draw, on ? 1 : 0)
}

/**
 * A zero-filled texture of the given size with the same parameters as `uploadTexture`: a blank
 * Drawing layer, allocated without reading back or uploading its pixels.
 */
export function allocateBlankTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): WebGLTexture | null {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return texture
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
