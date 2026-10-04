import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, watch } from 'vue'
import { appError, err, ok, type AppError, type Result } from '@/core'
import { SUPERSEDED, type DecodedImage, type DecodeOutcome } from '@/infra/image-decode'
import { useEditorStore } from './store'

type FakeBitmap = ImageBitmap & { close: ReturnType<typeof vi.fn> }
const bitmap = (width: number, height: number) =>
  ({ width, height, close: vi.fn() }) as unknown as FakeBitmap

function decoded(width: number, height: number, extra: Partial<DecodedImage> = {}): DecodedImage {
  return {
    bitmap: bitmap(width, height),
    sourceWidth: width,
    sourceHeight: height,
    width,
    height,
    format: 'jpeg',
    animated: false,
    downscaled: false,
    ...extra,
  }
}

/** A decoder whose calls resolve only when the test says so; newer calls supersede older ones. */
function fakeDecoder() {
  const calls: { resolve: (outcome: DecodeOutcome) => void }[] = []
  const decode = vi.fn(
    () =>
      new Promise<DecodeOutcome>((resolve) => {
        calls.at(-1)?.resolve(SUPERSEDED)
        calls.push({ resolve })
      }),
  )
  return {
    decode,
    answer(index: number, outcome: Result<DecodedImage, AppError>) {
      calls[index]!.resolve(outcome)
    },
  }
}

const file = () => new Blob([new Uint8Array([1])])

describe('editor store — open and replace', () => {
  let decoder: ReturnType<typeof fakeDecoder>
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    decoder = fakeDecoder()
    editor = useEditorStore()
    editor.setDecoder(decoder.decode)
    editor.setCanvasSize(1000, 800)
  })

  async function openReplaced(width = 4000, height = 2000) {
    const pending = editor.openImage(file())
    decoder.answer(decoder.decode.mock.calls.length - 1, ok(decoded(width, height)))
    return pending
  }

  it('opens into an empty editor at Fit with auto-fit on (AC-01)', async () => {
    const outcome = await openReplaced(4000, 2000)

    expect(outcome).toMatchObject({ kind: 'replaced', image: { width: 4000, height: 2000 } })
    expect(editor.work).toMatchObject({ original: { width: 4000, height: 2000 }, revision: 0 })
    expect(editor.view).toEqual({ zoom: 0.25, panX: 0, panY: 150, autoFit: true })
    expect(editor.phase).toBe('idle')
  })

  it('is reading while the decode runs', () => {
    editor.openImage(file())
    expect(editor.phase).toBe('reading')
  })

  it('replaces without confirmation when only the View changed (AC-14)', async () => {
    await openReplaced()
    const firstId = editor.work!.id
    editor.zoomAt(3, { x: 100, y: 100 })
    editor.panBy(-50, -50)

    const outcome = await openReplaced(800, 600)
    expect(outcome.kind).toBe('replaced')
    expect(editor.work!.id).not.toBe(firstId)
  })

  it('closes the old Original only after the swap has been flushed to watchers', async () => {
    await openReplaced()
    const old = editor.work!.original.pixels as FakeBitmap
    editor.applyEdit()
    await openReplaced(800, 600) // → confirming
    let closedDuringFlush: boolean | undefined
    const stop = watch(
      () => editor.work,
      () => (closedDuringFlush = old.close.mock.calls.length > 0),
    )

    editor.confirmReplace() // the swap itself is synchronous
    expect(old.close).not.toHaveBeenCalled()
    await nextTick()
    expect(closedDuringFlush).toBe(false) // a watcher (the renderer) still saw it open
    expect(old.close).toHaveBeenCalled()
    stop()
  })

  describe('with Unsaved edits (AC-15)', () => {
    beforeEach(async () => {
      await openReplaced()
      editor.applyEdit()
    })

    it('asks for confirmation instead of replacing', async () => {
      const before = { work: editor.work, view: editor.view }
      const outcome = await openReplaced(800, 600)

      expect(outcome).toEqual({ kind: 'confirming' })
      expect(editor.phase).toBe('confirming')
      expect(editor.work).toBe(before.work)
      expect(editor.view).toEqual(before.view)
    })

    it('cancel keeps Work and View exactly and closes the pending bitmap', async () => {
      const before = { work: editor.work, revision: editor.work!.revision, view: editor.view }
      await openReplaced(800, 600)
      const pendingBitmap = editor.pending!.bitmap as FakeBitmap

      expect(editor.cancelReplace()).toEqual({ kind: 'cancelled' })
      expect(pendingBitmap.close).toHaveBeenCalled()
      expect(editor.work).toBe(before.work)
      expect(editor.work!.revision).toBe(before.revision)
      expect(editor.view).toEqual(before.view)
      expect(editor.pending).toBeNull()
      expect(editor.phase).toBe('idle')
    })

    it('confirm replaces with the new image at Fit', async () => {
      await openReplaced(800, 600)
      const outcome = editor.confirmReplace()

      expect(outcome).toMatchObject({ kind: 'replaced', image: { width: 800, height: 600 } })
      expect(editor.work).toMatchObject({ original: { width: 800, height: 600 }, revision: 0 })
      expect(editor.view.autoFit).toBe(true)
      expect(editor.phase).toBe('idle')
    })

    it('ignores another open while confirming', async () => {
      await openReplaced(800, 600)
      expect(await editor.openImage(file())).toEqual({ kind: 'ignored' })
      expect(decoder.decode).toHaveBeenCalledTimes(2)
    })
  })

  it('changes nothing on a refusal, with no confirmation (AC-16)', async () => {
    await openReplaced()
    editor.applyEdit()
    const before = { work: editor.work, view: editor.view }

    const pending = editor.openImage(file())
    decoder.answer(1, err(appError('TOO_LARGE', { megapixels: 120 })))
    const outcome = await pending

    expect(outcome).toEqual({
      kind: 'refused',
      error: { code: 'TOO_LARGE', details: { megapixels: 120 } },
    })
    expect(editor.work).toBe(before.work)
    expect(editor.view).toEqual(before.view)
    expect(editor.phase).toBe('idle')
  })

  describe('latest open wins (AC-16b)', () => {
    it('only the most recent open can replace', async () => {
      const first = editor.openImage(file())
      const second = editor.openImage(file())
      decoder.answer(1, ok(decoded(640, 480)))

      expect(await first).toEqual({ kind: 'superseded' })
      expect(await second).toMatchObject({ kind: 'replaced' })
      expect(editor.work!.original).toMatchObject({ width: 640, height: 480 })
    })

    it('drops a stale result that still arrives and closes its bitmap', async () => {
      // A decoder that does not supersede on its own: both results arrive.
      const answers: ((o: DecodeOutcome) => void)[] = []
      editor.setDecoder(() => new Promise((resolve) => answers.push(resolve)))
      const first = editor.openImage(file())
      const second = editor.openImage(file())

      const stale = decoded(100, 100)
      answers[0]!(ok(stale))
      expect(await first).toEqual({ kind: 'superseded' })
      expect(stale.bitmap.close).toHaveBeenCalled()
      expect(editor.work).toBeNull()
      expect(editor.phase).toBe('reading')

      answers[1]!(ok(decoded(200, 100)))
      expect(await second).toMatchObject({ kind: 'replaced' })
    })

    it('keeps the View live while a read is in progress', async () => {
      await openReplaced()
      const work = editor.work
      editor.openImage(file())

      editor.stepZoom(1)
      expect(editor.view.zoom).toBeCloseTo(1 / 3)
      expect(editor.work).toBe(work)
    })
  })
})

