import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import {
  appError,
  createWork,
  err,
  identityGeometry,
  NEUTRAL_ADJUSTMENTS,
  ok,
  type AppError,
  type Geometry,
  type ImageFormat,
  type Result,
} from '@/core'
import { useEditorStore } from '@/features/editor'
import type { SaveFileHandle } from '@/infra/platform'
import type { AlphaRequest, ExportRequest, FormatAvailabilityCheck } from '@/render'
import { bitmapLedger, useNotices } from '@/shared'
import { useExportStore, type SavePlatform } from './store'

type Checker = () => Promise<FormatAvailabilityCheck>

function deferredChecker() {
  let resolve!: (value: FormatAvailabilityCheck) => void
  const checker = vi.fn<Checker>(() => new Promise<FormatAvailabilityCheck>((r) => (resolve = r)))
  return { checker, answer: (value: FormatAvailabilityCheck) => resolve(value) }
}

const ALL: FormatAvailabilityCheck = { png: true, jpeg: true, webp: true }

let ids = 0
function openWork(
  editor: ReturnType<typeof useEditorStore>,
  opts: {
    width?: number
    height?: number
    sourceName?: string
    sourceFormat?: ImageFormat
    hasTransparency?: boolean
  } = {},
) {
  const bitmap = { width: opts.width ?? 4096, height: opts.height ?? 3072, close() {} }
  editor.work = createWork(
    {
      width: bitmap.width,
      height: bitmap.height,
      pixels: bitmap as unknown as ImageBitmap,
      hasTransparency: opts.hasTransparency ?? false,
    },
    `w-${++ids}`,
    { sourceName: opts.sourceName ?? 'IMG_4021', sourceFormat: opts.sourceFormat ?? 'jpeg' },
  )
}

const flush = async () => {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
}

describe('export store — format check and defaults (AC-12, AC-19)', () => {
  let editor: ReturnType<typeof useEditorStore>
  let store: ReturnType<typeof useExportStore>
  let check: ReturnType<typeof deferredChecker>

  beforeEach(() => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    store = useExportStore()
    check = deferredChecker()
    store.setFormatChecker(check.checker)
    store.setSaveDialogProbe(() => true)
  })

  it('starts the format check once, on the first open of the session', async () => {
    await flush()
    expect(check.checker).not.toHaveBeenCalled()
    expect(store.availability).toEqual({ png: true, jpeg: 'checking', webp: 'checking' })

    openWork(editor)
    await flush()
    openWork(editor)
    await flush()
    expect(check.checker).toHaveBeenCalledTimes(1)

    check.answer({ png: true, jpeg: true, webp: false })
    await flush()
    expect(store.availability).toEqual({ png: true, jpeg: true, webp: false })
  })

  it('presets the Source format once the check has confirmed it', async () => {
    openWork(editor, { sourceFormat: 'webp' })
    await flush()
    check.answer(ALL)
    await flush()
    expect(store.openPanel()).toBe(true)
    expect(store.panelOpen).toBe(true)
    expect(store.format).toBe('webp')
    expect(store.quality).toBe(90)
    expect(store.sizeChoice).toEqual({ kind: 'preset', percent: 100 })
  })

  it.each<ImageFormat>(['heic', 'avif', 'gif'])('presets PNG for a %s Work', async (format) => {
    openWork(editor, { sourceFormat: format })
    await flush()
    check.answer(ALL)
    await flush()
    store.openPanel()
    expect(store.format).toBe('png')
  })

  it('presets PNG before the check finishes and never switches by itself', async () => {
    openWork(editor, { sourceFormat: 'jpeg' })
    await flush()
    store.openPanel()
    expect(store.format).toBe('png')

    check.answer(ALL)
    await flush()
    expect(store.format).toBe('png')
    store.closePanel()
    store.openPanel()
    expect(store.format).toBe('png')
  })

  it('refuses to select a format that is checking or unavailable', async () => {
    openWork(editor)
    await flush()
    store.openPanel()
    store.selectFormat('jpeg')
    expect(store.format).toBe('png')

    check.answer({ png: true, jpeg: true, webp: false })
    await flush()
    store.selectFormat('webp')
    expect(store.format).toBe('png')
    store.selectFormat('jpeg')
    expect(store.format).toBe('jpeg')
  })

  it('counts a check that rejects as both lossy formats unavailable', async () => {
    store.setFormatChecker(() => Promise.reject(new Error('boom')))
    openWork(editor)
    await flush()
    expect(store.availability).toEqual({ png: true, jpeg: false, webp: false })
  })

  it('does not open the panel with no Work', () => {
    expect(store.openPanel()).toBe(false)
    expect(store.panelOpen).toBe(false)
  })

  it('shows the checking and unavailable hints per format', async () => {
    openWork(editor)
    await flush()
    expect(store.formatHints).toEqual({
      jpeg: 'Checking this browser…',
      webp: 'Checking this browser…',
    })
    check.answer({ png: true, jpeg: true, webp: false })
    await flush()
    expect(store.formatHints).toEqual({ webp: "WebP isn't available in this browser." })
  })
})

