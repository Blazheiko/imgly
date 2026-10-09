import { ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  ADJUSTMENT_RANGES,
  autoAdjust,
  NEUTRAL_ADJUSTMENTS,
  parseAdjustmentField,
  type AdjustmentKey,
  type Adjustments,
} from '@/core'
import { useEditorStore } from '@/features/editor'

/**
 * The "Adjust" tool's state (sad.md §4, §5): the Draft, whether Compare is held and whether Auto
 * found nothing to correct. Cancel needs no copy of the values at open: the Work still holds them.
 * A field's typed text stays in its NumberField until it is left or Enter is pressed (AC-05). The
 * Draft reaches the Preview only through `editor.previewAdjustments` (neutral values while Compare
 * is held), and the Work only through `editor.applyAdjustments` on Apply. Its only cross-feature
 * import is the editor store.
 */
export const useAdjustStore = defineStore('adjust', () => {
  const editor = useEditorStore()
  const draft = shallowRef<Adjustments | null>(null)
  const comparing = ref(false)
  const nothingToCorrect = ref(false)

  // The editor closes the slot on Apply, Cancel and a confirmed replace: the Draft goes with it.
  watch(
    () => editor.activeTool,
    (tool) => {
      if (tool === 'adjust') return
      draft.value = null
      comparing.value = false
      nothingToCorrect.value = false
    },
    { flush: 'sync' },
  )

  /** Every Draft change: the Preview shows it unless Compare is held (AC-08). */
  function update(next: Adjustments) {
    draft.value = next
    nothingToCorrect.value = false
    if (!comparing.value) editor.setPreviewAdjustments(next)
  }

  /** Holds Compare: the Preview shows the Work with no Adjustments; nothing else changes (AC-08). */
  function startCompare() {
    if (!draft.value || comparing.value) return
    comparing.value = true
    editor.setPreviewAdjustments(NEUTRAL_ADJUSTMENTS)
  }

  /** Releases Compare (also on window blur): the Preview shows the current Draft again. */
  function endCompare() {
    if (!comparing.value) return
    comparing.value = false
    if (draft.value) editor.setPreviewAdjustments(draft.value)
  }

  /**
   * Auto (AC-12, AC-13): measures the Work with its Geometry and no Adjustments, and replaces the
   * Draft's brightness, contrast, temperature and tint, or says there is nothing to correct. With
   * the display lost there is no sample and nothing changes (the UI disables Auto then).
   */
  function auto() {
    if (!draft.value) return
    const sample = editor.sampleWork()
    if (!sample.ok) return
    const result = autoAdjust(sample.value)
    if (result.kind === 'nothing') {
      nothingToCorrect.value = true
      return
    }
    update({ ...draft.value, ...result.values })
  }

  /** Opens the tool with the Work's applied values as the Draft, or answers why it may not open. */
  function open() {
    const result = editor.openTool('adjust')
    if (!result.ok) return result
    update({ ...editor.work!.adjustments })
    return result
  }

  /** A slider's value, already whole; snapped to the key's range all the same. */
  function setValue(key: AdjustmentKey, value: number) {
    if (!draft.value) return
    const { min, max } = ADJUSTMENT_RANGES[key]
    const next = Math.min(max, Math.max(min, Math.round(value))) || 0
    if (next !== draft.value[key]) update({ ...draft.value, [key]: next })
  }

  /**
   * Applies a field's typed text by the AC-05 rule and answers the value the Draft then holds, for
   * the field to show. It never applies the tool.
   */
  function commitText(key: AdjustmentKey, text: string): number {
    if (!draft.value) return ADJUSTMENT_RANGES[key].neutral
    setValue(key, parseAdjustmentField(text, key, draft.value[key]))
    return draft.value[key]
  }

  /** One slider to its neutral value, on the Draft only (AC-10). */
  function resetOne(key: AdjustmentKey) {
    setValue(key, ADJUSTMENT_RANGES[key].neutral)
  }

  /** All seven to their neutral values, on the Draft only: they reach the Work on Apply (AC-10). */
  function reset() {
    if (!draft.value) return
    update({ ...NEUTRAL_ADJUSTMENTS })
  }

  /** Stores the Draft (an edit only when a value differs, AC-11) and closes the tool. */
  function apply() {
    const next = draft.value
    if (!next || !editor.work) return
    editor.applyAdjustments(next)
    editor.closeTool()
  }

  /** Closes the tool; the Work keeps the Adjustments it had (AC-09). */
  function cancel() {
    editor.closeTool()
  }

  return {
    draft,
    comparing,
    nothingToCorrect,
    open,
    setValue,
    commitText,
    resetOne,
    reset,
    apply,
    cancel,
    startCompare,
    endCompare,
    auto,
  }
})
