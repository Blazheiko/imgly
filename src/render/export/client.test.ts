import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHECK_TIMEOUT_MS, createExportClient, EXPORT_TIMEOUT_MS } from './client'
import type { ExportRequest } from './worker-handler'

class FakeWorker {
  static created: FakeWorker[] = []
  static throwOnPost = false
  posted: { message: unknown; transfer?: Transferable[] }[] = []
  terminated = 0
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  constructor() {
    FakeWorker.created.push(this)
  }
  postMessage(message: unknown, transfer?: Transferable[]) {
    if (FakeWorker.throwOnPost) throw new DOMException('clone', 'DataCloneError')
    this.posted.push({ message, transfer })
  }
  terminate() {
    this.terminated++
  }
  reply(data: unknown) {
    this.onmessage?.({ data } as MessageEvent)
  }
  crash() {
    this.onerror?.(new Event('error'))
  }
}

function setup() {
  FakeWorker.created = []
  FakeWorker.throwOnPost = false
  const client = createExportClient(() => new FakeWorker() as unknown as Worker)
  return { client, workers: FakeWorker.created }
}

const request = (): ExportRequest => ({
  bitmap: { width: 4096, height: 3072, close: vi.fn() } as unknown as ImageBitmap,
  width: 4096,
  height: 3072,
  format: 'jpeg',
  quality: 90,
})

describe('exportImage (export client)', () => {
  it('transfers the bitmap to a fresh worker and returns its verified Blob', async () => {
    const { client, workers } = setup()
    const req = request()
    const pending = client.exportImage(req)

    expect(workers).toHaveLength(1)
    expect(workers[0]!.posted).toEqual([
      { message: { kind: 'export', request: req }, transfer: [req.bitmap] },
    ])
    const blob = new Blob([new Uint8Array([1])], { type: 'image/jpeg' })
    workers[0]!.reply({ ok: true, value: blob })

    await expect(pending).resolves.toEqual({ ok: true, value: blob })
    expect(workers[0]!.terminated).toBe(1)
  })

  it('re-hydrates a worker error with its details', async () => {
    const { client, workers } = setup()
    const pending = client.exportImage(request())
    workers[0]!.reply({
      ok: false,
      error: { code: 'EXPORT_FORMAT_MISMATCH', details: { asked: 'webp', produced: 'png' } },
    })
    await expect(pending).resolves.toEqual({
      ok: false,
      error: { code: 'EXPORT_FORMAT_MISMATCH', details: { asked: 'webp', produced: 'png' } },
    })
    expect(workers[0]!.terminated).toBe(1)
  })

  it.each([
    ['an unknown error code', { ok: false, error: { code: 'NOPE' } }],
    ['a success without a Blob', { ok: true, value: 'not a blob' }],
    ['garbage', 42],
  ])('maps %s to EXPORT_FAILED', async (_label, data) => {
    const { client, workers } = setup()
    const pending = client.exportImage(request())
    workers[0]!.reply(data)
    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'EXPORT_FAILED' } })
    expect(workers[0]!.terminated).toBe(1)
  })

  it('maps a worker crash to EXPORT_FAILED and terminates it', async () => {
    const { client, workers } = setup()
    const pending = client.exportImage(request())
    workers[0]!.crash()
    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'EXPORT_FAILED' } })
    expect(workers[0]!.terminated).toBe(1)
  })

  it('maps a message error to EXPORT_FAILED', async () => {
    const { client, workers } = setup()
    const pending = client.exportImage(request())
    workers[0]!.onmessageerror?.({} as MessageEvent)
    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'EXPORT_FAILED' } })
    expect(workers[0]!.terminated).toBe(1)
  })

  it('closes the bitmap itself when it could not be handed to the worker', async () => {
    const { client, workers } = setup()
    FakeWorker.throwOnPost = true
    const req = request()
    await expect(client.exportImage(req)).resolves.toEqual({
      ok: false,
      error: { code: 'EXPORT_FAILED' },
    })
    expect(req.bitmap.close).toHaveBeenCalledTimes(1)
    expect(workers[0]!.terminated).toBe(1)
  })

  it('reports EXPORT_FAILED and closes the bitmap when no worker can start', async () => {
    const client = createExportClient(() => {
      throw new Error('no workers')
    })
    const req = request()
    await expect(client.exportImage(req)).resolves.toEqual({
      ok: false,
      error: { code: 'EXPORT_FAILED' },
    })
    expect(req.bitmap.close).toHaveBeenCalledTimes(1)
  })
})

