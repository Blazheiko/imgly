import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, watch } from 'vue'
import {
  appError,
  err,
  flipOnScreen,
  identityGeometry,
  NEUTRAL_ADJUSTMENTS,
  ok,
  turnedBounds,
  type Adjustments,
  type AppError,
  type Geometry,
  type Result,
} from '@/core'
import { SUPERSEDED, type DecodedImage, type DecodeOutcome } from '@/infra/image-decode'
import { useNotices } from '@/shared'
import type { Layer } from '@/render'
import { useEditorStore } from './store'
import { createFakeRenderer } from './fake-renderer'

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
    hasTransparency: false,
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

describe('editor store — bitmap ledger (sad.md §8 resource lifetime)', () => {
  it('retains exactly one Original after opens, replaces, cancels and stale results', async () => {
    setActivePinia(createPinia())
    const { bitmapLedger, resetBitmapLedger } = await import('@/shared')
    resetBitmapLedger()
    const editor = useEditorStore()
    const answers: ((o: DecodeOutcome) => void)[] = []
    editor.setDecoder(
      () =>
        new Promise<DecodeOutcome>((resolve) => {
          answers.push(resolve)
        }),
    )
    editor.setCanvasSize(1000, 1000)
    // The real client notes every bitmap it receives; the fake decoder does it by hand here.
    const answer = (i: number) => {
      bitmapLedger.noteReceived()
      answers[i]!(ok(decoded(100 + i, 100)))
    }

    for (let i = 0; i < 10; i++) {
      const open = editor.openImage(file())
      answer(i)
      await open
    }
    const stale = editor.openImage(file())
    const latest = editor.openImage(file())
    answer(10)
    answer(11)
    await Promise.all([stale, latest])
    editor.applyEdit()
    const confirm = editor.openImage(file())
    answer(12)
    await confirm
    editor.cancelReplace()
    await nextTick()

    expect(bitmapLedger.received - bitmapLedger.closed).toBe(1)
  })
})

describe('editor store — Source name, Source format and transparency (export AC-08, AC-15)', () => {
  let decoder: ReturnType<typeof fakeDecoder>
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    decoder = fakeDecoder()
    editor = useEditorStore()
    editor.setDecoder(decoder.decode)
    editor.setCanvasSize(1000, 800)
  })

  const named = (name: string) => new File([new Uint8Array([1])], name)
  const answerLast = (image: DecodedImage) =>
    decoder.answer(decoder.decode.mock.calls.length - 1, ok(image))

  async function open(blob: Blob, image = decoded(800, 600)) {
    const pending = editor.openImage(blob)
    answerLast(image)
    return pending
  }

  it('takes the Source name from the file name and the Source format from the content', async () => {
    await open(named('IMG_4021.HEIC'), decoded(800, 600, { format: 'heic' }))
    expect(editor.work).toMatchObject({ sourceName: 'IMG_4021', sourceFormat: 'heic' })
  })

  it('keeps an unknown extension in the Source name', async () => {
    await open(named('scan.v2'), decoded(800, 600, { format: 'png' }))
    expect(editor.work!.sourceName).toBe('scan.v2')
  })

  it('gives a Blob with no name an empty Source name', async () => {
    await open(file())
    expect(editor.work!.sourceName).toBe('')
  })

  it('carries the transparency fact on the Original', async () => {
    await open(named('a.png'), decoded(800, 600, { format: 'png', hasTransparency: true }))
    expect(editor.work!.original.hasTransparency).toBe(true)

    await open(named('b.jpg'), decoded(800, 600, { format: 'jpeg' }))
    expect(editor.work!.original.hasTransparency).toBe(false)
  })

  it('a replace by "Open image" brings the new name and format (AC-08)', async () => {
    await open(named('first.jpg'), decoded(800, 600, { format: 'jpeg' }))
    await open(named('second.webp'), decoded(800, 600, { format: 'webp' }))
    expect(editor.work).toMatchObject({ sourceName: 'second', sourceFormat: 'webp' })
  })

  it('a replace by a drop brings the new name and format (AC-08)', async () => {
    await open(named('first.jpg'), decoded(800, 600, { format: 'jpeg' }))
    const dropped = editor.openDrop({ files: [named('dropped.PNG')] })
    await Promise.resolve()
    answerLast(decoded(800, 600, { format: 'png' }))
    await dropped
    expect(editor.work).toMatchObject({ sourceName: 'dropped', sourceFormat: 'png' })
  })

  it('a confirmed replace over Unsaved edits brings the new name and format', async () => {
    await open(named('first.jpg'))
    editor.applyEdit()
    expect((await open(named('second.gif'), decoded(800, 600, { format: 'gif' }))).kind).toBe(
      'confirming',
    )
    expect(editor.work!.sourceName).toBe('first')

    editor.confirmReplace()
    expect(editor.work).toMatchObject({ sourceName: 'second', sourceFormat: 'gif' })
  })

  it('a cancelled replace keeps the old name and format', async () => {
    await open(named('first.jpg'))
    editor.applyEdit()
    await open(named('second.gif'), decoded(800, 600, { format: 'gif' }))
    editor.cancelReplace()
    expect(editor.work).toMatchObject({ sourceName: 'first', sourceFormat: 'jpeg' })
  })
})

