<script setup lang="ts">
import { ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    label: string
    unit?: string
    /** Turns the typed text into the value to apply (snap, round, or return `previous`). */
    normalize: (raw: string, previous: number) => number
    disabled?: boolean
    /** Hide the visible label, keeping it as the input's accessible name. */
    hideLabel?: boolean
    /** Signed decimal input (a sign, a point or a comma) instead of whole numbers. */
    decimal?: boolean
    /** Decimals the value is shown with. */
    decimals?: number
  }>(),
  { unit: undefined, disabled: false, hideLabel: false, decimal: false, decimals: 0 },
)
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const id = useId()
const shown = (value: number) =>
  props.decimals > 0 ? value.toFixed(props.decimals) : String(value)
const text = ref(shown(props.modelValue))
let pending = false

watch(
  () => props.modelValue,
  (value) => {
    if (!pending) text.value = shown(value)
  },
)

function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value
  pending = true
}

/** Applies a value still being typed, as leaving the field would; does nothing otherwise. */
function apply() {
  if (!pending) return
  pending = false
  const value = props.normalize(text.value, props.modelValue)
  text.value = shown(value)
  if (value !== props.modelValue) emit('update:modelValue', value)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    // Drops a value still being typed; Escape still reaches whatever it closes (crop-rotate AC-20).
    pending = false
    text.value = shown(props.modelValue)
    return
  }
  if (event.key !== 'Enter') return
  // Enter only applies the value: it never submits a form or confirms the surrounding panel.
  event.preventDefault()
  event.stopPropagation()
  apply()
}

defineExpose({ apply })
</script>

<template>
  <div class="number-field">
    <label :for="id" class="number-field__label" :class="{ 'visually-hidden': hideLabel }">
      {{ label }}
    </label>
    <input
      :id="id"
      class="number-field__input"
      type="text"
      :inputmode="decimal ? 'decimal' : 'numeric'"
      autocomplete="off"
      :value="text"
      :disabled="disabled"
      @input="onInput"
      @blur="apply"
      @keydown="onKeydown"
    />
    <span v-if="unit" class="number-field__unit">{{ unit }}</span>
  </div>
</template>

<style scoped>
.number-field {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.number-field__label {
  color: var(--color-text-muted);
}

.number-field__input {
  width: calc(var(--control-height) * 2);
  min-height: var(--control-height);
  padding: 0 var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-family: var(--font-mono);
  text-align: right;
}

.number-field__input:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 1px;
}

.number-field__input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.number-field__unit {
  color: var(--color-text-muted);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
