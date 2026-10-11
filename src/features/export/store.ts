import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  appError,
  DEFAULT_QUALITY,
  defaultFormat,
  exportFileName,
  exportSize,
  geometryEquals,
  identityGeometry,
  longSideFor,
  matchesExtension,
  normalizeLongSide,
  normalizeQuality,
  SIZE_PRESETS,
  type AppError,
  type ExportFormat,
  type FormatAvailability,
  type Result,
  type Size,
  type SizeChoice,
  type Work,
  workSize as workSizeOf,
} from '@/core'
import { useEditorStore, type ExportSnapshot } from '@/features/editor'
import {
  discardEmptyTarget,
  downloadFile,
  hasSaveDialog,
  pickSaveTarget,
  writeFile,
} from '@/infra/platform'
import {
  checkCropTransparency,
  checkExportFormats,
  exportImage,
  readRect,
  type Layer,
  type AlphaRequest,
  type ExportRequest,
  type FormatAvailabilityCheck,
} from '@/render'
import { bitmapLedger, closeBitmap, useNotices } from '@/shared'
import {
  failureMessage,
  hintChecking,
  hintTransparency,
  hintUnavailable,
  infoDownloaded,
  infoSaved,
  lineDownloads,
  lineSaveDialog,
} from './messages'

export type FormatChecker = () => Promise<FormatAvailabilityCheck>
export type Exporter = (request: ExportRequest) => Promise<Result<Blob, AppError>>
export type BitmapCopier = (source: ImageBitmap) => Promise<ImageBitmap>
export type TransparencyChecker = (request: AlphaRequest) => Promise<Result<boolean, AppError>>

/**
 * The GPU check's answer for one Geometry of one Work; `running` hides the hint meanwhile. It does
 * not depend on the Adjustments, which never change alpha (adjust sad §5).
 */
interface CropAlpha {
  key: string
  state: 'running' | boolean
}

/** The platform save functions, injectable so tests can drive every branch. */
export interface SavePlatform {
  pickSaveTarget: typeof pickSaveTarget
  writeFile: typeof writeFile
  discardEmptyTarget: typeof discardEmptyTarget
  downloadFile: typeof downloadFile
}

/** `fileReady`: the activation lapsed before "Save as…" could open; the verified file is kept. */
export type ExportStatus = 'idle' | 'exporting' | 'fileReady'

/** The choices frozen at confirm, so the file always has the values the panel showed (AC-17). */
interface ExportJob {
  snapshot: ExportSnapshot
  format: ExportFormat
  name: string
}

/** A lossy format is `checking` until the session's check answers; PNG is always available. */
export type Availability = 'checking' | boolean

export interface FormatAvailabilityState {
  png: true
  jpeg: Availability
  webp: Availability
}

type LossyFormat = 'jpeg' | 'webp'

/** The format and size remembered for one Work, in the form they were chosen (AC-19). */
interface WorkChoice {
  workId: string
  format: ExportFormat
  size: SizeChoice
}

const FULL_SIZE: SizeChoice = { kind: 'preset', percent: 100 }

/**
 * The export store: panel state, format availability and the session memory (AC-19). Memory lives
 * only here, in memory: the quality for every Work, the format and size for the open Work.
 */
