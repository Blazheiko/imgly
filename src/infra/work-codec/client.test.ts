import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorkCodec } from './index'

class FakeWorker {
  static created: FakeWorker[] = []
  posted: { message: unknown; transfer: unknown }[] = []
  terminated = false
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  constructor() {
    FakeWorker.created.push(this)
  }
  postMessage(message: unknown, transfer?: unknown) {
    this.posted.push({ message, transfer })
  }
  terminate() {
    this.terminated = true
  }
  reply(data: unknown) {
    this.onmessage?.({ data } as MessageEvent)
  }
}

function setup() {
  FakeWorker.created = []
  const codec = createWorkCodec(() => new FakeWorker() as unknown as Worker)
  return { codec, workers: FakeWorker.created }
}

const bitmap = { width: 2, height: 2, close() {} } as unknown as ImageBitmap
const expected = { width: 2, height: 2 }

afterEach(() => vi.useRealTimers())

describe('encodePng client (AC-04)', () => {
  it('posts the bitmap to a fresh worker, transferred, and resolves with the PNG Blob', async () => {
    const { codec, workers } = setup()
    const pending = codec.encodePng(bitmap)

    expect(workers).toHaveLength(1)
    expect(workers[0]!.posted[0]).toEqual({
      message: { kind: 'encode', bitmap },
      transfer: [bitmap],
    })
    const png = new Blob([new Uint8Array([1])], { type: 'image/png' })
    workers[0]!.reply({ ok: true, value: png })

    await expect(pending).resolves.toEqual({ ok: true, value: png })
    expect(workers[0]!.terminated).toBe(true)
  })

  it('uses a fresh worker for every job', async () => {
    const { codec, workers } = setup()
    const first = codec.encodePng(bitmap)
    workers[0]!.reply({ ok: true, value: new Blob() })
    await first
    const second = codec.encodePng(bitmap)
    workers[1]!.reply({ ok: true, value: new Blob() })
    await second

    expect(workers).toHaveLength(2)
    expect(workers.every((w) => w.terminated)).toBe(true)
  })

  it('returns STORAGE_FAILED and terminates when the worker errors', async () => {
    const { codec, workers } = setup()
    const pending = codec.encodePng(bitmap)
    workers[0]!.onerror?.(new ErrorEvent('error', { message: 'boom' }))

    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'STORAGE_FAILED' } })
    expect(workers[0]!.terminated).toBe(true)
  })

  it('returns STORAGE_FAILED for a malformed reply', async () => {
    const { codec, workers } = setup()
    const pending = codec.encodePng(bitmap)
    workers[0]!.reply({ ok: true, value: 'not a blob' })

    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'STORAGE_FAILED' } })
    expect(workers[0]!.terminated).toBe(true)
  })

  it('returns STORAGE_FAILED and terminates when the worker never answers', async () => {
    vi.useFakeTimers()
    const { codec, workers } = setup()
    const pending = codec.encodePng(bitmap)
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'STORAGE_FAILED' } })
    expect(workers[0]!.terminated).toBe(true)
  })

  it('returns STORAGE_FAILED when the worker cannot be created or posting throws', async () => {
    const blocked = createWorkCodec(() => {
      throw new Error('blocked')
    })
    await expect(blocked.encodePng(bitmap)).resolves.toEqual({
      ok: false,
      error: { code: 'STORAGE_FAILED' },
    })

    FakeWorker.created = []
    const codec = createWorkCodec(() => {
      const worker = new FakeWorker()
      worker.postMessage = () => {
        throw new DOMException('no', 'DataCloneError')
      }
      return worker as unknown as Worker
    })
    await expect(codec.encodePng(bitmap)).resolves.toEqual({
      ok: false,
      error: { code: 'STORAGE_FAILED' },
    })
    expect(FakeWorker.created[0]!.terminated).toBe(true)
  })
})

describe('decodePng client (AC-04, AC-08)', () => {
  it('posts blob and expected size to a fresh worker and resolves with the bitmap', async () => {
    const { codec, workers } = setup()
    const blob = new Blob([new Uint8Array([1])])
    const pending = codec.decodePng(blob, expected)

    expect(workers[0]!.posted[0]!.message).toEqual({ kind: 'decode', blob, expected })
    workers[0]!.reply({ ok: true, value: bitmap })

    await expect(pending).resolves.toEqual({ ok: true, value: bitmap })
    expect(workers[0]!.terminated).toBe(true)
  })

  it('passes a WORK_DAMAGED reply through and terminates the worker', async () => {
    const { codec, workers } = setup()
    const pending = codec.decodePng(new Blob(), expected)
    workers[0]!.reply({ ok: false, error: { code: 'WORK_DAMAGED' } })

    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'WORK_DAMAGED' } })
    expect(workers[0]!.terminated).toBe(true)
  })

  it('returns WORK_DAMAGED when the decode worker errors, and terminates it', async () => {
    const { codec, workers } = setup()
    const pending = codec.decodePng(new Blob(), expected)
    workers[0]!.onerror?.(new ErrorEvent('error', { message: 'boom' }))

    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'WORK_DAMAGED' } })
    expect(workers[0]!.terminated).toBe(true)
  })

  it('terminates the worker on timeout and settles with an error', async () => {
    vi.useFakeTimers()
    const { codec, workers } = setup()
    const pending = codec.decodePng(new Blob(), expected)
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect((await pending).ok).toBe(false)
    expect(workers[0]!.terminated).toBe(true)
  })
})
