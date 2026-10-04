import { describe, expect, it, vi } from 'vitest'
import { createDecoder } from './index'
import { HEIC_PROBE, ORIENTATION_PROBE, probeBlob, runProbes } from './probes'
import type { DecodeEnv } from './pipeline'

describe('probe samples', () => {
  it('embeds a JPEG tagged with EXIF orientation 6 and a HEIC, each under 2 KB', async () => {
    const jpeg = new Uint8Array(await probeBlob(ORIENTATION_PROBE).arrayBuffer())
    const heic = new Uint8Array(await probeBlob(HEIC_PROBE).arrayBuffer())
    const { sniffImageHeader } = await import('@/core')

    expect(sniffImageHeader(jpeg)).toMatchObject({
      ok: true,
      value: { format: 'jpeg', width: 2, height: 1, exifOrientation: 6 },
    })
    expect(sniffImageHeader(heic)).toMatchObject({ ok: true, value: { format: 'heic' } })
    expect(jpeg.length).toBeLessThan(2048)
    expect(heic.length).toBeLessThan(2048)
  })
})

describe('runProbes', () => {
  function env(behaviour: { jpeg: [number, number] | 'throw'; heic: 'ok' | 'throw' }): DecodeEnv {
    return {
      createCanvas: () => {
        throw new Error('unused')
      },
      createImageBitmap: vi.fn(async (blob: Blob) => {
        const outcome = blob.type === 'image/jpeg' ? behaviour.jpeg : behaviour.heic
        if (outcome === 'throw') throw new DOMException('no', 'InvalidStateError')
        const [width, height] = outcome === 'ok' ? [8, 8] : outcome
        return { width, height, close: vi.fn() } as unknown as ImageBitmap
      }),
    }
  }

  it('detects a browser that applies EXIF orientation itself (1×2 result)', async () => {
    expect(await runProbes(env({ jpeg: [1, 2], heic: 'ok' }))).toEqual({
      appliesOrientation: true,
      decodesHeic: true,
    })
  })

  it('detects a browser that leaves orientation to the worker (2×1 result)', async () => {
    expect(await runProbes(env({ jpeg: [2, 1], heic: 'throw' }))).toEqual({
      appliesOrientation: false,
      decodesHeic: false,
    })
  })

  it('treats a throwing orientation probe as "browser applies it"', async () => {
    expect((await runProbes(env({ jpeg: 'throw', heic: 'throw' }))).appliesOrientation).toBe(true)
  })
})

describe('probe-cache handoff in the client', () => {
  class FakeWorker {
    static created: FakeWorker[] = []
    posted: unknown[] = []
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    onmessageerror: ((event: MessageEvent) => void) | null = null
    constructor() {
      FakeWorker.created.push(this)
    }
    postMessage(message: unknown) {
      this.posted.push(message)
    }
    terminate() {}
  }

  const failure = { ok: false, error: { code: 'NOT_AN_IMAGE' } }
  const capabilities = { appliesOrientation: false, decodesHeic: true }

  it('lets the first worker probe, then hands its results to every later worker', async () => {
    FakeWorker.created = []
    const decode = createDecoder(() => new FakeWorker() as unknown as Worker)
    const file = new Blob()

    const first = decode(file)
    expect(FakeWorker.created[0]!.posted).toEqual([{ file }])
    FakeWorker.created[0]!.onmessage?.({ data: { ...failure, capabilities } } as MessageEvent)
    await first

    const second = decode(file)
    expect(FakeWorker.created[1]!.posted).toEqual([{ file, capabilities }])
    FakeWorker.created[1]!.onmessage?.({ data: failure } as MessageEvent)
    await second
  })

  it('ignores malformed capabilities', async () => {
    FakeWorker.created = []
    const decode = createDecoder(() => new FakeWorker() as unknown as Worker)
    const first = decode(new Blob())
    FakeWorker.created[0]!.onmessage?.({
      data: { ...failure, capabilities: { appliesOrientation: 'yes' } },
    } as MessageEvent)
    await first

    decode(new Blob())
    expect(FakeWorker.created[1]!.posted[0]).not.toHaveProperty('capabilities')
  })
})
