import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, watch } from 'vue'
import {
  appError,
  err,
  fitView,
  flipOnScreen,
  identityGeometry,
  NEUTRAL_ADJUSTMENTS,
  ok,
  STORED_WORK_FORMAT,
  turnedBounds,
  workSize,
  type Adjustments,
  type AppError,
  type Geometry,
  type Result,
} from '@/core'
import type { LoadedWork, WorkRecord } from '@/infra/db'
import type { PixelSize } from '@/infra/work-codec'
import { SUPERSEDED, type DecodedImage, type DecodeOutcome } from '@/infra/image-decode'
import { useNotices } from '@/shared'
import { setLayerCanvasFactory, type CanvasFactory, type Layer } from '@/render'
import { createFakeCanvas, getPixel, type FakeCanvas } from '@/render/drawing/fake-canvas'
import { useEditorStore } from './store'
import { createFakeRenderer } from './fake-renderer'
import { createFakeAutosave } from './testing'

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

  it('a Geometry Apply keeps the applied layer itself: same object, id and pixels (AC-08)', async () => {
    await open()
    editor.applyDrawing(draft(), true)
    const applied = editor.work!.drawing!
    const { width, height } = editor.work!.original
    editor.applyGeometry({
      flipH: true,
      flipV: false,
      rotation: 90,
      straighten: 0,
      crop: { x: 0, y: 0, width: height, height: width },
    })
    expect(editor.work!.geometry.rotation).toBe(90)
    expect(editor.work!.drawing).toBe(applied) // never resampled or copied (draw ADR-0001)
    expect(released(applied)).toBe(false)
  })

  describe('applyDrawing (AC-12)', () => {
    it('stores a changed Draft with a new id', async () => {
      await open()
      const layer = draft()
      editor.applyDrawing(layer, true)
      expect(editor.work!.drawing!.pixels).toBe(layer.pixels)
      expect(editor.work!.drawing!.id).not.toBe('draft')
      expect(editor.work!.drawing!.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(released(layer)).toBe(false)
    })

    it('keeps the Work’s layer and releases the Draft when nothing changed (undo-redo sad §4)', async () => {
      await open()
      editor.applyDrawing(draft(), true)
      const applied = editor.work!.drawing!
      const copy = draft()
      expect(editor.applyDrawing(copy, false)).toBe(true)
      expect(editor.work!.drawing).toBe(applied)
      expect(editor.work!.revision).toBe(1)
      expect(released(copy)).toBe(true)
      expect(released(applied)).toBe(false)
    })

    it('releases nothing on an unchanged Apply of the Work’s own canvas', async () => {
      await open()
      editor.applyDrawing(draft(), true)
      const applied = editor.work!.drawing!
      editor.applyDrawing({ ...applied, id: 'again' } as Layer, false)
      expect(editor.work!.drawing).toBe(applied)
      expect(released(applied)).toBe(false)
    })

    it('raises the revision when changed, also for a Clear to null', async () => {
      await open()
      editor.applyDrawing(draft(), true)
      expect(editor.work!.revision).toBe(1)
      editor.applyDrawing(null, true)
      expect(editor.work!.drawing).toBeNull()
      expect(editor.work!.revision).toBe(2)
    })

    it('keeps the applied layer it replaces for Undo (undo-redo ADR-0002)', async () => {
      await open()
      const first = draft()
      editor.applyDrawing(first, true)
      const second = draft()
      editor.applyDrawing(second, true)
      expect(released(first)).toBe(false)
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
    editor.applyDrawing(applied, true)
    editor.finishExport(editor.beginExport()!, true)
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

describe('editor store — Edit history (undo-redo AC-04, AC-06, AC-09, AC-10)', () => {
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

  const draft = (width = 400, height = 200) =>
    ({ id: 'draft', width, height, pixels: { width, height } }) as unknown as Layer
  const released = (layer: Layer) => layer.pixels.width === 0
  const labels = () => editor.editHistory!.entries.map((e) => e.label)
  const turned = (): Geometry => ({ ...editor.work!.geometry, flipH: !editor.work!.geometry.flipH })

  it('starts an Edit history with only the state at open', async () => {
    await open()
    expect(labels()).toEqual([null])
    expect(editor.editHistory!.cursor).toBe(0)
  })

  it('records a Step only for an Apply that counts as an edit (AC-06)', async () => {
    await open()
    editor.applyAdjustments(NEUTRAL_ADJUSTMENTS)
    editor.applyGeometry({ ...editor.work!.geometry })
    editor.applyDrawing(null, false)
    editor.zoomAt(2, { x: 10, y: 10 })
    editor.panBy(5, 5)
    editor.openTool('adjust')
    editor.closeTool()
    editor.finishExport(editor.beginExport()!, true)
    expect(labels()).toEqual([null])
    expect(editor.work!.revision).toBe(0)

    editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 20 })
    editor.applyGeometry(turned())
    editor.applyDrawing(draft(), true)
    expect(labels()).toEqual([null, 'adjust', 'crop-rotate', 'draw'])
    expect(editor.work!.revision).toBe(3)
  })

  it('records the Work as each Apply left it', async () => {
    await open()
    editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 20 })
    const entry = editor.editHistory!.entries[1]!
    expect(entry.state.adjustments).toBe(editor.work!.adjustments)
    expect(entry.state.revision).toBe(editor.work!.revision)
  })

  it('applyEdit takes a fresh revision and records no Step', async () => {
    await open()
    editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 20 })
    editor.applyEdit()
    expect(editor.work!.revision).toBe(2)
    expect(labels()).toEqual([null, 'adjust'])
    expect(editor.editHistory!.entries[1]!.state.revision).toBe(2)
  })

  it('replacing the Work starts an empty history and releases every old layer (AC-10)', async () => {
    await open()
    const first = draft()
    const second = draft()
    editor.applyDrawing(first, true)
    editor.applyDrawing(second, true)
    const confirming = await open(300, 300)
    expect(confirming.kind).toBe('confirming')
    editor.confirmReplace()

    expect(labels()).toEqual([null])
    expect(editor.editHistory!.entries[0]!.state.revision).toBe(0)
    expect(released(first)).toBe(true)
    expect(released(second)).toBe(true)
  })

  it('a cancelled replace keeps the Work and its Edit history exactly as they were (AC-10)', async () => {
    await open()
    const layer = draft()
    editor.applyDrawing(layer, true)
    const history = editor.editHistory
    const work = editor.work
    await open(300, 300)
    editor.cancelReplace()

    expect(labels()).toEqual([null, 'draw'])
    expect(editor.editHistory).toBe(history)
    expect(editor.work).toBe(work)
    expect(released(layer)).toBe(false)
  })

  it('a later Step after a successful replace gets revision 1 of the new Work', async () => {
    await open()
    editor.applyEdit()
    editor.applyEdit()
    await open(300, 300)
    editor.confirmReplace()
    editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 5 })
    expect(editor.work!.revision).toBe(1)
  })
})