describe('checkExportFormats (AC-12)', () => {
  it('asks its own worker to check and keeps PNG always available', async () => {
    const { client, workers } = setup()
    const pending = client.checkExportFormats()
    expect(workers[0]!.posted).toEqual([{ message: { kind: 'check' }, transfer: undefined }])
    workers[0]!.reply({ jpeg: true, webp: false })

    await expect(pending).resolves.toEqual({ png: true, jpeg: true, webp: false })
    expect(workers[0]!.terminated).toBe(1)
  })

  it('counts anything but a true answer as unavailable', async () => {
    const { client, workers } = setup()
    const pending = client.checkExportFormats()
    workers[0]!.reply({ jpeg: 'yes' })
    await expect(pending).resolves.toEqual({ png: true, jpeg: false, webp: false })
  })

  it('never rejects: a crashed check makes both formats unavailable', async () => {
    const { client, workers } = setup()
    const pending = client.checkExportFormats()
    workers[0]!.crash()
    await expect(pending).resolves.toEqual({ png: true, jpeg: false, webp: false })
    expect(workers[0]!.terminated).toBe(1)
  })

  it('never rejects when no worker can start', async () => {
    const client = createExportClient(() => {
      throw new Error('no workers')
    })
    await expect(client.checkExportFormats()).resolves.toEqual({
      png: true,
      jpeg: false,
      webp: false,
    })
  })

  it('spawns and terminates a separate worker per call', async () => {
    const { client, workers } = setup()
    const a = client.checkExportFormats()
    const b = client.checkExportFormats()
    expect(workers).toHaveLength(2)
    workers[0]!.reply({ jpeg: true, webp: true })
    workers[1]!.reply({ jpeg: true, webp: true })
    await Promise.all([a, b])
    expect(workers.map((w) => w.terminated)).toEqual([1, 1])
  })
})

describe('a worker that never answers (AC-11, AC-13)', () => {
  afterEach(() => vi.useRealTimers())

  it('fails the export with EXPORT_FAILED after the export timeout and terminates the worker', async () => {
    vi.useFakeTimers()
    const { client, workers } = setup()
    let settled = false
    const pending = client.exportImage(request()).finally(() => (settled = true))

    await vi.advanceTimersByTimeAsync(EXPORT_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'EXPORT_FAILED' } })
    expect(workers[0]!.terminated).toBe(1)

    workers[0]!.reply({ ok: true, value: new Blob() }) // a late reply changes nothing
    expect(workers[0]!.terminated).toBe(1)
  })

  it('counts a silent format check as both lossy formats unavailable', async () => {
    vi.useFakeTimers()
    const { client, workers } = setup()
    const pending = client.checkExportFormats()
    await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS)
    await expect(pending).resolves.toEqual({ png: true, jpeg: false, webp: false })
    expect(workers[0]!.terminated).toBe(1)
  })

  it('clears the timer when the worker answers in time', async () => {
    vi.useFakeTimers()
    const { client, workers } = setup()
    const pending = client.checkExportFormats()
    workers[0]!.reply({ jpeg: true, webp: true })
    await expect(pending).resolves.toEqual({ png: true, jpeg: true, webp: true })
    expect(vi.getTimerCount()).toBe(0)
  })
})
