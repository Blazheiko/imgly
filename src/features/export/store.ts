import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  DEFAULT_QUALITY,
  defaultFormat,
  exportFileName,
  exportSize,
  longSideFor,
  normalizeLongSide,
  normalizeQuality,
  SIZE_PRESETS,
  type ExportFormat,
  type FormatAvailability,
  type Size,
  type SizeChoice,
} from '@/core'
import { useEditorStore } from '@/features/editor'
import { hasSaveDialog } from '@/infra/platform'
import { checkExportFormats, type FormatAvailabilityCheck } from '@/render'
import {
  hintChecking,
  hintTransparency,
  hintUnavailable,
  lineDownloads,
  lineSaveDialog,
} from './messages'

export type FormatChecker = () => Promise<FormatAvailabilityCheck>

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
  const disabled = new Set<LossyFormat>()
  const flushers = new Set<() => void>()
  let checkStarted = false

  function setFormatChecker(next: FormatChecker) {
    checker.value = next
  }

  function setSaveDialogProbe(next: () => boolean) {
    saveDialogProbe.value = next
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

  const workSize = computed<Size | null>(() => {
    const original = editor.work?.original
    return original ? { width: original.width, height: original.height } : null
  })

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
  const transparencyHint = computed(() =>
    format.value === 'jpeg' && editor.work?.original.hasTransparency ? hintTransparency() : null,
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
    if (!work) return false
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

  /** Applies values still being typed, then closes (Escape or a click outside, AC-19). */
  function closePanel() {
    flushPending()
    panelOpen.value = false
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
    openPanel,
    closePanel,
    selectFormat,
    setQuality,
    selectPreset,
    setLongSide,
    disableFormat,
    registerFlush,
    flushPending,
  }
})
