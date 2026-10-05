import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createWork, type ImageFormat } from '@/core'
import { useEditorStore } from '@/features/editor'
import type { FormatAvailabilityCheck } from '@/render'
import { useExportStore } from './store'

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

  it('snaps a remembered long side larger than a smaller Work (AC-06)', async () => {
    store.setLongSide(4000)
    expect(store.dimensions).toEqual({ width: 4000, height: 3000 })
    // Same Work id, smaller Original (e.g. after a later crop): the choice snaps to full size.
    editor.work = {
      ...editor.work!,
      original: { ...editor.work!.original, width: 2000, height: 1500 },
    }
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
