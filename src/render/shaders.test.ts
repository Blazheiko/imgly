import { describe, expect, it } from 'vitest'
import { createPreviewRenderer } from './preview-renderer'
import { createFakeCanvas, createFakeFrames, createFakeGl } from './fake-gl'
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders'

describe('shared shaders (export ADR-0002)', () => {
  it('flattens premultiplied colour onto white behind a uniform', () => {
    expect(FRAGMENT_SHADER).toContain('uniform bool u_flatten;')
    expect(FRAGMENT_SHADER).toContain('vec4(color.rgb + (1.0 - color.a), 1.0)')
  })

  it('are the sources the Preview renderer compiles', () => {
    const fake = createFakeGl()
    const canvas = createFakeCanvas(fake.gl) as unknown as HTMLCanvasElement
    expect(createPreviewRenderer(canvas, createFakeFrames()).ok).toBe(true)
    const sources = fake.calls.filter(([name]) => name === 'shaderSource').map(([, , src]) => src)
    expect(sources).toEqual([VERTEX_SHADER, FRAGMENT_SHADER])
  })
})
