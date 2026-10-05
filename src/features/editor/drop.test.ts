import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { appError, err, ok, type AppError, type AppErrorCode } from '@/core'
import type { DecodedImage, DecodeOutcome } from '@/infra/image-decode'
import { useNotices } from '@/shared'
import { useEditorStore } from './store'

const bitmap = () => ({ width: 1, height: 1, close: vi.fn() }) as unknown as ImageBitmap

function image(extra: Partial<DecodedImage> = {}): DecodedImage {
  return {
    bitmap: bitmap(),
    sourceWidth: 800,
    sourceHeight: 600,
    width: 800,
    height: 600,
    format: 'png',
    animated: false,
    downscaled: false,
    ...extra,
  }
}

/** A decoder answering by file name: an AppErrorCode refuses, anything else opens. */
function decoderByName(answers: Record<string, AppErrorCode | DecodedImage>) {
  return vi.fn(async (file: Blob): Promise<DecodeOutcome> => {
    const answer = answers[(file as File).name]!
    return typeof answer === 'string' ? err(appError(answer)) : ok(answer)
  })
}

const f = (name: string) => new File([new Uint8Array([1])], name)

describe('editor store — notices and drop sequencing', () => {
  let editor: ReturnType<typeof useEditorStore>
  let notices: ReturnType<typeof useNotices>

  beforeEach(() => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    notices = useNotices()
    editor.setCanvasSize(1000, 1000)
  })

  const texts = () => notices.items.map((n) => `${n.kind}: ${n.text}`)

  describe('openFile', () => {
    it('raises the downscale and first-frame notices together after the replace (AC-11b)', async () => {
      editor.setDecoder(
        decoderByName({
          'a.gif': image({
            animated: true,
            downscaled: true,
            sourceWidth: 6000,
            sourceHeight: 4000,
            width: 4096,
            height: 2731,
          }),
        }),
      )
      await editor.openFile(f('a.gif'))

      expect(texts()).toEqual([
        'info: Reduced to the 4096 px limit: 6000×4000 → 4096×2731.',
        'info: Animated image: only the first frame was kept.',
      ])
    })

    it('raises no notice for a plain image (AC-06)', async () => {
      editor.setDecoder(decoderByName({ 'a.png': image() }))
      await editor.openFile(f('a.png'))
      expect(texts()).toEqual([])
    })

    it('raises the refusal as a failure', async () => {
      editor.setDecoder(decoderByName({ 'a.psd': 'NOT_AN_IMAGE' }))
      await editor.openFile(f('a.psd'))
      expect(texts()).toEqual(["failure: This file couldn't be read as an image."])
    })

    it('holds the notices until the replace is confirmed (AC-15)', async () => {
      editor.setDecoder(decoderByName({ 'a.png': image(), 'b.gif': image({ animated: true }) }))
      await editor.openFile(f('a.png'))
      editor.applyEdit()

      await editor.openFile(f('b.gif'))
      expect(texts()).toEqual([])
      editor.confirmReplace()
      expect(texts()).toEqual(['info: Animated image: only the first frame was kept.'])
    })

    it('raises no notices when the replace is cancelled (AC-15)', async () => {
      editor.setDecoder(decoderByName({ 'a.png': image(), 'b.gif': image({ animated: true }) }))
      await editor.openFile(f('a.png'))
      editor.applyEdit()

      await editor.openFile(f('b.gif'))
      editor.cancelReplace()
      expect(texts()).toEqual([])
    })
  })

  describe('openDrop (AC-03, AC-04)', () => {
    it('shows the AC-04 notice when the drop held no files', async () => {
      const decode = decoderByName({})
      editor.setDecoder(decode)
      await editor.openDrop({ files: [] })

      expect(texts()).toEqual(['failure: Only image files can be opened.'])
      expect(decode).not.toHaveBeenCalled()
    })

    it('tries files in browser order until one opens, then says the others were ignored', async () => {
      const decode = decoderByName({
        'notes.txt': 'NOT_AN_IMAGE',
        'broken.jpg': 'UNREADABLE',
        'good.png': image(),
        'later.png': image(),
      })
      editor.setDecoder(decode)
      await editor.openDrop({
        files: [f('notes.txt'), f('broken.jpg'), f('good.png'), f('later.png')],
      })

      expect(decode.mock.calls.map(([file]) => (file as File).name)).toEqual([
        'notes.txt',
        'broken.jpg',
        'good.png',
      ])
      expect(editor.work).not.toBeNull()
      expect(texts()).toEqual([
        'info: The editor works with one image at a time. 3 other files were ignored.',
      ])
    })

    it('shows the first image file’s reason when none opens', async () => {
      editor.setDecoder(
        decoderByName({
          'notes.txt': 'NOT_AN_IMAGE',
          'big.jpg': 'TOO_LARGE',
          'bad.png': 'UNREADABLE',
        }),
      )
      await editor.openDrop({
        files: [f('notes.txt'), f('big.jpg'), f('bad.png')],
      })

      expect(editor.work).toBeNull()
      expect(notices.items).toHaveLength(1)
      expect(notices.items[0]!.text).toMatch(/^This image is too large/)
    })

    it('gives a file named or typed as an image the unreadable reason, not AC-04 (AC-08)', async () => {
      editor.setDecoder(decoderByName({ 'text-named.png': 'NOT_AN_IMAGE' }))
      await editor.openDrop({ files: [f('text-named.png')] })

      expect(texts()).toEqual(["failure: This file couldn't be read as an image."])
    })

    describe('refusals judged before the content is read (F1)', () => {
      const overBytes = appError('TOO_LARGE', { megabytes: 600, ceilingMegabytes: 500 })
      const locked = appError('FILE_NOT_PERMITTED')
      const decodeWith = (answers: Record<string, AppError>) =>
        vi.fn(async (file: Blob): Promise<DecodeOutcome> => err(answers[(file as File).name]!))

      it('shows the AC-04 notice for a large non-image above the byte ceiling', async () => {
        editor.setDecoder(decodeWith({ 'clip.mov': overBytes }))
        await editor.openDrop({ files: [f('clip.mov')] })
        expect(texts()).toEqual(['failure: Only image files can be opened.'])
      })

      it('shows the AC-04 notice for a locked non-image', async () => {
        editor.setDecoder(decodeWith({ 'report.docx': locked }))
        await editor.openDrop({ files: [f('report.docx')] })
        expect(texts()).toEqual(['failure: Only image files can be opened.'])
      })

      it('lets the first real image’s reason win over a non-image refused early (AC-03)', async () => {
        editor.setDecoder(
          decodeWith({
            'clip.mov': overBytes,
            'report.docx': locked,
            'bad.png': appError('UNREADABLE'),
          }),
        )
        await editor.openDrop({ files: [f('clip.mov'), f('report.docx'), f('bad.png')] })
        expect(texts()).toEqual(["failure: This file couldn't be read as an image."])
      })

      it.each(['IMG_0001.CRW', 'SDIM0001.X3F'])(
        'gives a locked Camera RAW file (%s) with no MIME type the not-permitted reason (AC-10)',
        async (name) => {
          editor.setDecoder(decodeWith({ [name]: locked }))
          await editor.openDrop({ files: [f(name)] })
          expect(texts()).toEqual([
            "failure: The app wasn't allowed to read this file. Make it available on this computer first, for example by downloading it from your cloud drive.",
          ])
        },
      )

      it('still gives an image file refused early its own reason', async () => {
        editor.setDecoder(decodeWith({ 'huge.jpg': overBytes, 'locked.png': locked }))
        await editor.openDrop({ files: [f('huge.jpg'), f('locked.png')] })
        expect(texts()).toEqual([
          'failure: This file is too large: 600 MB. The largest file the editor opens is 500 MB.',
        ])
      })
    })

    it('shows the AC-04 notice when no dropped file was an image', async () => {
      editor.setDecoder(decoderByName({ 'a.txt': 'NOT_AN_IMAGE', 'b.txt': 'NOT_AN_IMAGE' }))
      await editor.openDrop({ files: [f('a.txt'), f('b.txt')] })

      expect(texts()).toEqual(['failure: Only image files can be opened.'])
    })

    it('raises all three info notices together for an animated, downscaled image dropped with another file', async () => {
      editor.setDecoder(
        decoderByName({
          'anim.webp': image({
            animated: true,
            downscaled: true,
            sourceWidth: 8000,
            sourceHeight: 4000,
            width: 4096,
            height: 2048,
          }),
          'other.png': image(),
        }),
      )
      await editor.openDrop({ files: [f('anim.webp'), f('other.png')] })

      expect(texts()).toEqual([
        'info: Reduced to the 4096 px limit: 8000×4000 → 4096×2048.',
        'info: Animated image: only the first frame was kept.',
        'info: The editor works with one image at a time. 1 other file was ignored.',
      ])
    })

    it('stops the loop and raises nothing when a newer open starts mid-sequence', async () => {
      let release!: (o: DecodeOutcome) => void
      const decode = vi.fn((file: Blob) =>
        (file as File).name === 'slow.jpg'
          ? new Promise<DecodeOutcome>((resolve) => (release = resolve))
          : Promise.resolve<DecodeOutcome>(ok(image())),
      )
      editor.setDecoder(decode)

      const drop = editor.openDrop({ files: [f('slow.jpg'), f('next.png')] })
      await editor.openFile(f('picked.png'))
      release(err(appError('UNREADABLE')))
      await drop

      expect(decode.mock.calls.map(([file]) => (file as File).name)).toEqual([
        'slow.jpg',
        'picked.png',
      ])
      expect(texts()).toEqual([])
    })
  })
})