describe('editor store — exporting phase and save point (export AC-09, AC-10, AC-11)', () => {
  let decoder: ReturnType<typeof fakeDecoder>
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    decoder = fakeDecoder()
    editor = useEditorStore()
    editor.setDecoder(decoder.decode)
    editor.setCanvasSize(1000, 800)
  })

  const named = (name: string) => new File([new Uint8Array([1])], name)

  async function openWork(name = 'photo.jpg') {
    const pending = editor.openImage(named(name))
    decoder.answer(decoder.decode.mock.calls.length - 1, ok(decoded(800, 600)))
    await pending
  }

  it('refuses to begin with no Work open', () => {
    expect(editor.beginExport()).toBeNull()
    expect(editor.phase).toBe('idle')
  })

  it('refuses to begin while reading, confirming or already exporting', async () => {
    await openWork()
    editor.applyEdit()

    void editor.openImage(named('b.jpg'))
    expect(editor.phase).toBe('reading')
    expect(editor.beginExport()).toBeNull()
    decoder.answer(decoder.decode.mock.calls.length - 1, ok(decoded(800, 600)))
    await Promise.resolve()
    await Promise.resolve()
    expect(editor.phase).toBe('confirming')
    expect(editor.beginExport()).toBeNull()
    editor.cancelReplace()

    expect(editor.beginExport()).not.toBeNull()
    expect(editor.beginExport()).toBeNull()
    expect(editor.phase).toBe('exporting')
  })

  it('snapshots the Work at confirm', async () => {
    await openWork('IMG_4021.jpg')
    editor.applyEdit()
    const work = editor.work!

    expect(editor.beginExport()).toEqual({
      workId: work.id,
      revision: 1,
      original: work.original,
      geometry: work.geometry,
      adjustments: work.adjustments,
      drawing: null,
      sourceName: 'IMG_4021',
      sourceFormat: 'jpeg',
    })
    expect(editor.phase).toBe('exporting')
  })

  it('a finished export clears Unsaved edits and a replace then needs no confirmation (AC-09)', async () => {
    await openWork()
    editor.applyEdit()
    const snapshot = editor.beginExport()!

    editor.finishExport(snapshot, true)
    expect(editor.phase).toBe('idle')
    expect(editor.hasUnsavedEdits).toBe(false)

    const pending = editor.openImage(named('next.png'))
    decoder.answer(decoder.decode.mock.calls.length - 1, ok(decoded(800, 600)))
    expect((await pending).kind).toBe('replaced')
  })

  it('an edit after a finished export makes the Work unsaved again (AC-09)', async () => {
    await openWork()
    editor.applyEdit()
    editor.finishExport(editor.beginExport()!, true)
    editor.applyEdit()
    expect(editor.hasUnsavedEdits).toBe(true)
  })

  it('a cancelled, refused or failed export keeps Unsaved edits (AC-10)', async () => {
    await openWork()
    editor.applyEdit()
    editor.finishExport(editor.beginExport()!, false)

    expect(editor.phase).toBe('idle')
    expect(editor.hasUnsavedEdits).toBe(true)
    const pending = editor.openImage(named('next.png'))
    decoder.answer(decoder.decode.mock.calls.length - 1, ok(decoded(800, 600)))
    expect((await pending).kind).toBe('confirming')
  })

  it('sets the save point to the snapshot revision, never the current one', async () => {
    await openWork()
    editor.applyEdit()
    const snapshot = editor.beginExport()!
    // A stray revision bump during the export (applyEdit refuses, so simulate a later Work).
    editor.work = { ...editor.work!, revision: 5 }
    editor.finishExport(snapshot, true)

    expect(editor.work!.cleanRevision).toBe(1)
    expect(editor.hasUnsavedEdits).toBe(true)
  })

  it('sets no save point when the snapshot belongs to another Work', async () => {
    await openWork()
    editor.applyEdit()
    const snapshot = editor.beginExport()!
    editor.finishExport({ ...snapshot, workId: 'someone-else' }, true)

    expect(editor.phase).toBe('idle')
    expect(editor.hasUnsavedEdits).toBe(true)
  })

  it('refuses opens and edits while exporting, without queuing them (AC-11)', async () => {
    await openWork()
    const before = editor.work!
    const snapshot = editor.beginExport()!
    const calls = decoder.decode.mock.calls.length

    expect(await editor.openFile(named('other.png'))).toEqual({ kind: 'ignored' })
    expect(await editor.openImage(named('other.png'))).toEqual({ kind: 'ignored' })
    editor.applyEdit()
    expect(decoder.decode.mock.calls.length).toBe(calls)
    expect(editor.work).toBe(before)
    expect(useNotices().items).toEqual([])

    editor.finishExport(snapshot, false)
    expect(decoder.decode.mock.calls.length).toBe(calls)
    expect(editor.work!.revision).toBe(0)
  })

  it('refuses a drop while exporting with the one "wait" notice (AC-11)', async () => {
    await openWork()
    editor.beginExport()
    const calls = decoder.decode.mock.calls.length

    expect(await editor.openDrop({ files: [named('dropped.png')] })).toEqual({ kind: 'ignored' })
    expect(decoder.decode.mock.calls.length).toBe(calls)
    expect(useNotices().items.map((n) => [n.kind, n.text])).toEqual([
      ['info', 'Wait for the export to finish, then drop the image again.'],
    ])
  })

  it('keeps zoom and pan live while exporting (AC-11)', async () => {
    await openWork()
    editor.beginExport()
    const view = editor.view

    editor.stepZoom(1)
    expect(editor.view.zoom).not.toBe(view.zoom)
    editor.fit()
    expect(editor.view).toEqual(view)
  })
})

