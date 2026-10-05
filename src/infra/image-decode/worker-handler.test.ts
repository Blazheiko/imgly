import { describe, expect, it, vi } from 'vitest'
import { ok } from '@/core'
import type { Capabilities, DecodedImage } from './types'
import { handleDecodeRequest, type WorkerDeps } from './worker-handler'

const CAPS: Capabilities = { appliesOrientation: true, decodesHeic: false }
const bitmap = { width: 1, height: 1 } as unknown as ImageBitmap
const decoded: DecodedImage = {
  bitmap,
  sourceWidth: 1,
  sourceHeight: 1,
  width: 1,
  height: 1,
  format: 'png',
  animated: false,
  downscaled: false,
}

function deps(overrides: Partial<WorkerDeps> = {}) {
  const post = vi.fn<WorkerDeps['post']>()
  return {
    post,
    deps: {
      probe: vi.fn(async () => CAPS),
      decode: vi.fn(async () => ok(decoded)),
      post,
      ...overrides,
    } satisfies WorkerDeps,
  }
}

describe('handleDecodeRequest (the worker body)', () => {
  it('probes in the first worker and posts the result with the bitmap transferred', async () => {
    const { deps: d, post } = deps()
    await handleDecodeRequest({ file: new Blob() }, d)
    expect(post).toHaveBeenCalledWith({ ok: true, value: decoded, capabilities: CAPS }, [bitmap])
  })

  it('skips the probes when the capabilities are given', async () => {
    const { deps: d, post } = deps()
    await handleDecodeRequest({ file: new Blob(), capabilities: CAPS }, d)
    expect(d.probe).not.toHaveBeenCalled()
    expect(post).toHaveBeenCalledWith({ ok: true, value: decoded }, [bitmap])
  })

  it('posts DECODE_FAILED when the decode rejects, so the client never hangs', async () => {
    const { deps: d, post } = deps({ decode: vi.fn(async () => Promise.reject(new Error('boom'))) })
    await handleDecodeRequest({ file: new Blob(), capabilities: CAPS }, d)
    expect(post).toHaveBeenCalledWith({ ok: false, error: { code: 'DECODE_FAILED' } })
  })

  it('posts DECODE_FAILED when the probes reject', async () => {
    const { deps: d, post } = deps({ probe: vi.fn(async () => Promise.reject(new Error('x'))) })
    await handleDecodeRequest({ file: new Blob() }, d)
    expect(post).toHaveBeenCalledWith({ ok: false, error: { code: 'DECODE_FAILED' } })
  })
})