describe('editor store — Undo and Redo (undo-redo AC-03, AC-05, AC-07, AC-08, AC-09, AC-12)', () => {
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

  const draft = (width = 400, height = 200) =>
    ({ id: 'draft', width, height, pixels: { width, height } }) as unknown as Layer
  const cropTo = (width: number, height: number): Geometry => ({
    ...editor.work!.geometry,
    crop: { x: 0, y: 0, width, height },
  })
  const contrast = (value: number) => ({ ...NEUTRAL_ADJUSTMENTS, contrast: value })

  it('has nothing to undo or redo with no Work open (AC-05)', () => {
    expect(editor.canUndo).toBe(false)
    expect(editor.canRedo).toBe(false)
    expect(editor.undoTool).toBeNull()
    expect(editor.redoTool).toBeNull()
    expect(editor.historyStats).toEqual({ heldBytes: 0, steps: 0 })
    expect(editor.undo()).toBe(false)
    expect(editor.redo()).toBe(false)
  })

  it('has nothing to undo or redo right after an open (AC-05)', async () => {
    await open()
    expect([editor.canUndo, editor.canRedo, editor.undoTool, editor.redoTool]).toEqual([
      false,
      false,
      null,
      null,
    ])
    expect(editor.undo()).toBe(false)
  })

  it('restores each state’s very objects through three Undos and three Redos (AC-03)', async () => {
    await open()
    const atOpen = editor.work!
    editor.applyGeometry(cropTo(300, 200))
    const cropped = editor.work!
    editor.applyAdjustments(contrast(20))
    const adjusted = editor.work!
    editor.applyDrawing(draft(), true)
    const drawn = editor.work!
    expect([editor.undoTool, editor.redoTool]).toEqual(['draw', null])

    const same = (a: typeof atOpen, b: typeof atOpen) => {
      expect(a.geometry).toBe(b.geometry)
      expect(a.adjustments).toBe(b.adjustments)
      expect(a.drawing).toBe(b.drawing)
      expect(a.revision).toBe(b.revision)
      expect(a.original).toBe(b.original)
    }
    expect(editor.undo()).toBe(true)
    same(editor.work!, adjusted)
    expect([editor.undoTool, editor.redoTool]).toEqual(['adjust', 'draw'])
    editor.undo()
    same(editor.work!, cropped)
    editor.undo()
    same(editor.work!, atOpen)
    expect([editor.canUndo, editor.canRedo, editor.redoTool]).toEqual([false, true, 'crop-rotate'])

    editor.redo()
    same(editor.work!, cropped)
    editor.redo()
    same(editor.work!, adjusted)
    expect(editor.redo()).toBe(true)
    same(editor.work!, drawn)
    expect(editor.canRedo).toBe(false)
  })

  it('reports the Steps kept and the bytes they hold', async () => {
    await open()
    editor.applyDrawing(draft(), true)
    editor.applyDrawing(draft(), true)
    expect(editor.historyStats).toEqual({ heldBytes: 400 * 200 * 4, steps: 2 })
  })

  describe('refusals', () => {
    beforeEach(async () => {
      await open()
      editor.applyAdjustments(contrast(20))
      editor.applyAdjustments(contrast(30))
      editor.undo()
    })

    function expectRefused() {
      const work = editor.work
      const history = editor.editHistory
      expect([editor.canUndo, editor.canRedo, editor.undoTool, editor.redoTool]).toEqual([
        false,
        false,
        null,
        null,
      ])
      expect(editor.undo()).toBe(false)
      expect(editor.redo()).toBe(false)
      expect(editor.work).toBe(work)
      expect(editor.editHistory).toBe(history)
    }

    it('refuses while a tool is open, keeping its Draft, and works again after Cancel (AC-08)', () => {
      editor.openTool('adjust')
      editor.setPreviewAdjustments(contrast(50))
      expectRefused()
      expect(editor.previewAdjustments).toEqual(contrast(50))
      editor.closeTool()
      expect([editor.canUndo, editor.canRedo]).toEqual([true, true])
    })

    it('after an Apply following the refusal, the tool’s Step is the last one (AC-08)', () => {
      editor.openTool('adjust')
      editor.setPreviewAdjustments(contrast(50))
      expectRefused()
      editor.applyAdjustments(contrast(50))
      editor.closeTool()

      const history = editor.editHistory!
      expect(history.cursor).toBe(history.entries.length - 1)
      expect(history.entries.at(-1)!.label).toBe('adjust')
      expect([editor.undoTool, editor.canRedo]).toEqual(['adjust', false])
      expect(editor.undo()).toBe(true)
      expect(editor.work!.adjustments.contrast).toBe(20)
    })

    it('refuses during an export, not queued, and comes back with the same history (AC-07)', () => {
      const snapshot = editor.beginExport()!
      expectRefused()
      editor.finishExport(snapshot, false)
      expect([editor.undoTool, editor.redoTool]).toEqual(['adjust', 'adjust'])
      expect(editor.work!.adjustments.contrast).toBe(20)
    })

    it('refuses while the replace dialog is open', async () => {
      await open(300, 300)
      expect(editor.phase).toBe('confirming')
      expectRefused()
    })

    it('stays available while a new image is being read', () => {
      void editor.openImage(file())
      expect(editor.phase).toBe('reading')
      expect(editor.canUndo).toBe(true)
      expect(editor.undo()).toBe(true)
      expect(editor.work!.revision).toBe(0)
    })

    it('stays available under the open export panel', () => {
      editor.setActivePanel('export')
      expect(editor.redo()).toBe(true)
      expect(editor.work!.adjustments.contrast).toBe(30)
    })
  })

  describe('View (AC-06, AC-12)', () => {
    it('fits the View when an Undo or Redo changes the image’s size', async () => {
      await open()
      editor.applyGeometry(cropTo(200, 100))
      editor.zoomAt(2, { x: 300, y: 200 })
      editor.panBy(40, -25)
      editor.undo()
      const fitted = { ...editor.view }
      editor.fit()
      expect(fitted).toEqual(editor.view)
      editor.zoomAt(2, { x: 300, y: 200 })
      editor.redo()
      const refitted = { ...editor.view }
      editor.fit()
      expect(refitted).toEqual(editor.view)
    })

    it('keeps the View for an Undo or Redo that keeps the image’s size', async () => {
      await open()
      editor.applyAdjustments(contrast(20))
      editor.applyDrawing(draft(), true)
      editor.applyGeometry({ ...editor.work!.geometry, flipH: true })
      editor.zoomAt(2, { x: 300, y: 200 })
      editor.panBy(40, -25)
      const before = { ...editor.view }
      editor.undo()
      editor.undo()
      editor.undo()
      editor.redo()
      expect(editor.view).toEqual(before)
    })
  })

  it('a cancelled or failed export does not move the save point (AC-09)', async () => {
    await open()
    editor.applyAdjustments(contrast(10))
    editor.finishExport(editor.beginExport()!, true)
    editor.applyAdjustments(contrast(20))
    editor.finishExport(editor.beginExport()!, false) // cancelled or failed
    editor.applyAdjustments(contrast(30))

    editor.undo()
    expect(editor.work!.adjustments.contrast).toBe(20)
    expect(editor.hasUnsavedEdits).toBe(true)
    editor.undo()
    expect(editor.hasUnsavedEdits).toBe(false)
    editor.redo()
    expect(editor.hasUnsavedEdits).toBe(true)
  })

  it('replaces without confirmation after undoing to the save point (AC-09)', async () => {
    await open()
    editor.applyAdjustments(contrast(10))
    editor.applyAdjustments(contrast(20))
    editor.finishExport(editor.beginExport()!, true)
    editor.applyAdjustments(contrast(30))
    expect(editor.hasUnsavedEdits).toBe(true)
    editor.undo()
    expect(editor.hasUnsavedEdits).toBe(false)
    editor.undo()
    expect(editor.hasUnsavedEdits).toBe(true)
    editor.redo()
    expect((await open(300, 300)).kind).toBe('replaced')
    expect(editor.canUndo).toBe(false)
  })
})

