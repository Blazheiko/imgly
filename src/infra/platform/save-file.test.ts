import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  discardEmptyTarget,
  downloadFile,
  DOWNLOAD_URL_LIFETIME_MS,
  hasSaveDialog,
  pickSaveTarget,
  writeFile,
  type SaveFileHandle,
} from './save-file'

type PickerWindow = { showSaveFilePicker?: (options: unknown) => Promise<unknown> }
const win = window as unknown as PickerWindow

function fakeHandle(
  name = 'photo-edited.jpg',
  opts: { remove?: 'ok' | 'reject' | 'missing' } = {},
) {
  const writable = {
    write: vi.fn<(blob: Blob) => Promise<void>>(async () => {}),
    close: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
  }
  const handle = {
    name,
    createWritable: vi.fn(async () => writable),
    ...(opts.remove === 'missing'
      ? {}
      : {
          remove: vi.fn(async () => {
            if (opts.remove === 'reject') throw new DOMException('gone', 'NotFoundError')
          }),
        }),
  }
  return { handle: handle as unknown as SaveFileHandle & typeof handle, writable }
}

afterEach(() => {
  delete win.showSaveFilePicker
})

describe('hasSaveDialog', () => {
  it('detects the "Save as…" dialog by feature', () => {
    expect(hasSaveDialog()).toBe(false)
    win.showSaveFilePicker = async () => ({})
    expect(hasSaveDialog()).toBe(true)
  })
})

describe('pickSaveTarget (AC-01b, AC-10)', () => {
  it.each([
    ['jpeg', { 'image/jpeg': ['.jpg', '.jpeg', '.jpe', '.jfif'] }],
    ['png', { 'image/png': ['.png'] }],
    ['webp', { 'image/webp': ['.webp'] }],
  ] as const)('offers only %s and no "all files" choice', async (format, accept) => {
    const picker = vi.fn(async () => fakeHandle().handle)
    win.showSaveFilePicker = picker
    await pickSaveTarget('photo-edited.x', format)

    expect(picker).toHaveBeenCalledWith({
      suggestedName: 'photo-edited.x',
      types: [{ description: expect.any(String), accept }],
      excludeAcceptAllOption: true,
    })
  })

  it('resolves picked with the handle and the name the dialog returned', async () => {
    const { handle } = fakeHandle('mine.JPG')
    win.showSaveFilePicker = async () => handle
    expect(await pickSaveTarget('photo-edited.jpg', 'jpeg')).toEqual({
      ok: true,
      value: { kind: 'picked', handle, name: 'mine.JPG' },
    })
  })

  it('resolves cancelled when the Editor cancels the dialog', async () => {
    win.showSaveFilePicker = async () => {
      throw new DOMException('cancel', 'AbortError')
    }
    expect(await pickSaveTarget('a.png', 'png')).toEqual({ ok: true, value: { kind: 'cancelled' } })
  })

  it('resolves activationLapsed when the user activation has expired', async () => {
    win.showSaveFilePicker = async () => {
      throw new DOMException('activation', 'SecurityError')
    }
    expect(await pickSaveTarget('a.png', 'png')).toEqual({
      ok: true,
      value: { kind: 'activationLapsed' },
    })
  })

  it('reports anything else as EXPORT_FAILED', async () => {
    win.showSaveFilePicker = async () => {
      throw new TypeError('weird')
    }
    expect(await pickSaveTarget('a.png', 'png')).toEqual({
      ok: false,
      error: { code: 'EXPORT_FAILED' },
    })
  })

  it('reports EXPORT_FAILED where there is no dialog', async () => {
    expect(await pickSaveTarget('a.png', 'png')).toEqual({
      ok: false,
      error: { code: 'EXPORT_FAILED' },
    })
  })
})

describe('writeFile (AC-01, AC-14)', () => {
  it('writes the blob and closes the writable, which replaces the target', async () => {
    const { handle, writable } = fakeHandle()
    const blob = new Blob([new Uint8Array([1, 2, 3])])
    expect(await writeFile(handle, blob)).toEqual({ ok: true, value: undefined })
    expect(writable.write).toHaveBeenCalledWith(blob)
    expect(writable.close).toHaveBeenCalledTimes(1)
    expect(writable.abort).not.toHaveBeenCalled()
  })

  it.each(['NotAllowedError', 'SecurityError', 'NoModificationAllowedError'])(
    'maps a %s on write to EXPORT_NOT_PERMITTED and aborts',
    async (name) => {
      const { handle, writable } = fakeHandle()
      writable.write.mockRejectedValueOnce(new DOMException('no', name))
      expect(await writeFile(handle, new Blob())).toEqual({
        ok: false,
        error: { code: 'EXPORT_NOT_PERMITTED' },
      })
      expect(writable.abort).toHaveBeenCalledTimes(1)
      expect(writable.close).not.toHaveBeenCalled()
    },
  )

  it('maps a refused createWritable to EXPORT_NOT_PERMITTED', async () => {
    const { handle } = fakeHandle()
    handle.createWritable.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'))
    expect(await writeFile(handle, new Blob())).toEqual({
      ok: false,
      error: { code: 'EXPORT_NOT_PERMITTED' },
    })
  })

  it('maps any other write failure to EXPORT_FAILED and aborts', async () => {
    const { handle, writable } = fakeHandle()
    writable.close.mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'))
    expect(await writeFile(handle, new Blob())).toEqual({
      ok: false,
      error: { code: 'EXPORT_FAILED' },
    })
    expect(writable.abort).toHaveBeenCalledTimes(1)
  })

  it('never throws when the abort itself fails', async () => {
    const { handle, writable } = fakeHandle()
    writable.write.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'))
    writable.abort.mockRejectedValueOnce(new Error('already closed'))
    expect((await writeFile(handle, new Blob())).ok).toBe(false)
  })
})

describe('discardEmptyTarget (AC-13)', () => {
  it('removes the file where the browser allows it', async () => {
    const { handle } = fakeHandle()
    expect(await discardEmptyTarget(handle)).toBe(true)
    expect(handle.remove).toHaveBeenCalledTimes(1)
  })

  it('returns false where remove() is missing', async () => {
    const { handle } = fakeHandle('a.png', { remove: 'missing' })
    expect(await discardEmptyTarget(handle)).toBe(false)
  })

  it('returns false and never throws when remove() rejects', async () => {
    const { handle } = fakeHandle('a.png', { remove: 'reject' })
    expect(await discardEmptyTarget(handle)).toBe(false)
  })
})

describe('downloadFile (AC-02)', () => {
  let created: string[]
  let revoked: string[]

  beforeEach(() => {
    vi.useFakeTimers()
    created = []
    revoked = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:test/${created.length}`
      created.push(url)
      return url
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => void revoked.push(url))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('clicks a download link named after the file and leaves no element behind', () => {
    const clicks: { download: string; href: string; connected: boolean }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push({ download: this.download, href: this.href, connected: this.isConnected })
    })

    downloadFile('IMG_4021-edited.jpg', new Blob([new Uint8Array([1])]))

    expect(clicks).toEqual([
      { download: 'IMG_4021-edited.jpg', href: 'blob:test/0', connected: true },
    ])
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('revokes the object URL 60 s after the click, not before', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadFile('a.png', new Blob())

    expect(DOWNLOAD_URL_LIFETIME_MS).toBe(60_000)
    vi.advanceTimersByTime(59_999)
    expect(revoked).toEqual([])
    vi.advanceTimersByTime(1)
    expect(revoked).toEqual(['blob:test/0'])
  })
})