describe('editor store — View actions', () => {
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setDecoder(async () => ok(decoded(4000, 4000)))
    editor.setCanvasSize(1000, 1000)
    await editor.openImage(file())
  })

  it('never touches the Work (AC-14)', () => {
    const work = editor.work
    editor.zoomAt(2, { x: 10, y: 10 })
    editor.stepZoom(-1)
    editor.panBy(5, 5)
    editor.actualSize()
    editor.fit()
    editor.setCanvasSize(500, 500)

    expect(editor.work).toBe(work)
    expect(editor.work!.revision).toBe(0)
  })

  it('fit turns auto-fit back on and re-fits on resize', () => {
    editor.actualSize()
    expect(editor.view).toMatchObject({ zoom: 1, autoFit: false })
    editor.fit()
    editor.setCanvasSize(2000, 2000)
    expect(editor.view).toMatchObject({ zoom: 0.5, autoFit: true })
  })

  it('keeps the zoom on resize after a manual zoom', () => {
    editor.actualSize()
    editor.setCanvasSize(2000, 2000)
    expect(editor.view.zoom).toBe(1)
  })

  it('fits a Work opened before the canvas had a size once the size arrives', async () => {
    setActivePinia(createPinia())
    const fresh = useEditorStore()
    fresh.setDecoder(async () => ok(decoded(4000, 4000)))
    await fresh.openImage(file())
    fresh.setCanvasSize(1000, 1000)
    expect(fresh.view).toMatchObject({ zoom: 0.25, autoFit: true })
  })

  it('applyEdit raises the revision so the Work has Unsaved edits', () => {
    editor.applyEdit()
    expect(editor.work!.revision).toBe(1)
    expect(editor.hasUnsavedEdits).toBe(true)
  })
})