describe('export store — session memory (AC-19)', () => {
  let editor: ReturnType<typeof useEditorStore>
  let store: ReturnType<typeof useExportStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    store = useExportStore()
    store.setFormatChecker(async () => ALL)
    store.setSaveDialogProbe(() => true)
    openWork(editor, { sourceFormat: 'png' })
    await flush()
    store.openPanel()
  })

  it('remembers format and size for the same Work across a close, as soon as they change', () => {
    store.selectFormat('webp')
    store.selectPreset(50)
    store.closePanel()
    store.openPanel()
    expect(store.format).toBe('webp')
    expect(store.sizeChoice).toEqual({ kind: 'preset', percent: 50 })
  })

  it('remembers a typed long side in pixels', () => {
    store.setLongSide(1000)
    store.closePanel()
    store.openPanel()
    expect(store.sizeChoice).toEqual({ kind: 'longSide', px: 1000 })
    expect(store.dimensions).toEqual({ width: 1000, height: 750 })
  })

  it('keeps the quality for every Work, but resets format and size for a new Work', async () => {
    store.selectFormat('jpeg')
    store.setQuality(42)
    store.selectPreset(25)
    store.closePanel()

    openWork(editor, { sourceFormat: 'webp' })
    await flush()
    store.openPanel()
    expect(store.quality).toBe(42)
    expect(store.format).toBe('webp')
    expect(store.sizeChoice).toEqual({ kind: 'preset', percent: 100 })
  })

  it('closes the panel when another Work replaces the open one, so the new Work starts fresh', async () => {
    store.selectFormat('webp')
    openWork(editor, { sourceFormat: 'jpeg' }) // a drop or Ctrl/Cmd+O with the panel still open
    await flush()
    expect(store.panelOpen).toBe(false)

    store.openPanel()
    expect(store.format).toBe('jpeg')
    store.selectFormat('png')
    expect(store.format).toBe('png')
  })

  it('refuses to open while the editor reads an image or asks to replace it', () => {
    store.closePanel()
    for (const phase of ['reading', 'confirming'] as const) {
      editor.phase = phase
      expect(store.editorBusy).toBe(true)
      expect(store.openPanel()).toBe(false)
      expect(store.panelOpen).toBe(false)
    }
    editor.phase = 'idle'
    expect(store.editorBusy).toBe(false)
    expect(store.openPanel()).toBe(true)
  })

  it('closes the panel when the replace dialog comes up over it', async () => {
    editor.phase = 'confirming'
    await flush()
    expect(store.panelOpen).toBe(false)
  })

  it('snaps a remembered long side larger than a smaller Work (AC-06)', async () => {
    store.setLongSide(4000)
    expect(store.dimensions).toEqual({ width: 4000, height: 3000 })
    // Same Work, a smaller size after a Crop (crop-rotate AC-14): the choice snaps to full size.
    editor.applyGeometry({
      ...editor.work!.geometry,
      crop: { x: 0, y: 0, width: 2000, height: 1500 },
    })
    expect(store.dimensions).toEqual({ width: 2000, height: 1500 })
  })

  it('applies the quality rules (AC-04)', () => {
    store.setQuality(150)
    expect(store.quality).toBe(100)
    store.setQuality(0)
    expect(store.quality).toBe(1)
    store.setQuality(42.5)
    expect(store.quality).toBe(43)
  })

  it('applies the long-side rules (AC-05, AC-06)', () => {
    store.setLongSide(5000)
    expect(store.longSide).toBe(4096)
    store.setLongSide(0)
    expect(store.longSide).toBe(1)
    store.setLongSide(2047.5)
    expect(store.longSide).toBe(2048)
  })

  it('highlights a preset only while the long side equals it', () => {
    expect(store.activePreset).toBe(100)
    store.setLongSide(2048)
    expect(store.activePreset).toBe(50)
    store.setLongSide(2000)
    expect(store.activePreset).toBeNull()
  })

  it('applies a value still being typed before closing (AC-19)', () => {
    const flushField = vi.fn(() => store.setQuality(12))
    const unregister = store.registerFlush(flushField)
    store.closePanel()
    expect(flushField).toHaveBeenCalledTimes(1)
    expect(store.quality).toBe(12)
    expect(store.panelOpen).toBe(false)

    unregister()
    store.openPanel()
    store.closePanel()
    expect(flushField).toHaveBeenCalledTimes(1)
  })
})