describe('editor store — Autosave triggers and the replace gate (gallery AC-01, AC-02, AC-09, AC-12, AC-16, AC-17)', () => {
  let decoder: ReturnType<typeof fakeDecoder>
  let editor: ReturnType<typeof useEditorStore>
  let autosave: ReturnType<typeof createFakeAutosave>

  beforeEach(() => {
    setActivePinia(createPinia())
    decoder = fakeDecoder()
    autosave = createFakeAutosave()
    editor = useEditorStore()
    editor.setAutosave(autosave.fake)
    editor.setDecoder(decoder.decode)
    editor.setCanvasSize(1000, 800)
  })

  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
  }

  async function open(width = 400, height = 200) {
    const pending = editor.openImage(file())
    decoder.answer(decoder.decode.mock.calls.length - 1, ok(decoded(width, height)))
    return pending
  }

  const saved = () => autosave.spies.request.mock.calls.length
  const contrast = (value: number) => ({ ...NEUTRAL_ADJUSTMENTS, contrast: value })

  describe('what reaches Autosave (AC-01, AC-02, AC-09)', () => {
    it('hands over the new Work once, after a replace', async () => {
      await open()
      expect(saved()).toBe(1)
      expect(autosave.spies.request).toHaveBeenLastCalledWith(editor.work)
      await open(800, 600)
      expect(saved()).toBe(2)
      expect(autosave.spies.request).toHaveBeenLastCalledWith(editor.work)
    })

    it('hands over the Work after each applied change, undo and redo', async () => {
      await open()
      editor.applyAdjustments(contrast(20))
      expect(saved()).toBe(2)
      expect(autosave.spies.request).toHaveBeenLastCalledWith(editor.work)
      editor.applyGeometry({ ...editor.work!.geometry, flipH: true })
      expect(saved()).toBe(3)
      editor.applyDrawing(
        {
          id: 'd',
          width: 400,
          height: 200,
          pixels: { width: 400, height: 200 },
        } as unknown as Layer,
        true,
      )
      expect(saved()).toBe(4)
      editor.undo()
      expect(saved()).toBe(5)
      expect(autosave.spies.request).toHaveBeenLastCalledWith(editor.work)
      editor.redo()
      expect(saved()).toBe(6)
      expect(autosave.spies.request).toHaveBeenLastCalledWith(editor.work)
    })

    it('hands over nothing for the test-only edit, tools, Drafts, View or no-op Applies', async () => {
      await open()
      const before = saved()
      editor.applyEdit()
      editor.openTool('adjust')
      editor.setPreviewAdjustments(contrast(30))
      editor.applyAdjustments(NEUTRAL_ADJUSTMENTS)
      editor.closeTool()
      editor.openTool('crop-rotate')
      editor.closeTool()
      editor.zoomAt(2, { x: 10, y: 10 })
      editor.panBy(5, 5)
      editor.fit()
      editor.applyDrawing(null, false)
      expect(saved()).toBe(before)
    })

    it('hands over nothing for a refused or cancelled open', async () => {
      await open()
      editor.applyEdit()
      const before = saved()
      const refused = editor.openImage(file())
      decoder.answer(1, err(appError('UNSUPPORTED_FORMAT')))
      expect((await refused).kind).toBe('refused')
      expect(saved()).toBe(before)

      autosave.available(false)
      expect((await open(800, 600)).kind).toBe('confirming')
      editor.cancelReplace()
      expect(saved()).toBe(before)
    })

    it('hands over the new Work after a confirmed replace', async () => {
      autosave.available(false)
      await open()
      editor.applyEdit()
      await open(800, 600)
      const before = saved()
      editor.confirmReplace()
      expect(saved()).toBe(before + 1)
      expect(autosave.spies.request).toHaveBeenLastCalledWith(editor.work)
    })
  })

  describe('the replace gate (AC-16, AC-17)', () => {
    it('replaces without asking when the latest state is stored, and discards the Draft', async () => {
      await open()
      editor.applyAdjustments(contrast(20))
      autosave.markStored(editor.work!)
      editor.openTool('adjust')
      editor.setPreviewAdjustments(contrast(50))

      const outcome = await open(800, 600)

      expect(outcome).toMatchObject({ kind: 'replaced', image: { width: 800 } })
      expect(editor.phase).toBe('idle')
      expect(editor.activeTool).toBeNull()
    })

    it('waits for a running save, staying in reading, then replaces without asking', async () => {
      await open()
      editor.applyAdjustments(contrast(20))
      autosave.hold()
      const pending = open(800, 600)
      let done = false
      void pending.then(() => (done = true))
      await flush()

      expect(done).toBe(false)
      expect(editor.phase).toBe('reading')
      expect(editor.work!.original.width).toBe(400)

      autosave.markStored(editor.work!)
      autosave.release()
      expect((await pending).kind).toBe('replaced')
      expect(editor.phase).toBe('idle')
    })

    it('asks when the save that was running fails, and Cancel keeps Work, revision and Draft', async () => {
      await open()
      editor.applyAdjustments(contrast(20))
      editor.openTool('adjust')
      editor.setPreviewAdjustments(contrast(50))
      const before = { work: editor.work, revision: editor.work!.revision }
      autosave.hold()
      const pending = open(800, 600)
      await flush()

      autosave.release() // settled, but the latest state was never stored
      expect(await pending).toEqual({ kind: 'confirming' })
      expect(editor.phase).toBe('confirming')

      const pendingBitmap = editor.pending!.bitmap as FakeBitmap
      expect(editor.cancelReplace()).toEqual({ kind: 'cancelled' })
      expect(pendingBitmap.close).toHaveBeenCalled()
      expect(editor.work).toBe(before.work)
      expect(editor.work!.revision).toBe(before.revision)
      expect(editor.activeTool).toBe('adjust')
      expect(editor.previewAdjustments).toEqual(contrast(50))
    })

    it('asks when the latest state is not stored (an earlier save failed)', async () => {
      await open()
      editor.applyAdjustments(contrast(20))
      expect(await open(800, 600)).toEqual({ kind: 'confirming' })
      expect(editor.work!.original.width).toBe(400)
    })

    it('asks when the Work changed after the stored revision', async () => {
      await open()
      editor.applyAdjustments(contrast(20))
      autosave.markStored(editor.work!)
      editor.applyAdjustments(contrast(30))
      expect(await open(800, 600)).toEqual({ kind: 'confirming' })
    })

    it('asks whenever the Gallery is unavailable and there are Unsaved edits (AC-12)', async () => {
      autosave.available(false)
      await open()
      editor.applyAdjustments(contrast(20))
      autosave.markStored(editor.work!)
      expect(await open(800, 600)).toEqual({ kind: 'confirming' })
      expect(editor.cancelReplace()).toEqual({ kind: 'cancelled' })
    })

    it('replaces without asking when there are no Unsaved edits, whatever the save state', async () => {
      await open()
      expect(editor.hasUnsavedEdits).toBe(false)
      expect((await open(800, 600)).kind).toBe('replaced')
      autosave.available(false)
      expect((await open(300, 200)).kind).toBe('replaced')
    })

    it('does not wait or ask for a refused file', async () => {
      await open()
      editor.applyAdjustments(contrast(20))
      autosave.spies.settled.mockClear()
      const refused = editor.openImage(file())
      decoder.answer(1, err(appError('UNSUPPORTED_FORMAT')))
      expect((await refused).kind).toBe('refused')
      expect(autosave.spies.settled).not.toHaveBeenCalled()
      expect(editor.phase).toBe('idle')
    })

    it('a newer open supersedes one waiting for the save, whose bitmap is closed', async () => {
      await open()
      editor.applyAdjustments(contrast(20))
      autosave.hold()
      const older = editor.openImage(file())
      const olderImage = decoded(800, 600)
      decoder.answer(1, ok(olderImage))
      await flush()
      const newer = editor.openImage(file())
      decoder.answer(2, ok(decoded(300, 200)))
      await flush()

      autosave.markStored(editor.work!)
      autosave.release()

      expect(await older).toEqual({ kind: 'superseded' })
      expect(olderImage.bitmap.close).toHaveBeenCalled()
      expect(await newer).toMatchObject({ kind: 'replaced', image: { width: 300 } })
    })
  })

  describe('exposed state', () => {
    it('mirrors saving, galleryAvailable and the open Work id', async () => {
      expect(editor.openWorkId).toBeNull()
      expect(editor.saving).toBe(false)
      await open()
      expect(editor.openWorkId).toBe(editor.work!.id)
      autosave.hold()
      expect(editor.saving).toBe(true)
      autosave.release()
      expect(editor.saving).toBe(false)
      expect(editor.galleryAvailable).toBe(true)
      autosave.available(false)
      expect(editor.galleryAvailable).toBe(false)
    })

    it('forwards connectGallery to Autosave', () => {
      const result = ok({}) as unknown as Parameters<typeof editor.connectGallery>[0]
      editor.connectGallery(result)
      expect(autosave.spies.connectGallery).toHaveBeenCalledWith(result)
    })

    describe('a Work opened before the Gallery connects (S1-8)', () => {
      const dbOk = () => ok({}) as unknown as Parameters<typeof editor.connectGallery>[0]

      it('is handed to Autosave once when the connection arrives', async () => {
        await open()
        autosave.spies.request.mockClear()
        editor.connectGallery(dbOk())
        expect(saved()).toBe(1)
        expect(autosave.spies.request).toHaveBeenLastCalledWith(editor.work)
      })

      it('requests nothing when no Work is open at connect time', () => {
        editor.connectGallery(dbOk())
        expect(saved()).toBe(0)
      })

      it('requests nothing when the connection is unavailable', async () => {
        await open()
        autosave.spies.request.mockClear()
        editor.connectGallery(err(appError('STORAGE_UNAVAILABLE', { reason: 'refused' })))
        expect(saved()).toBe(0)
      })
    })

    it('lets the Gallery take the active panel', () => {
      editor.setActivePanel('gallery')
      expect(editor.activePanel).toBe('gallery')
    })

    it('has no Gallery until one is connected, so it still always asks (AC-12)', async () => {
      setActivePinia(createPinia())
      decoder = fakeDecoder()
      editor = useEditorStore()
      editor.setDecoder(decoder.decode)
      editor.setCanvasSize(1000, 800)
      expect(editor.galleryAvailable).toBe(false)
      await open()
      editor.applyEdit()
      expect(await open(800, 600)).toEqual({ kind: 'confirming' })
    })
  })
})

