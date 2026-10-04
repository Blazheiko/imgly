import { describe, expect, it } from 'vitest'
import { createDecoder, isSuperseded, mapReadError, parseWorkerResponse } from './index'

class FakeWorker {
  static created: FakeWorker[] = []
  posted: unknown[] = []
  terminated = false
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  constructor() {
    FakeWorker.created.push(this)
  }
  postMessage(message: unknown) {
    this.posted.push(message)
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
  const decode = createDecoder(() => new FakeWorker() as unknown as Worker)
  return { decode, workers: FakeWorker.created }
}

const bitmap = { width: 4096, height: 2731, close() {} } as unknown as ImageBitmap
const decoded = {
  bitmap,
  sourceWidth: 6000,
  sourceHeight: 4000,
  width: 4096,
  height: 2731,
  format: 'jpeg',
  animated: false,
  downscaled: true,
}

describe('decodeImage client', () => {
  it('posts the file to a fresh worker and resolves with its result', async () => {
    const { decode, workers } = setup()
    const file = new Blob([new Uint8Array([1])])
    const pending = decode(file)

    expect(workers).toHaveLength(1)
    expect(workers[0]!.posted).toEqual([{ file }])
    workers[0]!.reply({ ok: true, value: decoded })

    await expect(pending).resolves.toEqual({ ok: true, value: decoded })
  })

  it('terminates the worker once the result arrives', async () => {
    const { decode, workers } = setup()
    const pending = decode(new Blob())
    workers[0]!.reply({ ok: true, value: decoded })
    await pending

    expect(workers[0]!.terminated).toBe(true)
  })

  it('terminates a superseded worker at once and resolves it as Superseded (AC-16b)', async () => {
    const { decode, workers } = setup()
    const first = decode(new Blob())
    const second = decode(new Blob())

    expect(workers[0]!.terminated).toBe(true)
    expect(isSuperseded(await first)).toBe(true)

    workers[1]!.reply({ ok: false, error: { code: 'TOO_LARGE', details: { megapixels: 120 } } })
    await expect(second).resolves.toEqual({
      ok: false,
      error: { code: 'TOO_LARGE', details: { megapixels: 120 } },
    })
  })

  it('ignores a late message from a superseded worker', async () => {
    const { decode, workers } = setup()
    const first = decode(new Blob())
    decode(new Blob())
    workers[0]!.reply({ ok: true, value: decoded })

    expect(isSuperseded(await first)).toBe(true)
  })

  it('passes typed {code, details} errors through unchanged', async () => {
    const { decode, workers } = setup()
    const pending = decode(new Blob())
    workers[0]!.reply({
      ok: false,
      error: { code: 'UNSUPPORTED_FORMAT', details: { format: 'PSD' } },
    })

    await expect(pending).resolves.toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED_FORMAT', details: { format: 'PSD' } },
    })
  })

  it('resolves DECODE_FAILED when the worker cannot be created', async () => {
    const decode = createDecoder(() => {
      throw new Error('worker blocked')
    })
    await expect(decode(new Blob())).resolves.toEqual({
      ok: false,
      error: { code: 'DECODE_FAILED' },
    })
  })

  it('resolves DECODE_FAILED and terminates the worker when posting the request throws', async () => {
    FakeWorker.created = []
    const decode = createDecoder(() => {
      const worker = new FakeWorker()
      worker.postMessage = () => {
        throw new DOMException('no', 'DataCloneError')
      }
      return worker as unknown as Worker
    })
    await expect(decode(new Blob())).resolves.toEqual({
      ok: false,
      error: { code: 'DECODE_FAILED' },
    })
    expect(FakeWorker.created[0]!.terminated).toBe(true)
  })

  it('maps a worker error event to DECODE_FAILED without raw error text', async () => {
    const { decode, workers } = setup()
    const pending = decode(new Blob())
    workers[0]!.onerror?.(new ErrorEvent('error', { message: 'secret path /Users/x/a.jpg' }))

    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'DECODE_FAILED' } })
    expect(workers[0]!.terminated).toBe(true)
  })
})

describe('mapReadError (AC-10)', () => {
  it.each(['NotReadableError', 'NotFoundError', 'SecurityError'])(
    '%s → FILE_NOT_PERMITTED',
    (n) => {
      expect(mapReadError(n)).toBe('FILE_NOT_PERMITTED')
    },
  )

  it.each(['InvalidStateError', 'EncodingError', 'TypeError', ''])('%s → DECODE_FAILED', (n) => {
    expect(mapReadError(n)).toBe('DECODE_FAILED')
  })
})

describe('parseWorkerResponse', () => {
  it('accepts a well-formed success and failure', () => {
    expect(parseWorkerResponse({ ok: true, value: decoded })).toEqual({ ok: true, value: decoded })
    expect(parseWorkerResponse({ ok: false, error: { code: 'UNREADABLE' } })).toEqual({
      ok: false,
      error: { code: 'UNREADABLE' },
    })
  })

  it.each([
    null,
    'text',
    { ok: true },
    { ok: true, value: { ...decoded, width: 'wide' } },
    { ok: false, error: { code: 'NOT_A_CODE' } },
    { ok: false, error: 'boom' },
  ])('turns a malformed message %# into DECODE_FAILED', (data) => {
    expect(parseWorkerResponse(data)).toEqual({ ok: false, error: { code: 'DECODE_FAILED' } })
  })
})
