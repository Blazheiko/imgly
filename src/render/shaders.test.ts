import { describe, expect, it } from 'vitest'
import { createPreviewRenderer } from './preview-renderer'
import { createFakeCanvas, createFakeFrames, createFakeGl } from './fake-gl'
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders'

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
