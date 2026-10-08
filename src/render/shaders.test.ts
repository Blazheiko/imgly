import { describe, expect, it } from 'vitest'
import { createPreviewRenderer } from './preview-renderer'
import { createFakeCanvas, createFakeFrames, createFakeGl } from './fake-gl'
import { NEUTRAL_ADJUSTMENTS, toUniforms } from '@/core'
import { buildProgram, FRAGMENT_SHADER, setAdjustmentUniforms, VERTEX_SHADER } from './shaders'

describe('shared shaders (export ADR-0002)', () => {
  it('flattens premultiplied colour onto white behind a uniform', () => {
    expect(FRAGMENT_SHADER).toContain('uniform bool u_flatten;')
    expect(FRAGMENT_SHADER).toContain('vec4(color.rgb + (1.0 - color.a), 1.0)')
  })

  it('maps the unit quad through u_geometry to the Original (crop-rotate ADR-0002)', () => {
    expect(VERTEX_SHADER).toContain('uniform mat3 u_geometry;')
    expect(VERTEX_SHADER).toContain('v_uv = (u_geometry * vec3(a_position, 1.0)).xy;')
  })

  it('outputs transparent outside the Original', () => {
    expect(FRAGMENT_SHADER).toContain(
      'if (any(lessThan(v_uv, vec2(0.0))) || any(greaterThan(v_uv, vec2(1.0)))) {',
    )
    expect(FRAGMENT_SHADER).toContain('outColor = vec4(0.0);')
  })

  it('starts u_geometry at the identity, so a caller that never sets it renders as before', () => {
    const fake = createFakeGl()
    const canvas = createFakeCanvas(fake.gl) as unknown as HTMLCanvasElement
    createPreviewRenderer(canvas, createFakeFrames())
    const set = fake.calls.find(
      ([name, loc]) =>
        name === 'uniformMatrix3fv' && (loc as { uniform: string }).uniform === 'u_geometry',
    )
    expect(set?.[3]).toEqual(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]))
  })

  it('are the sources the Preview renderer compiles', () => {
    const fake = createFakeGl()
    const canvas = createFakeCanvas(fake.gl) as unknown as HTMLCanvasElement
    expect(createPreviewRenderer(canvas, createFakeFrames()).ok).toBe(true)
    const sources = fake.calls.filter(([name]) => name === 'shaderSource').map(([, , src]) => src)
    expect(sources).toEqual([VERTEX_SHADER, FRAGMENT_SHADER])
  })
})

describe('the colour block (adjust ADR-0002)', () => {
  const ADJUST_UNIFORMS = [
    'u_exponent',
    'u_contrast',
    'u_saturation',
    'u_temperature',
    'u_tint',
    'u_grayscale',
    'u_sepia',
  ]

  it('declares u_adjust and the seven step uniforms', () => {
    expect(FRAGMENT_SHADER).toContain('uniform bool u_adjust;')
    for (const name of ADJUST_UNIFORMS) expect(FRAGMENT_SHADER).toContain(`uniform float ${name};`)
  })

  it('runs the seven steps in the fixed order, after sampling and before the flatten', () => {
    const at = (needle: string) => {
      const i = FRAGMENT_SHADER.indexOf(needle)
      expect(i, needle).toBeGreaterThan(-1)
      return i
    }
    const steps = [
      'pow(c, vec3(u_exponent))',
      'PIVOT + (c - PIVOT) * u_contrast',
      'l + (c - l) * u_saturation',
      '1.0 + u_temperature',
      '1.0 - u_tint',
      'mix(c, vec3(dot(c, LUMA)), u_grayscale)',
      'mix(c, clamp(SEPIA * c, 0.0, 1.0), u_sepia)',
    ].map(at)
    expect([...steps].sort((a, b) => a - b)).toEqual(steps)
    expect(at('texture(u_image, v_uv)')).toBeLessThan(at('if (u_adjust)'))
    expect(at('if (u_adjust)')).toBeLessThan(at('u_flatten ?'))
  })

  it('unpremultiplies before the steps, keeps alpha, and leaves alpha 0 transparent (AC-06)', () => {
    expect(FRAGMENT_SHADER).toContain(
      'color = color.a > 0.0 ? vec4(adjust(color.rgb / color.a) * color.a, color.a) : vec4(0.0);',
    )
  })

  it('sets u_adjust and the pre-scaled values from toUniforms', () => {
    const fake = createFakeGl()
    const gpu = buildProgram(fake.gl)
    fake.calls.length = 0
    const a = { ...NEUTRAL_ADJUSTMENTS, brightness: 100, tint: -50, sepia: 25 }
    setAdjustmentUniforms(fake.gl, gpu, a)
    const set = Object.fromEntries(
      fake.calls.map(([, loc, value]) => [(loc as { uniform: string }).uniform, value]),
    )
    const u = toUniforms(a)
    expect(set).toEqual({
      u_adjust: 1,
      u_exponent: u.exponent,
      u_contrast: u.contrast,
      u_saturation: u.saturation,
      u_temperature: u.temperature,
      u_tint: u.tint,
      u_grayscale: u.grayscale,
      u_sepia: u.sepia,
    })
  })

  it('sets u_adjust false for neutral values, the exact bypass (QG-1b)', () => {
    const fake = createFakeGl()
    const gpu = buildProgram(fake.gl)
    fake.calls.length = 0
    setAdjustmentUniforms(fake.gl, gpu, NEUTRAL_ADJUSTMENTS)
    expect(fake.calls).toContainEqual(['uniform1i', { uniform: 'u_adjust' }, 0])
  })
})