describe('export store — derived panel values', () => {
  let editor: ReturnType<typeof useEditorStore>
  let store: ReturnType<typeof useExportStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    store = useExportStore()
    store.setFormatChecker(async () => ALL)
    store.setSaveDialogProbe(() => true)
  })

  it('derives the dimensions, suggested name and quality visibility', async () => {
    openWork(editor, { sourceName: 'IMG_4021', sourceFormat: 'jpeg', width: 3072, height: 4096 })
    await flush()
    store.openPanel()
    expect(store.format).toBe('jpeg')
    expect(store.showsQuality).toBe(true)
    expect(store.suggestedName).toBe('IMG_4021-edited.jpg')
    store.selectPreset(50)
    expect(store.dimensions).toEqual({ width: 1536, height: 2048 })

    store.selectFormat('png')
    expect(store.showsQuality).toBe(false)
    expect(store.suggestedName).toBe('IMG_4021-edited.png')
  })

  it('shows the JPEG transparency hint only for JPEG on a transparent Work (AC-15)', async () => {
    openWork(editor, { sourceFormat: 'jpeg', hasTransparency: true })
    await flush()
    store.openPanel()
    expect(store.transparencyHint).toBe(
      'JPEG has no transparency: transparent areas become white. PNG or WebP keep them.',
    )
    store.selectFormat('webp')
    expect(store.transparencyHint).toBeNull()

    openWork(editor, { sourceFormat: 'jpeg', hasTransparency: false })
    await flush()
    store.openPanel()
    expect(store.transparencyHint).toBeNull()
  })

  it('says where the file will go', async () => {
    openWork(editor)
    await flush()
    expect(store.pathLine).toBe("You'll choose where to save it.")
    store.setSaveDialogProbe(() => false)
    expect(store.pathLine).toBe("It goes to your browser's downloads.")
  })

  it('disableFormat turns a format off for the session and selects PNG for this Work (AC-12)', async () => {
    openWork(editor, { sourceFormat: 'webp' })
    await flush()
    store.openPanel()
    expect(store.format).toBe('webp')

    store.disableFormat('webp')
    expect(store.availability.webp).toBe(false)
    expect(store.format).toBe('png')
    store.closePanel()
    store.openPanel()
    expect(store.format).toBe('png')

    openWork(editor, { sourceFormat: 'webp' })
    await flush()
    store.openPanel()
    expect(store.format).toBe('png')
  })

  it('a late check answer never re-enables a format disabled by a mismatch', async () => {
    const check = deferredChecker()
    store.setFormatChecker(check.checker)
    openWork(editor)
    await flush()
    store.disableFormat('jpeg')
    check.answer(ALL)
    await flush()
    expect(store.availability.jpeg).toBe(false)
  })
})

