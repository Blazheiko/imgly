<script setup lang="ts">
import { ref, useId } from 'vue'
import NumberField from './NumberField.vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    label: string
    min: number
    max: number
    unit?: string
    /** Applied to a typed value, as in `NumberField`; the range is already clamped and whole. */
    normalize: (raw: string, previous: number) => number
    disabled?: boolean
    /** One step of the range and of its arrow keys (Shift: ten steps). */
    step?: number
    /** Decimals the value is rounded to and shown with. */
    decimals?: number
    /** Values marked on the range, such as 0 on the straighten slider. */
    marks?: number[]
  }>(),
  { unit: undefined, disabled: false, step: 1, decimals: 0, marks: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const field = ref<InstanceType<typeof NumberField>>()
const marksId = useId()

/** Rounded to `decimals`, so 0.1 × 3 is 0.3, and clamped to the range. */
function settle(value: number): number {
  const scale = 10 ** props.decimals
  const rounded = Math.round(value * scale) / scale
  return Math.min(props.max, Math.max(props.min, rounded)) || 0
}

function onRange(event: Event) {
  emit('update:modelValue', settle(Number((event.target as HTMLInputElement).value)))
}

const ARROWS: Record<string, 1 | -1> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }

/** Arrow keys move one step, ten with Shift (crop-rotate AC-20). */
function onRangeKeydown(event: KeyboardEvent) {
  const direction = ARROWS[event.key]
  if (!direction) return
  event.preventDefault()
  const next = settle(props.modelValue + direction * props.step * (event.shiftKey ? 10 : 1))
  if (next !== props.modelValue) emit('update:modelValue', next)
}

/** Applies a value still being typed in the number field. */
function apply() {
  field.value?.apply()
}

defineExpose({ apply })
</script>

<template>
  <div class="slider-field">
    <input
      class="slider-field__range"
      type="range"
      :step="step"
      :list="marks.length > 0 ? marksId : undefined"
      :min="min"
      :max="max"
      :value="modelValue"
      :aria-label="label"
      :disabled="disabled"
      @input="onRange"
      @keydown="onRangeKeydown"
    />
    <datalist v-if="marks.length > 0" :id="marksId">
      <option v-for="mark in marks" :key="mark" :value="mark" />
    </datalist>
    <NumberField
      ref="field"
      :model-value="modelValue"
      :label="label"
      :unit="unit"
      :normalize="normalize"
      :disabled="disabled"
      :decimals="decimals"
      :decimal="decimals > 0 || min < 0"
      hide-label
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<style scoped>
.slider-field {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.slider-field__range {
  flex: 1;
  min-width: 0;
  accent-color: var(--color-accent);
}

.slider-field__range:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.slider-field__range:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
