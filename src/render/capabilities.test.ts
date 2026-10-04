import { describe, expect, it } from 'vitest'
import { probeCapabilities, type CapabilityChecks } from './capabilities'

const fakeGl = (maxTexture: number) =>
  ({
    MAX_TEXTURE_SIZE: 'MAX_TEXTURE_SIZE',
    getParameter: (p: string) => (p === 'MAX_TEXTURE_SIZE' ? maxTexture : 0),
    getExtension: () => ({ loseContext() {} }),
  }) as unknown as WebGL2RenderingContext

const checks = (over: Partial<CapabilityChecks> = {}): CapabilityChecks => ({
  webgl2: () => fakeGl(16384),
  hasCreateImageBitmap: () => true,
  workerCanvas2d: async () => true,
  ...over,
})

describe('probeCapabilities (AC-18)', () => {
  it('passes when every capability is present', async () => {
    expect(await probeCapabilities(checks())).toEqual({ ok: true, value: undefined })
  })

  it.each<[string, Partial<CapabilityChecks>]>([
    ['no WebGL2 context', { webgl2: () => null }],
    ['MAX_TEXTURE_SIZE below 4096', { webgl2: () => fakeGl(2048) }],
    ['no createImageBitmap', { hasCreateImageBitmap: () => false }],
    ['no OffscreenCanvas 2D in a worker', { workerCanvas2d: async () => false }],
  ])('refuses with UNSUPPORTED_BROWSER: %s', async (_label, over) => {
    expect(await probeCapabilities(checks(over))).toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED_BROWSER' },
    })
  })

  it('treats a throwing check as missing', async () => {
    const result = await probeCapabilities(
      checks({
        workerCanvas2d: async () => {
          throw new Error('worker blocked')
        },
      }),
    )
    expect(result.ok).toBe(false)
  })
})
