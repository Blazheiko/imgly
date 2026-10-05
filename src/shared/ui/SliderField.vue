<script setup lang="ts">
import { ref } from 'vue'
import NumberField from './NumberField.vue'

withDefaults(
  defineProps<{
    modelValue: number
    label: string
    min: number
    max: number
    unit?: string
    /** Applied to a typed value, as in `NumberField`; the range is already clamped and whole. */
    normalize: (raw: string, previous: number) => number
    disabled?: boolean
  }>(),
  { unit: undefined, disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const field = ref<InstanceType<typeof NumberField>>()

function onRange(event: Event) {
  emit('update:modelValue', Number((event.target as HTMLInputElement).value))
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
      step="1"
      :min="min"
      :max="max"
      :value="modelValue"
      :aria-label="label"
      :disabled="disabled"
      @input="onRange"
    />
    <NumberField
      ref="field"
      :model-value="modelValue"
      :label="label"
      :unit="unit"
      :normalize="normalize"
      :disabled="disabled"
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
