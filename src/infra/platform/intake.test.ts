import { afterEach, describe, expect, it, vi } from 'vitest'
import { filesFromDataTransfer, installDropGuard, pickImageFile } from './index'

type FakeItem = { kind: 'file'; file: File; directory?: boolean } | { kind: 'string' }

function fakeDataTransfer(items: FakeItem[]): DataTransfer {
  return {
    items: items.map((item) =>
      item.kind === 'file'
        ? {
            kind: 'file',
            getAsFile: () => item.file,
            webkitGetAsEntry: (): { isDirectory: boolean } => ({
              isDirectory: item.directory ?? false,
            }),
          }
        : { kind: 'string', getAsFile: () => null, webkitGetAsEntry: (): null => null },
    ),
    files: items.flatMap((item) => (item.kind === 'file' ? [item.file] : [])),
  } as unknown as DataTransfer
}

const file = (name: string, type = 'image/png') => new File([new Uint8Array([1])], name, { type })

function dragEvent(type: string, dataTransfer?: DataTransfer): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer ?? null })
  return event
}

describe('filesFromDataTransfer', () => {
  it('returns the files in browser order', () => {
    const a = file('a.png')
    const b = file('b.txt', 'text/plain')
    const c = file('c.jpg', 'image/jpeg')

    expect(
      filesFromDataTransfer(
        fakeDataTransfer([
          { kind: 'file', file: a },
          { kind: 'file', file: b },
          { kind: 'file', file: c },
        ]),
      ),
    ).toEqual({ files: [a, b, c] })
  })

  it('excludes a folder', () => {
    const folder = file('holiday', '')
    expect(
      filesFromDataTransfer(fakeDataTransfer([{ kind: 'file', file: folder, directory: true }])),
    ).toEqual({ files: [] })
  })

  it('returns no files for a link dragged from another tab', () => {
    // A dragged link arrives as several string items (uri-list, plain text, html): one thing.
    const result = filesFromDataTransfer(
      fakeDataTransfer([{ kind: 'string' }, { kind: 'string' }, { kind: 'string' }]),
    )
    expect(result).toEqual({ files: [] })
  })

  it('keeps only the image when an image and a folder are dropped together', () => {
    const image = file('a.png')
    const folder = file('dir', '')
    expect(
      filesFromDataTransfer(
        fakeDataTransfer([
          { kind: 'file', file: folder, directory: true },
          { kind: 'file', file: image },
        ]),
      ),
    ).toEqual({ files: [image] })
  })

  it('falls back to dt.files when items are unavailable', () => {
    const a = file('a.png')
    const dt = { items: undefined, files: [a] } as unknown as DataTransfer
    expect(filesFromDataTransfer(dt)).toEqual({ files: [a] })
  })

  it('handles a null DataTransfer', () => {
    expect(filesFromDataTransfer(null)).toEqual({ files: [] })
  })
})

describe('installDropGuard', () => {
  let uninstall: (() => void) | undefined
  afterEach(() => uninstall?.())

  it('prevents the default on dragover and drop anywhere in the window', () => {
    uninstall = installDropGuard(window, {})
    const over = dragEvent('dragover')
    const drop = dragEvent('drop', fakeDataTransfer([]))

    document.body.dispatchEvent(over)
    document.body.dispatchEvent(drop)

    expect(over.defaultPrevented).toBe(true)
    expect(drop.defaultPrevented).toBe(true)
  })

  it('hands the DataTransfer of a drop to onDrop', () => {
    const onDrop = vi.fn()
    uninstall = installDropGuard(window, { onDrop })
    const dt = fakeDataTransfer([{ kind: 'file', file: file('a.png') }])

    document.body.dispatchEvent(dragEvent('drop', dt))

    expect(onDrop).toHaveBeenCalledWith(dt)
  })

  it('reports enter/leave once while the drag moves across child elements', () => {
    const onDragEnter = vi.fn()
    const onDragLeave = vi.fn()
    uninstall = installDropGuard(window, { onDragEnter, onDragLeave })
    const child = document.createElement('div')
    document.body.appendChild(child)

    document.body.dispatchEvent(dragEvent('dragenter'))
    child.dispatchEvent(dragEvent('dragenter'))
    document.body.dispatchEvent(dragEvent('dragleave'))
    expect(onDragEnter).toHaveBeenCalledTimes(1)
    expect(onDragLeave).not.toHaveBeenCalled()

    child.dispatchEvent(dragEvent('dragleave'))
    expect(onDragLeave).toHaveBeenCalledTimes(1)
    child.remove()
  })

  it('ends the drag state on drop', () => {
    const onDragEnter = vi.fn()
    const onDragLeave = vi.fn()
    uninstall = installDropGuard(window, { onDragEnter, onDragLeave })

    document.body.dispatchEvent(dragEvent('dragenter'))
    document.body.dispatchEvent(dragEvent('drop', fakeDataTransfer([])))
    expect(onDragLeave).toHaveBeenCalledTimes(1)

    document.body.dispatchEvent(dragEvent('dragenter'))
    expect(onDragEnter).toHaveBeenCalledTimes(2)
  })

  it('stops guarding after uninstall', () => {
    installDropGuard(window, {})()
    const over = dragEvent('dragover')
    document.body.dispatchEvent(over)
    expect(over.defaultPrevented).toBe(false)
  })
})

describe('pickImageFile', () => {
  function captureInput() {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    return () => click.mock.contexts[0] as HTMLInputElement
  }

  it('opens a single-file picker filtered to images', async () => {
    const input = captureInput()
    const picked = pickImageFile(document)
    const el = input()

    expect(el.type).toBe('file')
    expect(el.accept).toBe('image/*')
    expect(el.multiple).toBe(false)

    const chosen = file('photo.jpg', 'image/jpeg')
    Object.defineProperty(el, 'files', { value: [chosen] })
    el.dispatchEvent(new Event('change'))
    await expect(picked).resolves.toBe(chosen)
  })

  it('resolves null when the dialog is cancelled', async () => {
    const input = captureInput()
    const picked = pickImageFile(document)

    input().dispatchEvent(new Event('cancel'))
    await expect(picked).resolves.toBeNull()
  })
})
