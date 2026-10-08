import { ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  ADJUSTMENT_RANGES,
  NEUTRAL_ADJUSTMENTS,
  parseAdjustmentField,
  type AdjustmentKey,
  type Adjustments,
} from '@/core'
import { useEditorStore } from '@/features/editor'

/**
 * The "Adjust" tool's state (sad.md §4, §5): the Draft, the Adjustments from when the tool opened
 * (for Cancel) and the text still being typed in each field. The Draft reaches the Preview only
 * through `editor.previewAdjustments`, and the Work only through `editor.applyAdjustments` on
 * Apply. Its only cross-feature import is the editor store.
 */
export const useAdjustStore = defineStore('adjust', () => {
  const editor = useEditorStore()
  const draft = shallowRef<Adjustments | null>(null)
  const atOpen = shallowRef<Adjustments | null>(null)
  const pending = ref<Partial<Record<AdjustmentKey, string>>>({})

  // The editor closes the slot on Apply, Cancel and a confirmed replace: the Draft goes with it.
  watch(
    () => editor.activeTool,
    (tool) => {
      if (tool === 'adjust') return
      draft.value = null
      atOpen.value = null
      pending.value = {}
    },
    { flush: 'sync' },
  )

  function update(next: Adjustments) {
    draft.value = next
    editor.setPreviewAdjustments(next)
  }

  /** Opens the tool with the Work's applied values as the Draft, or answers why it may not open. */
  function open() {
    const result = editor.openTool('adjust')
    if (!result.ok) return result
    const applied = { ...editor.work!.adjustments }
    atOpen.value = applied
    pending.value = {}
    update(applied)
    return result
  }

  /** A slider's value, already whole; snapped to the key's range all the same. */
  function setValue(key: AdjustmentKey, value: number) {
    if (!draft.value) return
    const { min, max } = ADJUSTMENT_RANGES[key]
    const next = Math.min(max, Math.max(min, Math.round(value))) || 0
    if (next !== draft.value[key]) update({ ...draft.value, [key]: next })
  }

  function setPending(key: AdjustmentKey, text: string) {
    pending.value = { ...pending.value, [key]: text }
  }

  /** Applies a field's typed text by the AC-05 rule; it never applies the tool. */
  function commitField(key: AdjustmentKey) {
    const text = pending.value[key]
    if (text === undefined) return
    const rest = { ...pending.value }
    delete rest[key]
    pending.value = rest
    if (draft.value) setValue(key, parseAdjustmentField(text, key, draft.value[key]))
  }

  /** One slider to its neutral value, on the Draft only (AC-10). */
  function resetOne(key: AdjustmentKey) {
    setValue(key, ADJUSTMENT_RANGES[key].neutral)
  }

  /** All seven to their neutral values, on the Draft only: they reach the Work on Apply (AC-10). */
  function reset() {
    if (!draft.value) return
    pending.value = {}
    update({ ...NEUTRAL_ADJUSTMENTS })
  }

  /** Stores the Draft (an edit only when a value differs, AC-11) and closes the tool. */
  function apply() {
    for (const key of Object.keys(pending.value) as AdjustmentKey[]) commitField(key)
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
    atOpen,
    pending,
    open,
    setValue,
    setPending,
    commitField,
    resetOne,
    reset,
    apply,
    cancel,
  }
})