describe('export store — running an export (AC-01, AC-01b, AC-02, AC-09–AC-14)', () => {
  let editor: ReturnType<typeof useEditorStore>
  let store: ReturnType<typeof useExportStore>
  let exporter: ReturnType<
    typeof vi.fn<(request: ExportRequest) => Promise<Result<Blob, AppError>>>
  >
  let platform: {
    pickSaveTarget: ReturnType<typeof vi.fn<SavePlatform['pickSaveTarget']>>
    writeFile: ReturnType<typeof vi.fn<SavePlatform['writeFile']>>
    discardEmptyTarget: ReturnType<typeof vi.fn<SavePlatform['discardEmptyTarget']>>
    downloadFile: ReturnType<typeof vi.fn<SavePlatform['downloadFile']>>
  }
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
  const handle = { name: 'x', createWritable: vi.fn() } as unknown as SaveFileHandle
  const picked = (name: string) => ok({ kind: 'picked' as const, handle, name })
  const texts = () => useNotices().items.map((n) => `${n.kind}: ${n.text}`)

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    store = useExportStore()
    store.setFormatChecker(async () => ALL)
    store.setSaveDialogProbe(() => true)
    exporter = vi.fn(async () => ok(blob))
    platform = {
      pickSaveTarget: vi.fn(async () => picked('IMG_4021-edited.jpg')),
      writeFile: vi.fn(async () => ok(undefined)),
      discardEmptyTarget: vi.fn(async () => true),
      downloadFile: vi.fn(),
    }
    store.setExporter(exporter)
    store.setBitmapCopier(async (source) => ({ ...source, close: vi.fn() }) as ImageBitmap)
    store.setSavePlatform(platform)
    openWork(editor, { sourceName: 'IMG_4021', sourceFormat: 'jpeg' })
    await flush()
    editor.applyEdit()
    store.openPanel()
  })

  it('renders a copy of the Work at confirm with the panel values', async () => {
    store.setQuality(70)
    store.selectPreset(50)
    await store.confirm()

    expect(exporter).toHaveBeenCalledTimes(1)
    const request = exporter.mock.calls[0]![0]
    expect(request).toMatchObject({ width: 2048, height: 1536, format: 'jpeg', quality: 70 })
    expect(request.bitmap).not.toBe(editor.work!.original.pixels)
  })

  it('applies a value still being typed before it exports (AC-17)', async () => {
    store.registerFlush(() => store.setQuality(33))
    await store.confirm()
    expect(exporter.mock.calls[0]![0].quality).toBe(33)
  })

  it('saves through the dialog: written, saved, panel closed, file named (AC-01, AC-09)', async () => {
    await store.confirm()

    expect(platform.pickSaveTarget).toHaveBeenCalledWith('IMG_4021-edited.jpg', 'jpeg')
    expect(platform.writeFile).toHaveBeenCalledWith(handle, blob)
    expect(editor.hasUnsavedEdits).toBe(false)
    expect(editor.phase).toBe('idle')
    expect(store.status).toBe('idle')
    expect(store.panelOpen).toBe(false)
    expect(texts()).toEqual(['info: Saved IMG_4021-edited.jpg.'])
  })

  it('names the file the dialog returned when it differs (AC-01b)', async () => {
    platform.pickSaveTarget.mockResolvedValueOnce(picked('holiday.JPEG'))
    await store.confirm()
    expect(texts()).toEqual(['info: Saved holiday.JPEG.'])
    expect(editor.hasUnsavedEdits).toBe(false)
  })

  it('hands the file to the downloads where there is no dialog (AC-02, AC-09)', async () => {
    store.setSaveDialogProbe(() => false)
    await store.confirm()

    expect(platform.pickSaveTarget).not.toHaveBeenCalled()
    expect(platform.downloadFile).toHaveBeenCalledWith('IMG_4021-edited.jpg', blob)
    expect(editor.hasUnsavedEdits).toBe(false)
    expect(store.panelOpen).toBe(false)
    expect(texts()).toEqual(["info: IMG_4021-edited.jpg is in your browser's downloads."])
  })

  it('is exporting from confirm until the end, and a second confirm does nothing (AC-11)', async () => {
    let release!: () => void
    exporter.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve(ok(blob)))),
    )
    const first = store.confirm()
    await flush()
    expect(store.status).toBe('exporting')
    expect(editor.phase).toBe('exporting')

    await store.confirm()
    store.closePanel()
    expect(store.panelOpen).toBe(true)
    expect(exporter).toHaveBeenCalledTimes(1)

    release()
    await first
    expect(store.status).toBe('idle')
  })

  it('a cancelled dialog shows nothing and keeps Unsaved edits and choices (AC-10)', async () => {
    store.selectPreset(25)
    platform.pickSaveTarget.mockResolvedValueOnce(ok({ kind: 'cancelled' }))
    await store.confirm()

    expect(platform.writeFile).not.toHaveBeenCalled()
    expect(editor.hasUnsavedEdits).toBe(true)
    expect(editor.phase).toBe('idle')
    expect(store.panelOpen).toBe(true)
    expect(store.sizeChoice).toEqual({ kind: 'preset', percent: 25 })
    expect(texts()).toEqual([])
  })

  it('EXPORT_FAILED: no dialog, nothing written, reason shown, Unsaved edits kept (AC-13)', async () => {
    exporter.mockResolvedValueOnce(err(appError('EXPORT_FAILED')))
    await store.confirm()

    expect(platform.pickSaveTarget).not.toHaveBeenCalled()
    expect(platform.writeFile).not.toHaveBeenCalled()
    expect(platform.downloadFile).not.toHaveBeenCalled()
    expect(editor.hasUnsavedEdits).toBe(true)
    expect(store.panelOpen).toBe(true)
    expect(store.status).toBe('idle')
    expect(texts()).toEqual(['failure: The export failed. Try again, or choose a smaller size.'])
  })

  it('EXPORT_FAILED when the copy of the Original cannot be made', async () => {
    store.setBitmapCopier(() => Promise.reject(new Error('oom')))
    await store.confirm()
    expect(exporter).not.toHaveBeenCalled()
    expect(editor.phase).toBe('idle')
    expect(texts()).toEqual(['failure: The export failed. Try again, or choose a smaller size.'])
  })

  it('EXPORT_FORMAT_MISMATCH: not saved, format off for the session, PNG selected (AC-12)', async () => {
    store.selectFormat('webp')
    exporter.mockResolvedValueOnce(
      err(appError('EXPORT_FORMAT_MISMATCH', { asked: 'webp', produced: 'png' })),
    )
    await store.confirm()

    expect(platform.pickSaveTarget).not.toHaveBeenCalled()
    expect(platform.writeFile).not.toHaveBeenCalled()
    expect(store.availability.webp).toBe(false)
    expect(store.format).toBe('png')
    expect(store.panelOpen).toBe(true)
    expect(editor.hasUnsavedEdits).toBe(true)
    expect(texts()).toEqual([
      "failure: This browser didn't make a real WebP file, so nothing was saved. WebP is turned off for now; PNG is selected.",
    ])
  })

  it.each(['photo', 'photo.png'])(
    'EXPORT_EXTENSION_MISMATCH for %j: nothing written, emptied file removed, notice + suffix (AC-01b, AC-13)',
    async (name) => {
      platform.pickSaveTarget.mockResolvedValueOnce(picked(name))
      await store.confirm()

      expect(platform.writeFile).not.toHaveBeenCalled()
      expect(platform.discardEmptyTarget).toHaveBeenCalledWith(handle)
      expect(editor.hasUnsavedEdits).toBe(true)
      expect(store.panelOpen).toBe(true)
      expect(texts()).toEqual([
        `failure: "${name}" doesn't end in .jpg, so nothing was written. Save again with a .jpg name. A file named "${name}" there may now be empty or missing.`,
      ])
    },
  )

  it('keeps the "may now be empty" suffix even when the file could not be removed', async () => {
    platform.pickSaveTarget.mockResolvedValueOnce(picked('photo.png'))
    platform.discardEmptyTarget.mockResolvedValueOnce(false)
    await store.confirm()
    expect(texts()[0]).toContain('A file named "photo.png" there may now be empty or missing.')
  })

  it('EXPORT_NOT_PERMITTED: target removed where possible, notice + suffix, Unsaved kept (AC-14)', async () => {
    platform.writeFile.mockResolvedValueOnce(err(appError('EXPORT_NOT_PERMITTED')))
    await store.confirm()

    expect(platform.discardEmptyTarget).toHaveBeenCalledWith(handle)
    expect(editor.hasUnsavedEdits).toBe(true)
    expect(store.panelOpen).toBe(true)
    expect(texts()).toEqual([
      'failure: The app wasn\'t allowed to save there. Choose another folder. A file named "IMG_4021-edited.jpg" there may now be empty or missing.',
    ])
  })

  it('File ready: a lapsed activation keeps the verified file until Save… (ADR-0001)', async () => {
    platform.pickSaveTarget.mockResolvedValueOnce(ok({ kind: 'activationLapsed' }))
    await store.confirm()

    expect(store.status).toBe('fileReady')
    expect(editor.phase).toBe('exporting')
    expect(platform.writeFile).not.toHaveBeenCalled()
    expect(texts()).toEqual([])

    await store.saveFromReady()
    expect(exporter).toHaveBeenCalledTimes(1)
    expect(platform.pickSaveTarget).toHaveBeenCalledTimes(2)
    expect(platform.writeFile).toHaveBeenCalledWith(handle, blob)
    expect(editor.hasUnsavedEdits).toBe(false)
    expect(store.status).toBe('idle')
    expect(store.panelOpen).toBe(false)
  })

  it('File ready → cancel ends the export as cancelled, no message (AC-10)', async () => {
    platform.pickSaveTarget.mockResolvedValueOnce(ok({ kind: 'activationLapsed' }))
    await store.confirm()
    store.cancelReady()

    expect(store.status).toBe('idle')
    expect(editor.phase).toBe('idle')
    expect(editor.hasUnsavedEdits).toBe(true)
    expect(store.panelOpen).toBe(true)
    expect(texts()).toEqual([])
  })

  it('the save point is the revision at confirm (AC-09, AC-11)', async () => {
    let release!: () => void
    exporter.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve(ok(blob)))),
    )
    const pending = store.confirm()
    await flush()
    editor.applyEdit() // refused while exporting
    release()
    await pending
    expect(editor.work!.revision).toBe(1)
    expect(editor.work!.cleanRevision).toBe(1)
  })

  it('does nothing with no Work open', async () => {
    editor.work = null
    await store.confirm()
    expect(exporter).not.toHaveBeenCalled()
  })

  it('counts the copy in the bitmap ledger and closes it, so one Original stays retained', async () => {
    const copies: { close: ReturnType<typeof vi.fn> }[] = []
    store.setBitmapCopier(async () => {
      const copy = { width: 1, height: 1, close: vi.fn() }
      copies.push(copy)
      return copy as unknown as ImageBitmap
    })
    const before = { ...bitmapLedger }
    await store.confirm()
    expect(copies[0]!.close).toHaveBeenCalled()
    expect(bitmapLedger.received - before.received).toBe(bitmapLedger.closed - before.closed)
  })
})