describe('editor store — tool slot (crop-rotate ADR-0003)', () => {
  let decoder: ReturnType<typeof fakeDecoder>
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    decoder = fakeDecoder()
    editor = useEditorStore()
    editor.setDecoder(decoder.decode)
    editor.setCanvasSize(1000, 800)
  })

  async function open(width = 4000, height = 2000) {
    const pending = editor.openImage(file())
    decoder.answer(decoder.decode.mock.calls.length - 1, ok(decoded(width, height)))
    return pending
  }

  const geometry = (over: Partial<Geometry> = {}): Geometry => ({
    ...identityGeometry({ width: 4000, height: 2000 }),
    ...over,
  })

  it('refuses to open a tool with no Work (AC-18)', () => {
    expect(editor.openTool('crop-rotate')).toEqual({ ok: false, reason: 'no-work' })
    expect(editor.activeTool).toBeNull()
  })

  it('refuses while exporting, and does not queue the request (AC-15)', async () => {
    await open()
    const snapshot = editor.beginExport()!
    expect(editor.openTool('crop-rotate')).toEqual({ ok: false, reason: 'exporting' })
    editor.finishExport(snapshot, false)
    expect(editor.activeTool).toBeNull()
  })

  it('refuses while another feature’s panel or the replace dialog is open (AC-16, AC-20)', async () => {
    await open()
    editor.setActivePanel('export')
    expect(editor.openTool('crop-rotate')).toEqual({ ok: false, reason: 'panel-open' })
    editor.setActivePanel(null)
    editor.phase = 'confirming'
    expect(editor.openTool('crop-rotate')).toEqual({ ok: false, reason: 'confirming' })
    expect(editor.activeTool).toBeNull()
  })

  it('refuses a second tool while one is open', async () => {
    await open()
    expect(editor.openTool('crop-rotate')).toEqual({ ok: true })
    expect(editor.openTool('crop-rotate')).toEqual({ ok: false, reason: 'tool-open' })
  })

  it('opens with the Work’s Geometry as the preview and closes clearing it', async () => {
    await open()
    editor.openTool('crop-rotate')
    expect(editor.activeTool).toBe('crop-rotate')
    expect(editor.previewGeometry).toEqual(editor.work!.geometry)

    editor.closeTool()
    expect(editor.activeTool).toBeNull()
    expect(editor.previewGeometry).toBeNull()
  })

  it('takes a preview Geometry only while a tool is open', async () => {
    await open()
    editor.setPreviewGeometry(geometry({ flipH: true }))
    expect(editor.previewGeometry).toBeNull()
    editor.openTool('crop-rotate')
    editor.setPreviewGeometry(geometry({ flipH: true }))
    expect(editor.previewGeometry).toMatchObject({ flipH: true })
    expect(editor.work!.geometry.flipH).toBe(false)
    expect(editor.hasUnsavedEdits).toBe(false) // the Draft never counts (AC-17)
  })

  it('refuses to export while a tool is open (AC-16)', async () => {
    await open()
    editor.openTool('crop-rotate')
    expect(editor.beginExport()).toBeNull()
    expect(editor.phase).toBe('idle')
  })

  describe('applyGeometry (AC-13)', () => {
    it('stores a different Geometry and raises the revision', async () => {
      await open()
      editor.applyGeometry(
        geometry({ rotation: 90, crop: { x: 0, y: 0, width: 2000, height: 4000 } }),
      )
      expect(editor.work!.geometry.rotation).toBe(90)
      expect(editor.work!.revision).toBe(1)
      expect(editor.hasUnsavedEdits).toBe(true)
    })

    it('leaves the revision alone for a field-equal Geometry', async () => {
      await open()
      editor.applyGeometry(geometry())
      expect(editor.work!.revision).toBe(0)
      expect(editor.hasUnsavedEdits).toBe(false)
    })

    it('counts H+V Flips on a 180° Rotation as a change, although the pixels match', async () => {
      await open()
      editor.applyGeometry(geometry({ rotation: 180 }))
      editor.applyGeometry(geometry({ rotation: 180, flipH: true, flipV: true }))
      expect(editor.work!.revision).toBe(2)
    })

    it('after an Export, changing it back by hand is still an edit', async () => {
      await open()
      editor.applyGeometry(geometry({ flipH: true }))
      editor.finishExport(editor.beginExport()!, true)
      expect(editor.hasUnsavedEdits).toBe(false)
      editor.applyGeometry(geometry())
      expect(editor.hasUnsavedEdits).toBe(true)
    })

    it('is refused while exporting', async () => {
      await open()
      editor.beginExport()
      editor.applyGeometry(geometry({ flipH: true }))
      expect(editor.work!.geometry.flipH).toBe(false)
    })
  })

  describe('replace while the tool is open (AC-17)', () => {
    it('closes the tool once the new image replaces the Work', async () => {
      await open()
      editor.openTool('crop-rotate')
      editor.setPreviewGeometry(geometry({ flipV: true }))
      await open(300, 200)
      expect(editor.activeTool).toBeNull()
      expect(editor.previewGeometry).toBeNull()
    })

    it('keeps the tool and its preview when the read fails', async () => {
      await open()
      editor.openTool('crop-rotate')
      editor.setPreviewGeometry(geometry({ flipV: true }))
      const pending = editor.openImage(file())
      decoder.answer(decoder.decode.mock.calls.length - 1, err(appError('DECODE_FAILED')))
      await pending
      expect(editor.activeTool).toBe('crop-rotate')
      expect(editor.previewGeometry).toMatchObject({ flipV: true })
    })

    it('keeps the tool while confirming and after a declined replace', async () => {
      await open()
      editor.applyGeometry(geometry({ flipH: true }))
      editor.openTool('crop-rotate')
      expect((await open(300, 200)).kind).toBe('confirming')
      expect(editor.activeTool).toBe('crop-rotate')
      editor.cancelReplace()
      expect(editor.activeTool).toBe('crop-rotate')
      editor.confirmReplace()
      expect(editor.activeTool).toBe('crop-rotate')
    })

    it('closes the tool when the replace is confirmed', async () => {
      await open()
      editor.applyGeometry(geometry({ flipH: true }))
      editor.openTool('crop-rotate')
      await open(300, 200)
      editor.confirmReplace()
      expect(editor.activeTool).toBeNull()
    })
  })

  describe('fit-View (AC-19)', () => {
    it('fits the whole turned image on open and the Work’s size after close', async () => {
      await open(4000, 2000)
      editor.applyGeometry(geometry({ crop: { x: 0, y: 0, width: 500, height: 400 } }))
      editor.fit()
      // The Work is 500×400 → at most 100%: zoom 1.
      expect(editor.view.zoom).toBe(1)

      editor.openTool('crop-rotate')
      // The whole 4000×2000 turned image fits 1000×800 at 0.25.
      expect(editor.view).toMatchObject({ zoom: 0.25, panX: 0, panY: 150 })

      editor.closeTool()
      expect(editor.view).toMatchObject({ zoom: 1, panX: 250, panY: 200 })
    })

    it('re-fits when a quarter turn changes the turned image inside the tool', async () => {
      await open(4000, 2000)
      editor.openTool('crop-rotate')
      editor.setPreviewGeometry(
        geometry({ rotation: 90, crop: { x: 0, y: 0, width: 2000, height: 4000 } }),
      )
      // 2000×4000 into 1000×800 → 0.2.
      expect(editor.view.zoom).toBe(0.2)
    })

    it('keeps the frame still on screen when a Straighten angle grows the bounds', async () => {
      await open(4000, 2000)
      editor.openTool('crop-rotate')
      editor.zoomAt(2, { x: 500, y: 400 })
      const before = { ...editor.view }
      const straight = { ...geometry(), straighten: 100 }
      editor.setPreviewGeometry(straight)
      const b = turnedBounds(straight, { width: 4000, height: 2000 })
      expect(editor.view.zoom).toBe(before.zoom)
      expect(editor.view.panX).toBeCloseTo(before.panX + b.x * before.zoom, 9)
      expect(editor.view.panY).toBeCloseTo(before.panY + b.y * before.zoom, 9)
    })

    it('keeps an off-centre frame still on screen while the angle changes (AC-05)', async () => {
      await open(4000, 2000)
      editor.openTool('crop-rotate')
      const offCentre = geometry({ crop: { x: 200, y: 200, width: 1000, height: 600 } })
      editor.setPreviewGeometry(offCentre)
      const screenCentre = (g: Geometry) => {
        const b = turnedBounds(g, { width: 4000, height: 2000 })
        const { zoom, panX, panY } = editor.view
        return {
          x: panX + (g.crop.x + g.crop.width / 2 - b.x) * zoom,
          y: panY + (g.crop.y + g.crop.height / 2 - b.y) * zoom,
        }
      }
      const before = screenCentre(offCentre)
      // The image turns around the frame's centre, so the centre moves in turned coordinates.
      const turned = geometry({
        straighten: 100,
        crop: { x: 380, y: -60, width: 900, height: 540 },
      })
      editor.setPreviewGeometry(turned, { angleStep: true })
      const after = screenCentre(turned)
      expect(after.x).toBeCloseTo(before.x, 6)
      expect(after.y).toBeCloseTo(before.y, 6)
    })

    it('leaves the pan alone when a Flip at an angle mirrors an off-centre frame (AC-04)', async () => {
      await open(4000, 2000)
      editor.openTool('crop-rotate')
      const angled = geometry({
        straighten: 100,
        crop: { x: 380, y: -60, width: 900, height: 540 },
      })
      editor.setPreviewGeometry(angled, { angleStep: true })
      const before = { ...editor.view }
      editor.setPreviewGeometry(flipOnScreen(angled, 'horizontal', { width: 4000, height: 2000 }))
      expect(editor.view).toEqual(before)
    })

    it('offsets only the turned bounds when a Reset leaves an angle (AC-12)', async () => {
      await open(4000, 2000)
      editor.openTool('crop-rotate')
      const angled = geometry({
        straighten: 100,
        crop: { x: 380, y: -60, width: 900, height: 540 },
      })
      editor.setPreviewGeometry(angled, { angleStep: true })
      const before = { ...editor.view }
      const reset = identityGeometry({ width: 4000, height: 2000 })
      editor.setPreviewGeometry(reset)
      const from = turnedBounds(angled, { width: 4000, height: 2000 })
      const to = turnedBounds(reset, { width: 4000, height: 2000 })
      expect(editor.view.zoom).toBe(before.zoom)
      expect(editor.view.panX).toBeCloseTo(before.panX + (to.x - from.x) * before.zoom, 9)
      expect(editor.view.panY).toBeCloseTo(before.panY + (to.y - from.y) * before.zoom, 9)
    })

    it('zoom and pan in the tool never change the Geometry or count as an edit', async () => {
      await open()
      editor.openTool('crop-rotate')
      editor.zoomAt(2, { x: 10, y: 10 })
      editor.panBy(30, 30)
      expect(editor.previewGeometry).toEqual(editor.work!.geometry)
      expect(editor.work!.revision).toBe(0)
    })
  })

  it('records which panel is open, for other features to read (AC-20)', () => {
    expect(editor.activePanel).toBeNull()
    editor.setActivePanel('export')
    expect(editor.activePanel).toBe('export')
    editor.setActivePanel(null)
    expect(editor.activePanel).toBeNull()
  })
})