export const useExportStore = defineStore('export', () => {
  const editor = useEditorStore()
  const panelOpen = ref(false)
  const availability = ref<FormatAvailabilityState>({
    png: true,
    jpeg: 'checking',
    webp: 'checking',
  })
  const quality = ref(DEFAULT_QUALITY)
  const choice = ref<WorkChoice | null>(null)
  const checker = shallowRef<FormatChecker>(checkExportFormats)
  const saveDialogProbe = shallowRef<() => boolean>(hasSaveDialog)
  const status = ref<ExportStatus>('idle')
  const notices = useNotices()
  let exporter: Exporter = exportImage
  let copyBitmap: BitmapCopier = (source) => createImageBitmap(source)
  let checkTransparency: TransparencyChecker = checkCropTransparency
  const cropAlpha = ref<CropAlpha | null>(null)
  let platform: SavePlatform = { pickSaveTarget, writeFile, discardEmptyTarget, downloadFile }
  // The verified file waiting for "Save…" in the File-ready state.
  let ready: { job: ExportJob; blob: Blob } | null = null
  const disabled = new Set<LossyFormat>()
  const flushers = new Set<() => void>()
  let checkStarted = false

  function setFormatChecker(next: FormatChecker) {
    checker.value = next
  }

  function setSaveDialogProbe(next: () => boolean) {
    saveDialogProbe.value = next
  }

  function setExporter(next: Exporter) {
    exporter = next
  }

  function setBitmapCopier(next: BitmapCopier) {
    copyBitmap = next
  }

  function setTransparencyChecker(next: TransparencyChecker) {
    checkTransparency = next
  }

  function setSavePlatform(next: Partial<SavePlatform>) {
    platform = { ...platform, ...next }
  }

  /** The session's one format check, started by the first open; a mismatch outranks it. */
  async function runFormatCheck() {
    let result: FormatAvailabilityCheck
    try {
      result = await checker.value()
    } catch {
      result = { png: true, jpeg: false, webp: false }
    }
    availability.value = {
      png: true,
      jpeg: result.jpeg && !disabled.has('jpeg'),
      webp: result.webp && !disabled.has('webp'),
    }
  }

  watch(
    () => editor.work,
    (work) => {
      if (!work || checkStarted) return
      checkStarted = true
      void runFormatCheck()
    },
    { immediate: true },
  )

  /** The editor is reading an image or waits on the replace dialog: no export can start then. */
  const editorBusy = computed(() => editor.phase === 'reading' || editor.phase === 'confirming')

  // The editor knows the panel is open, so another feature's shortcut can stay silent under it
  // without importing export (crop-rotate AC-20).
  watch(panelOpen, (open) => editor.setActivePanel(open ? 'export' : null), { flush: 'sync' })

  // The replace dialog is modal: the panel never stays open beneath it.
  watch(
    () => editor.phase,
    (phase) => {
      if (phase === 'confirming' && status.value === 'idle') panelOpen.value = false
    },
  )

  // A drop or Ctrl/Cmd+O can replace the Work with the panel open; its choices belong to the old
  // Work, so the panel closes and the new Work starts from its own defaults (AC-19).
  watch(
    () => editor.work?.id,
    (id, previous) => {
      if (previous && id !== previous && status.value === 'idle') panelOpen.value = false
    },
  )

  /** The Work's full size: its Crop's (crop-rotate AC-14). */
  const workSize = computed<Size | null>(() => (editor.work ? workSizeOf(editor.work) : null))

  /** The open Work's remembered choice, or null before its panel was first opened. */
  const current = computed(() =>
    choice.value && choice.value.workId === editor.work?.id ? choice.value : null,
  )
  const format = computed<ExportFormat>(() => current.value?.format ?? 'png')
  const sizeChoice = computed<SizeChoice>(() => current.value?.size ?? FULL_SIZE)

  const dimensions = computed<Size>(() =>
    workSize.value ? exportSize(workSize.value, sizeChoice.value) : { width: 0, height: 0 },
  )
  const longSide = computed(() => Math.max(dimensions.value.width, dimensions.value.height))

  /** A preset is highlighted only while the long side equals it. */
  const activePreset = computed<number | null>(() => {
    const size = workSize.value
    if (!size) return null
    if (
      sizeChoice.value.kind === 'preset' &&
      longSideFor(size, sizeChoice.value) === longSide.value
    ) {
      return sizeChoice.value.percent
    }
    return (
      SIZE_PRESETS.find(
        (percent) => longSideFor(size, { kind: 'preset', percent }) === longSide.value,
      ) ?? null
    )
  })

  const suggestedName = computed(() => exportFileName(editor.work?.sourceName ?? '', format.value))
  const showsQuality = computed(() => format.value !== 'png')

  /**
   * Whether the JPEG hint has a pixel to warn about: the Original's flag when it is opaque (marks
   * are opaque, so they add no transparency) or, with no Drawing layer, when the Geometry is the
   * identity; else the GPU check over the Crop with the layer (crop-rotate ADR-0004, draw ADR-0003),
   * `running` until it answers.
   */
  const cropTransparency = computed<'running' | boolean>(() => {
    const work = editor.work
    if (!work || !work.original.hasTransparency) return false
    if (!work.drawing && geometryEquals(work.geometry, identityGeometry(work.original))) return true
    const answer = cropAlpha.value
    return answer && answer.key === alphaKey(work) ? answer.state : 'running'
  })

  const alphaKey = (work: Work) =>
    `${work.id}@${JSON.stringify(work.geometry)}@${work.drawing?.id ?? 'none'}`

  /** The applied layer's pixels, read once per export or check and transferred (draw ADR-0003). */
  const readLayer = (layer: Layer | null) =>
    layer && readRect(layer, { x: 0, y: 0, width: layer.width, height: layer.height })

  /** Runs only when the open panel needs the answer, never on every Apply (ADR-0004). */
  async function runCropAlphaCheck() {
    const work = editor.work
    if (!work || !panelOpen.value || format.value !== 'jpeg') return
    if (cropTransparency.value !== 'running') return
    const key = alphaKey(work)
    if (cropAlpha.value?.key === key) return
    cropAlpha.value = { key, state: 'running' }
    let answer: boolean
    try {
      const copy = await copyBitmap(work.original.pixels)
      bitmapLedger.noteReceived()
      const result = await checkTransparency({
        bitmap: copy,
        geometry: work.geometry,
        layer: readLayer(work.drawing),
      })
      closeBitmap(copy) // already transferred and closed in the worker; this records it
      answer = result.ok ? result.value : true // a failed check shows the hint: the safe side
    } catch {
      answer = true
    }
    if (cropAlpha.value?.key === key) cropAlpha.value = { key, state: answer }
  }

  watch(
    () =>
      [
        panelOpen.value,
        format.value,
        editor.work?.id,
        editor.work?.geometry,
        editor.work?.drawing,
      ] as const,
    () => void runCropAlphaCheck(),
  )

  const transparencyHint = computed(() =>
    format.value === 'jpeg' && cropTransparency.value === true ? hintTransparency() : null,
  )
  const pathLine = computed(() => (saveDialogProbe.value() ? lineSaveDialog() : lineDownloads()))

  const formatHints = computed(() => {
    const hints: Partial<Record<LossyFormat, string>> = {}
    for (const lossy of ['jpeg', 'webp'] as const) {
      const state = availability.value[lossy]
      if (state === 'checking') hints[lossy] = hintChecking()
      else if (state === false) hints[lossy] = hintUnavailable(lossy)
    }
    return hints
  })

  function isAvailable(f: ExportFormat): boolean {
    return availability.value[f] === true
  }

  function confirmed(): FormatAvailability {
    const { jpeg, webp } = availability.value
    return { png: true, jpeg: jpeg === true, webp: webp === true }
  }

  function remember(patch: Partial<Omit<WorkChoice, 'workId'>>) {
    const base = current.value
    if (!base) return
    choice.value = { ...base, ...patch }
  }

  /** Opens the panel for the open Work, seeding its choices the first time (AC-19). */
  function openPanel(): boolean {
    const work = editor.work
    if (!work || editorBusy.value || editor.activeTool) return false
    if (!current.value) {
      choice.value = {
        workId: work.id,
        format: defaultFormat(work.sourceFormat, confirmed()),
        size: FULL_SIZE,
      }
    }
    panelOpen.value = true
    return true
  }

  /**
   * Applies values still being typed, then closes (Escape or a click outside, AC-19). Refused while
   * an export runs (AC-17); in File ready the panel calls `cancelReady()` instead.
   */
  function closePanel() {
    if (status.value !== 'idle') return
    flushPending()
    panelOpen.value = false
  }

  function fail(error: AppError, touchedFile?: string) {
    notices.pushAll([{ kind: 'failure', text: failureMessage(error, { touchedFile }) }])
  }

  /** Ends the export; only a finished hand-off sets the save point (AC-09, AC-10). */
  function finish(job: ExportJob, saved: boolean, info?: string) {
    ready = null
    status.value = 'idle'
    editor.finishExport(job.snapshot, saved)
    if (!saved) return
    panelOpen.value = false
    if (info) notices.pushAll([{ kind: 'info', text: info }])
  }

  /**
   * Confirm: apply pending values, snapshot the Work, render + encode + verify a copy in the
   * export worker, then save through "Save as…" or hand off to the downloads (sad.md §6 flow 1).
   * Every render or format failure ends before the disk is touched (ADR-0001).
   */
  async function confirm(): Promise<void> {
    if (status.value !== 'idle') return
    flushPending()
    const snapshot = editor.beginExport()
    if (!snapshot) return
    status.value = 'exporting'
    const job: ExportJob = { snapshot, format: format.value, name: suggestedName.value }
    const { width, height } = dimensions.value
    const lossyQuality = quality.value

    let copy: ImageBitmap
    try {
      copy = await copyBitmap(snapshot.original.pixels)
    } catch {
      fail(appError('EXPORT_FAILED'))
      finish(job, false)
      return
    }
    bitmapLedger.noteReceived()
    const result = await exporter({
      bitmap: copy,
      width,
      height,
      format: job.format,
      quality: lossyQuality,
      geometry: snapshot.geometry,
      adjustments: snapshot.adjustments,
      layer: readLayer(snapshot.drawing),
    })
    closeBitmap(copy) // already transferred and closed in the worker; this records it
    if (!result.ok) {
      if (result.error.code === 'EXPORT_FORMAT_MISMATCH') disableFormat(job.format)
      fail(result.error)
      finish(job, false)
      return
    }

    if (!saveDialogProbe.value()) {
      platform.downloadFile(job.name, result.value)
      finish(job, true, infoDownloaded(job.name))
      return
    }
    await saveThroughDialog(job, result.value)
  }

  async function saveThroughDialog(job: ExportJob, blob: Blob): Promise<void> {
    status.value = 'exporting'
    const target = await platform.pickSaveTarget(job.name, job.format)
    if (!target.ok) {
      fail(target.error)
      finish(job, false)
      return
    }
    const outcome = target.value
    if (outcome.kind === 'cancelled') {
      finish(job, false)
      return
    }
    if (outcome.kind === 'activationLapsed') {
      ready = { job, blob }
      status.value = 'fileReady'
      return
    }
    // The dialog has already emptied or created the file: every refusal from here removes it
    // where it can and says it may now be empty or missing (AC-13).
    if (!matchesExtension(outcome.name, job.format)) {
      await platform.discardEmptyTarget(outcome.handle)
      fail(
        appError('EXPORT_EXTENSION_MISMATCH', { name: outcome.name, format: job.format }),
        outcome.name,
      )
      finish(job, false)
      return
    }
    const written = await platform.writeFile(outcome.handle, blob)
    if (!written.ok) {
      await platform.discardEmptyTarget(outcome.handle)
      fail(written.error, outcome.name)
      finish(job, false)
      return
    }
    finish(job, true, infoSaved(outcome.name))
  }

  /** "Save…" in File ready: opens the dialog again for the kept, verified file. */
  async function saveFromReady(): Promise<void> {
    if (status.value !== 'fileReady' || !ready) return
    const { job, blob } = ready
    ready = null
    await saveThroughDialog(job, blob)
  }

  /** Leaving File ready (Escape or a click outside) ends the export as cancelled (AC-10). */
  function cancelReady() {
    if (status.value !== 'fileReady' || !ready) return
    finish(ready.job, false)
  }

  function selectFormat(next: ExportFormat) {
    if (isAvailable(next)) remember({ format: next })
  }

  function setQuality(value: number) {
    quality.value = normalizeQuality(String(value), quality.value)
  }

  function selectPreset(percent: number) {
    remember({ size: { kind: 'preset', percent } })
  }

  function setLongSide(px: number) {
    if (!workSize.value) return
    remember({
      size: { kind: 'longSide', px: normalizeLongSide(String(px), longSide.value, workSize.value) },
    })
  }

  /** A produced file was not the chosen format: off for the session, PNG for this Work (AC-12). */
  function disableFormat(f: ExportFormat) {
    if (f === 'png') return
    disabled.add(f)
    availability.value = { ...availability.value, [f]: false }
    if (format.value === f) remember({ format: 'png' })
  }

  /** The panel's fields register their "apply now"; returns the unregister function. */
  function registerFlush(fn: () => void): () => void {
    flushers.add(fn)
    return () => flushers.delete(fn)
  }

  function flushPending() {
    for (const fn of flushers) fn()
  }

  return {
    panelOpen,
    status,
    editorBusy,
    availability,
    quality,
    format,
    sizeChoice,
    dimensions,
    longSide,
    activePreset,
    suggestedName,
    showsQuality,
    transparencyHint,
    pathLine,
    formatHints,
    setFormatChecker,
    setSaveDialogProbe,
    setExporter,
    setBitmapCopier,
    setTransparencyChecker,
    setSavePlatform,
    openPanel,
    closePanel,
    selectFormat,
    setQuality,
    selectPreset,
    setLongSide,
    disableFormat,
    registerFlush,
    flushPending,
    confirm,
    saveFromReady,
    cancelReady,
  }
})