describe('export store — the applied Geometry (crop-rotate AC-14)', () => {
  let editor: ReturnType<typeof useEditorStore>
  let store: ReturnType<typeof useExportStore>
  const original = { width: 4096, height: 3072 }
  const cropTo = (width: number, height: number, over: Partial<Geometry> = {}): Geometry => ({
    ...identityGeometry(original),
    ...over,
    crop: { x: 0, y: 0, width, height },
  })

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    store = useExportStore()
    store.setFormatChecker(async () => ALL)
    store.setSaveDialogProbe(() => true)
    store.setBitmapCopier(async (source) => ({ ...source, close: vi.fn() }) as ImageBitmap)
  })

  it('counts the full size and the presets from the Crop', async () => {
    openWork(editor)
    await flush()
    editor.applyGeometry(cropTo(1000, 800))
    store.openPanel()
    expect(store.dimensions).toEqual({ width: 1000, height: 800 })
    store.selectPreset(50)
    expect(store.dimensions).toEqual({ width: 500, height: 400 })
  })

  it('snaps a remembered long side to a tighter Crop and brings it back when widened', async () => {
    openWork(editor)
    await flush()
    store.openPanel()
    store.setLongSide(3000)
    editor.applyGeometry(cropTo(1000, 800))
    expect(store.longSide).toBe(1000)
    editor.applyGeometry(cropTo(4000, 2000))
    expect(store.longSide).toBe(3000)
  })

  it('sends the Work’s applied Adjustments with the export request (adjust AC-14)', async () => {
    const exporter = vi.fn<(r: ExportRequest) => Promise<Result<Blob, AppError>>>(async () =>
      ok(new Blob()),
    )
    store.setExporter(exporter)
    store.setSavePlatform({
      pickSaveTarget: vi.fn(async () => ok({ kind: 'cancelled' as const })),
    })
    openWork(editor)
    await flush()
    const applied = { ...NEUTRAL_ADJUSTMENTS, brightness: 15, grayscale: 100 }
    editor.applyAdjustments(applied)
    store.openPanel()
    await store.confirm()
    expect(exporter.mock.calls[0]![0].adjustments).toEqual(applied)
  })

  it('sends the Work’s Geometry with the export request', async () => {
    const exporter = vi.fn<(r: ExportRequest) => Promise<Result<Blob, AppError>>>(async () =>
      ok(new Blob()),
    )
    store.setExporter(exporter)
    store.setSavePlatform({
      pickSaveTarget: vi.fn(async () => ok({ kind: 'cancelled' as const })),
    })
    openWork(editor)
    await flush()
    const g = cropTo(3072, 4096, { rotation: 90 })
    editor.applyGeometry(g)
    store.openPanel()
    await store.confirm()
    expect(exporter.mock.calls[0]![0]).toMatchObject({ width: 3072, height: 4096, geometry: g })
  })

  describe('transparency hint (crop-rotate ADR-0004)', () => {
    let checks: { request: AlphaRequest; answer: (r: Result<boolean, AppError>) => void }[]

    beforeEach(() => {
      checks = []
      store.setTransparencyChecker(
        (request) =>
          new Promise((resolve) => {
            checks.push({ request, answer: resolve })
          }),
      )
    })

    async function jpegPanel(hasTransparency: boolean) {
      openWork(editor, { hasTransparency })
      await flush()
      store.openPanel()
      store.selectFormat('jpeg')
      await flush()
    }

    it('runs only while the panel is open, and catches up when it opens (ADR-0004)', async () => {
      await jpegPanel(true)
      store.closePanel()
      await flush()
      editor.applyGeometry(cropTo(10, 10))
      await flush()
      editor.applyGeometry(cropTo(20, 20))
      await flush()
      expect(checks).toHaveLength(0)

      store.openPanel()
      await flush()
      expect(checks).toHaveLength(1)
      expect(checks[0]!.request.geometry).toEqual(cropTo(20, 20))
    })

    it('needs no check for an opaque Original, whatever the Geometry', async () => {
      await jpegPanel(false)
      editor.applyGeometry(cropTo(10, 10))
      await flush()
      expect(checks).toHaveLength(0)
      expect(store.transparencyHint).toBeNull()
    })

    it('needs no check for the identity Geometry: the Original decides', async () => {
      await jpegPanel(true)
      expect(checks).toHaveLength(0)
      expect(store.transparencyHint).not.toBeNull()
    })

    it('is hidden while the check runs and follows its answer', async () => {
      await jpegPanel(true)
      const g = cropTo(10, 10)
      editor.applyGeometry(g)
      await flush()
      expect(checks).toHaveLength(1)
      expect(checks[0]!.request.geometry).toEqual(g)
      expect(store.transparencyHint).toBeNull()

      checks[0]!.answer(ok(false))
      await flush()
      expect(store.transparencyHint).toBeNull()

      editor.applyGeometry(cropTo(20, 20))
      await flush()
      checks[1]!.answer(ok(true))
      await flush()
      expect(store.transparencyHint).not.toBeNull()
    })

    it('shows the hint when the check fails (the safe side)', async () => {
      await jpegPanel(true)
      editor.applyGeometry(cropTo(10, 10))
      await flush()
      checks[0]!.answer(err(appError('EXPORT_FAILED')))
      await flush()
      expect(store.transparencyHint).not.toBeNull()
    })

    it('caches by Work and Geometry, and ignores a stale answer', async () => {
      await jpegPanel(true)
      editor.applyGeometry(cropTo(10, 10))
      await flush()
      editor.applyGeometry(cropTo(20, 20))
      await flush()
      expect(checks).toHaveLength(2)
      checks[0]!.answer(ok(true)) // stale: for the previous Geometry
      await flush()
      expect(store.transparencyHint).toBeNull()
      checks[1]!.answer(ok(false))
      await flush()
      expect(store.transparencyHint).toBeNull()

      store.selectFormat('png')
      await flush()
      store.selectFormat('jpeg')
      await flush()
      expect(checks).toHaveLength(2) // answered for this Geometry already
    })

    it('keeps its answer across an Adjustment change: it depends on the Geometry only (R3)', async () => {
      await jpegPanel(true)
      editor.applyGeometry(cropTo(10, 10))
      await flush()
      checks[0]!.answer(ok(true))
      await flush()
      expect(store.transparencyHint).not.toBeNull()

      editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, brightness: 30, sepia: 40 })
      await flush()
      expect(store.transparencyHint).not.toBeNull()
      expect(checks).toHaveLength(1)
    })

    it('runs no check while PNG is chosen', async () => {
      openWork(editor, { hasTransparency: true })
      await flush()
      store.openPanel()
      store.selectFormat('png')
      editor.applyGeometry(cropTo(10, 10))
      await flush()
      expect(checks).toHaveLength(0)
    })
  })
})

describe('export store — tools and the active panel (crop-rotate AC-16, AC-20)', () => {
  let editor: ReturnType<typeof useEditorStore>
  let store: ReturnType<typeof useExportStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    store = useExportStore()
    store.setFormatChecker(async () => ALL)
    store.setSaveDialogProbe(() => true)
    openWork(editor)
    await flush()
  })

  it('reports the open panel to the editor', () => {
    expect(store.openPanel()).toBe(true)
    expect(editor.activePanel).toBe('export')
    store.closePanel()
    expect(editor.activePanel).toBeNull()
  })

  it('refuses to open the panel while a tool is open', () => {
    editor.openTool('crop-rotate')
    expect(store.openPanel()).toBe(false)
    expect(store.panelOpen).toBe(false)
    expect(editor.activePanel).toBeNull()
  })
})