describe('editor store — the adjust tool in the slot (adjust AC-11, AC-17, AC-20)', () => {
  let decoder: ReturnType<typeof fakeDecoder>
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    decoder = fakeDecoder()
    editor = useEditorStore()
    editor.setDecoder(decoder.decode)
    editor.setCanvasSize(1000, 800)
  })

  async function open(width = 4000, height = 2000) {
    const pending = editor.openImage(file())
    decoder.answer(decoder.decode.mock.calls.length - 1, ok(decoded(width, height)))
    return pending
  }

  const adjusted = (over: Partial<Adjustments> = {}): Adjustments => ({
    ...NEUTRAL_ADJUSTMENTS,
    ...over,
  })

  async function zoomedAndPanned() {
    await open()
    editor.zoomAt(2, { x: 300, y: 200 })
    editor.panBy(40, -25)
    return { ...editor.view }
  }

  describe('opening and closing leaves the View alone (AC-20)', () => {
    it('opens without a preview Geometry and without fitting the View', async () => {
      const view = await zoomedAndPanned()
      expect(editor.openTool('adjust')).toEqual({ ok: true })
      expect(editor.activeTool).toBe('adjust')
      expect(editor.previewGeometry).toBeNull()
      expect(editor.view).toEqual(view)
    })

    it('closes without fitting the View and clears the preview Adjustments', async () => {
      await open()
      editor.openTool('adjust')
      editor.setPreviewAdjustments(adjusted({ contrast: 30 }))
      editor.zoomAt(2, { x: 300, y: 200 })
      const view = { ...editor.view }
      editor.closeTool()
      expect(editor.activeTool).toBeNull()
      expect(editor.previewAdjustments).toBeNull()
      expect(editor.view).toEqual(view)
    })

    it('still fits the whole turned image for crop-rotate (crop-rotate AC-19)', async () => {
      const view = await zoomedAndPanned()
      editor.openTool('crop-rotate')
      expect(editor.previewGeometry).toEqual(editor.work!.geometry)
      expect(editor.view).not.toEqual(view)
    })

    it('zooms and pans inside the tool without counting as an edit', async () => {
      await open()
      editor.openTool('adjust')
      editor.zoomAt(2, { x: 300, y: 200 })
      editor.panBy(10, 10)
      expect(editor.hasUnsavedEdits).toBe(false)
      expect(editor.work!.revision).toBe(0)
    })

    it('refuses crop-rotate while adjust is open, and the reverse', async () => {
      await open()
      editor.openTool('adjust')
      expect(editor.openTool('crop-rotate')).toEqual({ ok: false, reason: 'tool-open' })
      editor.closeTool()
      editor.openTool('crop-rotate')
      expect(editor.openTool('adjust')).toEqual({ ok: false, reason: 'tool-open' })
    })
  })

  describe('previewAdjustments', () => {
    it('is null until the adjust tool sets it, and never counts as an edit (AC-17)', async () => {
      await open()
      expect(editor.previewAdjustments).toBeNull()
      editor.openTool('adjust')
      editor.setPreviewAdjustments(adjusted({ brightness: 20 }))
      expect(editor.previewAdjustments).toEqual(adjusted({ brightness: 20 }))
      expect(editor.work!.adjustments).toEqual(NEUTRAL_ADJUSTMENTS)
      expect(editor.hasUnsavedEdits).toBe(false)
    })

    it('is ignored with no tool or with crop-rotate open', async () => {
      await open()
      editor.setPreviewAdjustments(adjusted({ brightness: 20 }))
      expect(editor.previewAdjustments).toBeNull()
      editor.openTool('crop-rotate')
      editor.setPreviewAdjustments(adjusted({ brightness: 20 }))
      expect(editor.previewAdjustments).toBeNull()
    })
  })

  describe('applyAdjustments (AC-11)', () => {
    it('stores different values and raises the revision', async () => {
      await open()
      editor.openTool('adjust')
      editor.applyAdjustments(adjusted({ saturation: -40 }))
      expect(editor.work!.adjustments).toEqual(adjusted({ saturation: -40 }))
      expect(editor.work!.revision).toBe(1)
      expect(editor.hasUnsavedEdits).toBe(true)
    })

    it('leaves the revision alone for the values from open', async () => {
      await open()
      editor.applyAdjustments(adjusted({ tint: 5 }))
      editor.openTool('adjust')
      editor.applyAdjustments(adjusted({ tint: 5 }))
      expect(editor.work!.revision).toBe(1)
    })

    it('after an Export, changing a value back in a later Apply is still an edit', async () => {
      await open()
      editor.applyAdjustments(adjusted({ sepia: 30 }))
      editor.finishExport(editor.beginExport()!, true)
      expect(editor.hasUnsavedEdits).toBe(false)
      editor.applyAdjustments(NEUTRAL_ADJUSTMENTS)
      expect(editor.hasUnsavedEdits).toBe(true)
    })

    it('is refused while exporting', async () => {
      await open()
      editor.beginExport()
      editor.applyAdjustments(adjusted({ sepia: 30 }))
      expect(editor.work!.adjustments).toEqual(NEUTRAL_ADJUSTMENTS)
    })

    it('stores a copy, so the caller changing its object later changes nothing', async () => {
      await open()
      const next = adjusted({ contrast: 10 })
      editor.applyAdjustments(next)
      next.contrast = 99
      expect(editor.work!.adjustments.contrast).toBe(10)
    })

    it('keeps the Adjustments when a Geometry is applied (AC-18)', async () => {
      await open()
      editor.applyAdjustments(adjusted({ contrast: 10 }))
      editor.applyGeometry({ ...identityGeometry({ width: 4000, height: 2000 }), flipH: true })
      expect(editor.work!.adjustments).toEqual(adjusted({ contrast: 10 }))
    })
  })

  describe('replace while adjust is open (AC-17)', () => {
    it('closes the tool, drops the preview and starts the new Work neutral', async () => {
      await open()
      editor.applyAdjustments(adjusted({ grayscale: 100 }))
      editor.finishExport(editor.beginExport()!, true)
      editor.openTool('adjust')
      editor.setPreviewAdjustments(adjusted({ grayscale: 50 }))
      await open(300, 200)
      expect(editor.activeTool).toBeNull()
      expect(editor.previewAdjustments).toBeNull()
      expect(editor.work!.adjustments).toEqual(NEUTRAL_ADJUSTMENTS)
    })

    it('keeps the tool and its preview when the read fails or the replace is declined', async () => {
      await open()
      editor.applyAdjustments(adjusted({ tint: 5 }))
      editor.openTool('adjust')
      editor.setPreviewAdjustments(adjusted({ tint: 9 }))
      const failing = editor.openImage(file())
      decoder.answer(decoder.decode.mock.calls.length - 1, err(appError('DECODE_FAILED')))
      await failing
      expect((await open(300, 200)).kind).toBe('confirming')
      editor.cancelReplace()
      expect(editor.activeTool).toBe('adjust')
      expect(editor.previewAdjustments).toEqual(adjusted({ tint: 9 }))
    })
  })

  it('snapshots the applied Adjustments for the export', async () => {
    await open()
    editor.applyAdjustments(adjusted({ brightness: 12 }))
    expect(editor.beginExport()!.adjustments).toEqual(adjusted({ brightness: 12 }))
  })
})