describe('editor store — reopenWork (gallery AC-02, AC-04, AC-08, AC-15, AC-17)', () => {
  let decoder: ReturnType<typeof fakeDecoder>
  let editor: ReturnType<typeof useEditorStore>
  let autosave: ReturnType<typeof createFakeAutosave>
  let restoreFactory: CanvasFactory
  const loadWork = vi.fn<(id: string) => Promise<Result<LoadedWork, AppError>>>()
  const decodePng = vi.fn<(blob: Blob, size: PixelSize) => Promise<Result<ImageBitmap, AppError>>>()

  type FakeCanvasBitmap = FakeCanvas & { close: ReturnType<typeof vi.fn> }
  const originalPng = new Blob(['original'])
  const layerPng = new Blob(['layer'])
  const layerBitmap = () => Object.assign(createFakeCanvas(400, 200), { close: vi.fn() })
  let decodedBitmaps: (FakeBitmap | FakeCanvasBitmap)[]

  const adjustments = { ...NEUTRAL_ADJUSTMENTS, contrast: 20, exposure: -15 }
  const geometry = (): Geometry => ({
    ...identityGeometry({ width: 400, height: 200 }),
    flipH: true,
    straighten: 5,
    crop: { x: 20, y: 10, width: 300, height: 150 },
  })

  function stored(extra: Partial<WorkRecord> = {}): LoadedWork {
    return {
      record: {
        id: 'stored-1',
        sourceName: 'holiday',
        sourceFormat: 'png',
        touchedAt: 1_700_000_000_000,
        width: 400,
        height: 200,
        hasTransparency: true,
        geometry: geometry(),
        adjustments,
        layerId: 'stored-layer',
        thumbnail: new Blob(['t']),
        formatVersion: STORED_WORK_FORMAT,
        ...extra,
      },
      original: originalPng,
      layer: extra.layerId === null ? null : layerPng,
    }
  }

  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    decoder = fakeDecoder()
    autosave = createFakeAutosave()
    editor = useEditorStore()
    editor.setAutosave(autosave.fake)
    editor.setDecoder(decoder.decode)
    editor.setCanvasSize(1000, 800)
    restoreFactory = setLayerCanvasFactory((w, h) => createFakeCanvas(w, h) as never)
    decodedBitmaps = []
    loadWork.mockReset()
    decodePng.mockReset()
    loadWork.mockImplementation(async () => ok(stored()))
    decodePng.mockImplementation(async (blob) => {
      const made = blob === layerPng ? layerBitmap() : bitmap(400, 200)
      decodedBitmaps.push(made)
      return ok(made as unknown as ImageBitmap)
    })
    // Pinned API: the store reads a Work through an injected loader and the codec's decodePng.
    editor.setReopenSource({ loadWork, decodePng })
  })

  afterEach(() => {
    setLayerCanvasFactory(restoreFactory)
  })

  async function open(width = 100, height = 100) {
    const pending = editor.openImage(file())
    decoder.answer(decoder.decode.mock.calls.length - 1, ok(decoded(width, height)))
    return pending
  }

  const requests = () => autosave.spies.request.mock.calls.length
  const closed = (b: FakeBitmap | FakeCanvasBitmap) => b.close.mock.calls.length > 0

  describe('a readable Work replaces the open one (AC-04, AC-02)', () => {
    it('keeps the stored id, Source, Geometry and Adjustments, with a clean revision and a new layer id', async () => {
      await open()
      const outcome = await editor.reopenWork('stored-1')

      expect(outcome).toEqual({ kind: 'replaced' })
      const work = editor.work!
      expect(work.id).toBe('stored-1')
      expect(work.sourceName).toBe('holiday')
      expect(work.sourceFormat).toBe('png')
      expect(work.original).toMatchObject({ width: 400, height: 200, hasTransparency: true })
      expect(work.original.pixels).toBe(decodedBitmaps[0])
      expect(work.geometry).toEqual(geometry())
      expect(work.adjustments).toEqual(adjustments)
      expect(work.revision).toBe(work.cleanRevision)
      expect(editor.hasUnsavedEdits).toBe(false)
      expect(work.createdAt).toBe(1_700_000_000_000)
      expect(work.updatedAt).toBe(1_700_000_000_000)
      expect(editor.openWorkId).toBe('stored-1')
      expect(editor.phase).toBe('idle')
    })

    it('decodes both PNGs at the recorded size and draws the layer into a new layer', async () => {
      await open()
      const marked = layerBitmap()
      marked.getContext('2d').putImageData(
        {
          width: 1,
          height: 1,
          data: new Uint8ClampedArray([9, 8, 7, 255]),
        } as ImageData,
        3,
        4,
      )
      decodePng.mockImplementation(async (blob) => {
        const made = blob === layerPng ? marked : bitmap(400, 200)
        decodedBitmaps.push(made)
        return ok(made as unknown as ImageBitmap)
      })

      await editor.reopenWork('stored-1')

      expect(decodePng).toHaveBeenCalledWith(originalPng, { width: 400, height: 200 })
      expect(decodePng).toHaveBeenCalledWith(layerPng, { width: 400, height: 200 })
      const drawing = editor.work!.drawing!
      expect(drawing.id).not.toBe('stored-layer')
      expect(drawing).toMatchObject({ width: 400, height: 200 })
      expect(drawing.pixels).not.toBe(marked)
      expect(getPixel(drawing.pixels as never, 3, 4)).toEqual([9, 8, 7, 255])
      // The decoded layer bitmap is spent once drawn.
      expect(marked.close).toHaveBeenCalled()
    })

    it('a record without a layer gives a Work without a drawing and decodes only the Original', async () => {
      loadWork.mockResolvedValue(ok(stored({ layerId: null })))
      await open()
      expect(await editor.reopenWork('stored-1')).toEqual({ kind: 'replaced' })
      expect(editor.work!.drawing).toBeNull()
      expect(decodePng).toHaveBeenCalledTimes(1)
    })

    it('starts an empty Edit history (AC-02)', async () => {
      await open()
      editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 5 })
      autosave.markStored(editor.work!)
      expect(editor.canUndo).toBe(true)

      await editor.reopenWork('stored-1')

      expect(editor.canUndo).toBe(false)
      expect(editor.canRedo).toBe(false)
      expect(editor.undo()).toBe(false)
    })

    it('fits the View, not the zoom of the Work it replaces (AC-02)', async () => {
      await open()
      editor.zoomAt(4, { x: 100, y: 100 })
      editor.panBy(30, 30)
      expect(editor.view.zoom).toBeGreaterThan(1)

      await editor.reopenWork('stored-1')

      const expected = fitView({
        image: workSize(editor.work!),
        canvas: { width: 1000, height: 800 },
      })
      expect(editor.view).toEqual(expected)
      expect(editor.view.autoFit).toBe(true)
    })

    it('discards an open tool and its Draft (AC-02)', async () => {
      await open()
      editor.openTool('adjust')
      editor.setPreviewAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 50 })
      autosave.markStored(editor.work!)

      await editor.reopenWork('stored-1')

      expect(editor.activeTool).toBeNull()
      expect(editor.previewAdjustments).toBeNull()
    })

    it('works with no Work open yet', async () => {
      expect(await editor.reopenWork('stored-1')).toEqual({ kind: 'replaced' })
      expect(editor.work!.id).toBe('stored-1')
    })

    it('closes the Original it replaces once the new Work is picked up', async () => {
      await open()
      const old = editor.work!.original.pixels as unknown as FakeBitmap
      autosave.markStored(editor.work!)
      await editor.reopenWork('stored-1')
      await nextTick()
      expect(old.close).toHaveBeenCalled()
    })

    it('hands the loaded Blobs and the new layer id to Autosave, then queues a save', async () => {
      await open()
      const before = requests()

      await editor.reopenWork('stored-1')

      expect(autosave.spies.keepEncoded).toHaveBeenCalledWith('stored-1', {
        original: originalPng,
        layer: layerPng,
        layerId: editor.work!.drawing!.id,
      })
      expect(requests()).toBe(before + 1)
      expect(autosave.spies.request).toHaveBeenLastCalledWith(editor.work)
    })

    it('hands over a null layer and layer id for a Work without a drawing', async () => {
      loadWork.mockResolvedValue(ok(stored({ layerId: null })))
      await editor.reopenWork('stored-1')
      expect(autosave.spies.keepEncoded).toHaveBeenCalledWith('stored-1', {
        original: originalPng,
        layer: null,
        layerId: null,
      })
    })

    it('chosen Work already open: nothing is read or replaced', async () => {
      await editor.reopenWork('stored-1')
      const work = editor.work
      loadWork.mockClear()
      const before = requests()

      expect(await editor.reopenWork('stored-1')).toEqual({ kind: 'already-open' })

      expect(loadWork).not.toHaveBeenCalled()
      expect(editor.work).toBe(work)
      expect(requests()).toBe(before)
    })
  })

  describe('a Work that cannot be read changes nothing (AC-08, AC-17)', () => {
    async function expectUnchanged(run: () => Promise<unknown>) {
      await open()
      editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 5 })
      editor.zoomAt(2, { x: 50, y: 50 })
      const work = editor.work
      const view = { ...editor.view }
      const before = requests()

      const outcome = await run()

      expect(outcome).toMatchObject({ kind: 'damaged', error: { code: 'WORK_DAMAGED' } })
      expect(editor.work).toBe(work)
      expect(editor.view).toEqual(view)
      expect(editor.canUndo).toBe(true)
      expect(editor.phase).toBe('idle')
      expect(requests()).toBe(before)
      expect(autosave.spies.keepEncoded).not.toHaveBeenCalled()
    }

    it('loadWork fails, even with Unsaved edits that are not stored: no confirmation', async () => {
      loadWork.mockResolvedValue(err(appError('WORK_DAMAGED', { reason: 'missing-original' })))
      await expectUnchanged(() => editor.reopenWork('stored-1'))
    })

    it('an invalid record (unknown formatVersion) is damaged and decodes nothing', async () => {
      loadWork.mockResolvedValue(ok(stored({ formatVersion: STORED_WORK_FORMAT + 1 })))
      await expectUnchanged(() => editor.reopenWork('stored-1'))
      expect(decodePng).not.toHaveBeenCalled()
    })

    it('a record with a layer id but no layer Blob is damaged', async () => {
      loadWork.mockResolvedValue(ok({ ...stored(), layer: null }))
      await expectUnchanged(() => editor.reopenWork('stored-1'))
    })

    it('a bad Geometry is damaged', async () => {
      const bad = stored()
      bad.record.geometry = { ...geometry(), crop: { x: 0, y: 0, width: 9999, height: 150 } }
      loadWork.mockResolvedValue(ok(bad))
      await expectUnchanged(() => editor.reopenWork('stored-1'))
    })

    it('a layer that fails to decode is damaged and the decoded Original is closed', async () => {
      decodePng.mockImplementation(async (blob) => {
        if (blob === layerPng) return err(appError('WORK_DAMAGED', { reason: 'size' }))
        const made = bitmap(400, 200)
        decodedBitmaps.push(made)
        return ok(made as unknown as ImageBitmap)
      })
      await expectUnchanged(() => editor.reopenWork('stored-1'))
      expect(closed(decodedBitmaps[0]!)).toBe(true)
    })

    it('an Original that fails to decode is damaged and the decoded layer is closed', async () => {
      decodePng.mockImplementation(async (blob) => {
        if (blob !== layerPng) return err(appError('WORK_DAMAGED', { reason: 'size' }))
        const made = layerBitmap()
        decodedBitmaps.push(made)
        return ok(made as unknown as ImageBitmap)
      })
      await expectUnchanged(() => editor.reopenWork('stored-1'))
      expect(closed(decodedBitmaps[0]!)).toBe(true)
    })

    it('a loader that reports a storage failure is not a replacement either', async () => {
      loadWork.mockResolvedValue(err(appError('STORAGE_FAILED')))
      await open()
      const work = editor.work
      const outcome = await editor.reopenWork('stored-1')
      expect(outcome.kind).toBe('damaged')
      expect(editor.work).toBe(work)
      expect(editor.phase).toBe('idle')
    })
  })

  describe('refused while exporting or confirming (AC-15)', () => {
    it('is refused while exporting: nothing is read and the Work is unchanged', async () => {
      await open()
      const work = editor.work
      editor.beginExport()

      expect(await editor.reopenWork('stored-1')).toEqual({ kind: 'refused', reason: 'exporting' })

      expect(loadWork).not.toHaveBeenCalled()
      expect(editor.work).toBe(work)
      expect(editor.phase).toBe('exporting')
    })

    it('is refused while a replacement waits for confirmation, and the waiting one stays', async () => {
      autosave.available(false)
      await open()
      editor.applyEdit()
      expect((await open(800, 600)).kind).toBe('confirming')
      const work = editor.work

      expect(await editor.reopenWork('stored-1')).toEqual({
        kind: 'refused',
        reason: 'confirming',
      })

      expect(loadWork).not.toHaveBeenCalled()
      expect(editor.phase).toBe('confirming')
      expect(editor.pending).not.toBeNull()
      expect(editor.work).toBe(work)
    })

    it('is not queued: a reopen refused during an export never runs once it ends', async () => {
      await open()
      const work = editor.work
      const snapshot = editor.beginExport()!
      expect((await editor.reopenWork('stored-1')).kind).toBe('refused')

      editor.finishExport(snapshot, false)
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(loadWork).not.toHaveBeenCalled()
      expect(editor.work).toBe(work)
      expect(editor.phase).toBe('idle')
    })
  })

  describe('the replace gate (AC-17)', () => {
    async function dirty() {
      autosave.available(false)
      await open()
      editor.applyEdit()
      return editor.work!
    }

    it('asks first when the Gallery is unavailable and edits are unsaved; cancel keeps the Work', async () => {
      const work = await dirty()

      expect(await editor.reopenWork('stored-1')).toEqual({ kind: 'confirming' })

      expect(editor.phase).toBe('confirming')
      expect(editor.work).toBe(work)
      const bitmaps = [...decodedBitmaps]
      expect(editor.cancelReplace()).toEqual({ kind: 'cancelled' })
      expect(editor.work).toBe(work)
      expect(editor.phase).toBe('idle')
      for (const b of bitmaps) expect(closed(b)).toBe(true)
      expect(autosave.spies.keepEncoded).not.toHaveBeenCalled()
    })

    it('confirming replaces with the stored Work, its Blobs kept and a save queued', async () => {
      await dirty()
      await editor.reopenWork('stored-1')
      const before = requests()

      expect(editor.confirmReplace()).toMatchObject({ kind: 'replaced' })

      expect(editor.work!.id).toBe('stored-1')
      expect(editor.work!.revision).toBe(editor.work!.cleanRevision)
      expect(editor.canUndo).toBe(false)
      expect(autosave.spies.keepEncoded).toHaveBeenCalledWith(
        'stored-1',
        expect.objectContaining({ original: originalPng, layer: layerPng }),
      )
      expect(requests()).toBe(before + 1)
    })

    it('asks when the open Work’s latest edit is not stored although the Gallery is available', async () => {
      await open()
      editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 5 })
      expect(await editor.reopenWork('stored-1')).toEqual({ kind: 'confirming' })
    })

    it('replaces without asking when the latest edit is stored', async () => {
      await open()
      editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 5 })
      autosave.markStored(editor.work!)
      expect(await editor.reopenWork('stored-1')).toEqual({ kind: 'replaced' })
    })

    it('waits for a running save before deciding, staying in reading', async () => {
      await open()
      editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 5 })
      autosave.hold()
      const pending = editor.reopenWork('stored-1')
      let done = false
      void pending.then(() => (done = true))
      await flush()

      expect(done).toBe(false)
      expect(editor.phase).toBe('reading')
      expect(editor.work!.id).not.toBe('stored-1')

      autosave.markStored(editor.work!)
      autosave.release()
      expect(await pending).toEqual({ kind: 'replaced' })
    })

    it('a save that failed while waiting asks for confirmation', async () => {
      await open()
      editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 5 })
      autosave.hold()
      const pending = editor.reopenWork('stored-1')
      await flush()
      autosave.release()
      expect(await pending).toEqual({ kind: 'confirming' })
    })
  })

  describe('latest open wins', () => {
    it('an older reopen superseded by a newer one returns superseded and closes its bitmaps', async () => {
      await open()
      const releaseFirst: { go: () => void } = { go: () => {} }
      loadWork.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst.go = () => resolve(ok(stored()))
          }),
      )
      const older = editor.reopenWork('stored-1')
      loadWork.mockResolvedValueOnce(ok(stored({ id: 'stored-2', sourceName: 'newer' })))
      const newer = editor.reopenWork('stored-2')
      expect(await newer).toEqual({ kind: 'replaced' })

      releaseFirst.go()
      expect(await older).toEqual({ kind: 'superseded' })

      expect(editor.work!.id).toBe('stored-2')
      expect(editor.phase).toBe('idle')
      for (const b of decodedBitmaps.slice(0, -2)) expect(closed(b)).toBe(true)
    })

    it('an open that starts while a reopen reads wins; the reopen is superseded', async () => {
      let finish: () => void = () => {}
      loadWork.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = () => resolve(ok(stored()))
          }),
      )
      const reopen = editor.reopenWork('stored-1')
      const opened = editor.openImage(file())
      decoder.answer(0, ok(decoded(100, 100)))
      expect((await opened).kind).toBe('replaced')
      finish()
      expect(await reopen).toEqual({ kind: 'superseded' })
      expect(editor.work!.id).not.toBe('stored-1')
      for (const b of decodedBitmaps) expect(closed(b)).toBe(true)
    })

    it('leaves no decoded bitmap retained after reopens and a failure', async () => {
      await editor.reopenWork('stored-1')
      await editor.reopenWork('stored-1')
      loadWork.mockResolvedValueOnce(ok(stored({ id: 'stored-2' })))
      await editor.reopenWork('stored-2')
      loadWork.mockResolvedValueOnce(err(appError('WORK_DAMAGED')))
      await editor.reopenWork('stored-3')
      await nextTick()
      const open = decodedBitmaps.filter((b) => !closed(b))
      // Only the open Work's Original stays alive; every layer bitmap was closed after drawing.
      expect(open).toHaveLength(1)
      expect(open[0]).toBe(editor.work!.original.pixels)
    })
  })
})