describe('editor store — sampleWork for Auto (adjust ADR-0004)', () => {
  let decoder: ReturnType<typeof fakeDecoder>
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    decoder = fakeDecoder()
    editor = useEditorStore()
    editor.setDecoder(decoder.decode)
    editor.setCanvasSize(1000, 800)
  })

  async function open(width = 4000, height = 2000) {
    const pending = editor.openImage(file())
    decoder.answer(decoder.decode.mock.calls.length - 1, ok(decoded(width, height)))
    return pending
  }

  it('reports DISPLAY_LOST with no renderer or no Work', async () => {
    expect(editor.sampleWork()).toEqual({ ok: false, error: { code: 'DISPLAY_LOST' } })
    const fake = createFakeRenderer()
    editor.setRendererFactory(fake.factory)
    editor.createRenderer({} as HTMLCanvasElement)
    expect(editor.sampleWork()).toEqual({ ok: false, error: { code: 'DISPLAY_LOST' } })
    expect(fake.renderer.sampleCrop).not.toHaveBeenCalled()
  })

  it('samples the Work’s Geometry, not the open tool’s preview, at most 512 px', async () => {
    const fake = createFakeRenderer()
    editor.setRendererFactory(fake.factory)
    editor.createRenderer({} as HTMLCanvasElement)
    await open()
    const g = { ...identityGeometry({ width: 4000, height: 2000 }), flipH: true }
    editor.applyGeometry(g)
    editor.openTool('crop-rotate')
    editor.setPreviewGeometry({ ...g, flipV: true })

    const result = editor.sampleWork()
    expect(fake.renderer.sampleCrop).toHaveBeenCalledWith(g, 512)
    expect(result).toEqual(fake.renderer.sampleCrop.mock.results[0]!.value)
  })
})

describe('editor store — the draw tool in the slot (draw AC-12, AC-13, AC-15, AC-18)', () => {
  let decoder: ReturnType<typeof fakeDecoder>
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    decoder = fakeDecoder()
    editor = useEditorStore()
    editor.setDecoder(decoder.decode)
    editor.setCanvasSize(1000, 800)
  })

  async function open(width = 400, height = 200) {
    const pending = editor.openImage(file())
    decoder.answer(decoder.decode.mock.calls.length - 1, ok(decoded(width, height)))
    return pending
  }

  /** A Draft as the draw store hands it over: a canvas the size of the Original. */
  const draft = (width = 400, height = 200) =>
    ({ id: 'draft', width, height, pixels: { width, height } }) as unknown as Layer
  const released = (layer: Layer) => layer.pixels.width === 0

  it('opens without touching the View (AC-18)', async () => {
    await open()
    editor.zoomAt(2, { x: 300, y: 200 })
    editor.panBy(40, -25)
    const before = { ...editor.view }
    expect(editor.openTool('draw')).toEqual({ ok: true })
    expect(editor.view).toEqual(before)
    expect(editor.previewGeometry).toBeNull()
    editor.closeTool()
    expect(editor.view).toEqual(before)
  })

  it('setPreviewLayer shows the Draft while draw is open; closeTool clears it', async () => {
    await open()
    const layer = draft()
    editor.setPreviewLayer(layer)
    expect(editor.previewLayer).toBeNull()
    editor.openTool('draw')
    editor.setPreviewLayer(layer)
    expect(editor.previewLayer).toBe(layer)
    editor.closeTool()
    expect(editor.previewLayer).toBeNull()
  })

  it('setPreviewLayer hands the Draft to the renderer at once, before a Stroke paints it', async () => {
    const { factory, renderer } = createFakeRenderer()
    editor.setRendererFactory(factory)
    editor.createRenderer({} as HTMLCanvasElement)
    await open()
    editor.openTool('draw')
    const layer = draft()
    editor.setPreviewLayer(layer)
    // Synchronously: the Preview's watcher runs only after the first segment is painted, too late
    // to allocate the new, blank Draft without reading it back (spec §6 latency).
    expect(renderer.setLayer).toHaveBeenLastCalledWith(layer)
  })

  it('layerChanged forwards the dirty rectangle to the renderer', async () => {
    const { factory, renderer } = createFakeRenderer()
    editor.setRendererFactory(factory)
    editor.createRenderer({} as HTMLCanvasElement)
    await open()
    editor.layerChanged({ x: 1, y: 2, width: 3, height: 4 })
    expect(renderer.updateLayer).toHaveBeenCalledWith({ x: 1, y: 2, width: 3, height: 4 })
  })

  describe('applyDrawing (AC-12)', () => {
    it('stores the Draft with a new id and keeps the revision when nothing changed', async () => {
      await open()
      const layer = draft()
      editor.applyDrawing(layer, false)
      expect(editor.work!.drawing!.pixels).toBe(layer.pixels)
      expect(editor.work!.drawing!.id).not.toBe('draft')
      expect(editor.work!.drawing!.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(editor.hasUnsavedEdits).toBe(false)
      expect(released(layer)).toBe(false)
    })

    it('raises the revision when changed, also for a Clear to null', async () => {
      await open()
      editor.applyDrawing(draft(), true)
      expect(editor.work!.revision).toBe(1)
      editor.applyDrawing(null, true)
      expect(editor.work!.drawing).toBeNull()
      expect(editor.work!.revision).toBe(2)
    })

    it('releases the applied layer it replaces, but not one with the same canvas', async () => {
      await open()
      const first = draft()
      editor.applyDrawing(first, true)
      editor.applyDrawing({ ...editor.work!.drawing!, id: 'again' } as Layer, false)
      expect(released(first)).toBe(false)
      const second = draft()
      editor.applyDrawing(second, true)
      expect(released(first)).toBe(true)
      expect(released(second)).toBe(false)
    })

    it('is ignored during an export', async () => {
      await open()
      editor.beginExport()
      const layer = draft()
      expect(editor.applyDrawing(layer, true)).toBe(false) // the caller keeps the Draft
      expect(editor.work!.drawing).toBeNull()
      expect(editor.work!.revision).toBe(0)
    })

    it('says it applied', async () => {
      await open()
      expect(editor.applyDrawing(draft(), true)).toBe(true)
    })
  })

  it('snapshots the applied layer for the export (AC-10)', async () => {
    await open()
    expect(editor.beginExport()!.drawing).toBeNull()
    editor.finishExport(editor.beginExport()!, false)
    editor.applyDrawing(draft(), true)
    const snapshot = editor.beginExport()!
    expect(snapshot.drawing).toBe(editor.work!.drawing)
  })

  it('a successful replace closes draw, clears the preview and releases the old layer (AC-13)', async () => {
    await open()
    const applied = draft()
    editor.applyDrawing(applied, false)
    editor.openTool('draw')
    editor.setPreviewLayer(draft())
    await open(300, 300)
    expect(editor.activeTool).toBeNull()
    expect(editor.previewLayer).toBeNull()
    expect(editor.work!.drawing).toBeNull()
    expect(released(applied)).toBe(true)
  })

  it('keeps draw open with its preview while the replace waits for confirmation (AC-13)', async () => {
    await open()
    editor.applyDrawing(draft(), true)
    editor.openTool('draw')
    const layer = draft()
    editor.setPreviewLayer(layer)
    await open(300, 300)
    expect(editor.phase).toBe('confirming')
    expect(editor.activeTool).toBe('draw')
    expect(editor.previewLayer).toBe(layer)
    editor.cancelReplace()
    expect(editor.activeTool).toBe('draw')
  })
})