describe('editor store — the Reload gate (pwa-install-update AC-07, AC-10 to AC-13, ADR-0004)', () => {
  let decoder: ReturnType<typeof fakeDecoder>
  let editor: ReturnType<typeof useEditorStore>
  let autosave: ReturnType<typeof createFakeAutosave>

  beforeEach(() => {
    setActivePinia(createPinia())
    decoder = fakeDecoder()
    autosave = createFakeAutosave()
    editor = useEditorStore()
    editor.setAutosave(autosave.fake)
    editor.setDecoder(decoder.decode)
    editor.setCanvasSize(1000, 800)
  })

  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
  }

  async function open(width = 400, height = 200) {
    const pending = editor.openImage(file())
    decoder.answer(decoder.decode.mock.calls.length - 1, ok(decoded(width, height)))
    return pending
  }

  const contrast = (value: number) => ({ ...NEUTRAL_ADJUSTMENTS, contrast: value })

  it('is ready with no reopenId when no Work is open (AC-07)', async () => {
    expect(await editor.requestReload()).toEqual({ kind: 'ready', reopenId: null })
  })

  it('is ready with the Work id when its latest state is stored (AC-07)', async () => {
    await open()
    editor.applyAdjustments(contrast(20))
    autosave.markStored(editor.work!)

    expect(await editor.requestReload()).toEqual({ kind: 'ready', reopenId: editor.work!.id })
  })

  it('is ready with no reopenId for a Work without Unsaved edits that was never stored', async () => {
    await open()
    expect(await editor.requestReload()).toEqual({ kind: 'ready', reopenId: null })
  })

  it('refuses with tool-open while a tool is open, and changes nothing (AC-10)', async () => {
    await open()
    editor.openTool('adjust')
    editor.setPreviewAdjustments(contrast(50))

    expect(await editor.requestReload()).toEqual({ kind: 'tool-open' })
    expect(editor.activeTool).toBe('adjust')
    expect(editor.previewAdjustments).toEqual(contrast(50))
    expect(editor.phase).toBe('idle')
    expect(useNotices().items).toEqual([])
  })

  it('refuses with exporting while an Export runs (AC-13)', async () => {
    await open()
    const snapshot = editor.beginExport()!
    expect(await editor.requestReload()).toEqual({ kind: 'exporting' })
    expect(editor.phase).toBe('exporting')
    editor.finishExport(snapshot, false)
    expect((await editor.requestReload()).kind).toBe('ready')
  })

  it('asks for confirmation with no reopenId when the edits were never stored (AC-12)', async () => {
    autosave.available(false)
    await open()
    editor.applyAdjustments(contrast(20))

    expect(await editor.requestReload()).toEqual({ kind: 'confirm', reopenId: null })
    expect(editor.phase).toBe('idle')
  })

  it('asks for confirmation with the Work id when the latest edits are not stored after an earlier save (AC-12)', async () => {
    await open()
    editor.applyAdjustments(contrast(20))
    autosave.markStored(editor.work!)
    editor.applyAdjustments(contrast(30))

    expect(await editor.requestReload()).toEqual({ kind: 'confirm', reopenId: editor.work!.id })
  })

  it('carries the id of a Work reopened from the Gallery', async () => {
    await open()
    autosave.spies.keepEncoded(editor.work!.id, {
      original: new Blob(),
      layer: null,
      layerId: null,
    })
    expect(await editor.requestReload()).toEqual({ kind: 'ready', reopenId: editor.work!.id })
  })

  it('waits for a running save, then is ready once it stored the edits (AC-11)', async () => {
    await open()
    editor.applyAdjustments(contrast(20))
    autosave.hold()
    const pending = editor.requestReload()
    let done = false
    void pending.then(() => (done = true))
    await flush()
    expect(done).toBe(false)

    autosave.markStored(editor.work!)
    autosave.release()
    expect(await pending).toEqual({ kind: 'ready', reopenId: editor.work!.id })
  })

  it('checks again after the save: a tool opened during the wait refuses (AC-11)', async () => {
    await open()
    editor.applyAdjustments(contrast(20))
    autosave.hold()
    const pending = editor.requestReload()
    await flush()
    editor.openTool('adjust')
    autosave.markStored(editor.work!)
    autosave.release()

    expect(await pending).toEqual({ kind: 'tool-open' })
  })

  it('checks again after the save: an Export started during the wait refuses (AC-11)', async () => {
    await open()
    editor.applyAdjustments(contrast(20))
    autosave.hold()
    const pending = editor.requestReload()
    await flush()
    editor.beginExport()
    autosave.markStored(editor.work!)
    autosave.release()

    expect(await pending).toEqual({ kind: 'exporting' })
  })

  it('checks again after the save: a save that failed asks for confirmation (AC-11, AC-12)', async () => {
    await open()
    editor.applyAdjustments(contrast(20))
    autosave.hold()
    const pending = editor.requestReload()
    await flush()
    autosave.release()

    expect(await pending).toEqual({ kind: 'confirm', reopenId: null })
  })

  it('is ignored when an open starts while it waits for the save', async () => {
    await open()
    editor.applyAdjustments(contrast(20))
    autosave.hold()
    const pending = editor.requestReload()
    await flush()
    void editor.openImage(file())
    autosave.markStored(editor.work!)
    autosave.release()

    expect(await pending).toEqual({ kind: 'ignored' })
  })

  it('is ignored while an image is being read', async () => {
    await open()
    void editor.openImage(file())
    expect(editor.phase).toBe('reading')

    expect(await editor.requestReload()).toEqual({ kind: 'ignored' })
    expect(autosave.spies.settled).toHaveBeenCalledTimes(1)
  })

  it('is ignored while the Replace confirmation is up', async () => {
    autosave.available(false)
    await open()
    editor.applyAdjustments(contrast(20))
    expect(await open(800, 600)).toEqual({ kind: 'confirming' })

    expect(await editor.requestReload()).toEqual({ kind: 'ignored' })
    expect(editor.phase).toBe('confirming')
  })
})
