<script setup lang="ts" generic="T extends string | number">
import { computed, ref } from 'vue'

export interface SegmentedOption<V> {
  value: V
  label: string
  disabled?: boolean
  /** One line shown under the group, e.g. why the option is unavailable. */
  hint?: string
}

const props = defineProps<{
  /** `null` selects nothing (e.g. a typed size that matches no preset). */
  modelValue: T | null
  options: readonly SegmentedOption<T>[]
  label: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const radios = ref<HTMLButtonElement[]>([])
/** The option in the tab order: the selected one, else the first enabled one (roving tabindex). */
const tabStop = computed(() => {
  const selected = props.options.findIndex((o) => o.value === props.modelValue && !o.disabled)
  return selected >= 0 ? selected : props.options.findIndex((o) => !o.disabled)
})
const hints = computed(() => props.options.flatMap((option) => (option.hint ? [option.hint] : [])))

function select(index: number) {
  const option = props.options[index]
  if (!option || option.disabled) return
  if (option.value !== props.modelValue) emit('update:modelValue', option.value)
  radios.value[index]?.focus()
}

const STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

function onKeydown(event: KeyboardEvent, from: number) {
  const step = STEPS[event.key]
  if (step === undefined) return
  event.preventDefault()
  const count = props.options.length
  for (let i = 1; i < count; i++) {
    const index = (from + step * i + count * count) % count
    if (!props.options[index]?.disabled) {
      select(index)
      return
    }
  }
}
</script>

<template>
  <div class="segmented">
    <div class="segmented__group" role="radiogroup" :aria-label="label">
      <button
        v-for="(option, index) in options"
        :key="String(option.value)"
        ref="radios"
        type="button"
        role="radio"
        class="segmented__option"
        :aria-checked="option.value === modelValue ? 'true' : 'false'"
        :aria-disabled="option.disabled ? 'true' : undefined"
        :disabled="option.disabled"
        :tabindex="index === tabStop ? 0 : -1"
        @click="select(index)"
        @keydown="onKeydown($event, index)"
      >
        {{ option.label }}
      </button>
    </div>
    <p v-for="hint in hints" :key="hint" class="segmented__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.segmented__group {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.segmented__option {
  flex: 1;
  min-height: calc(var(--control-height) - 2 * var(--space-1));
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.segmented__option[aria-checked='true'] {
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.segmented__option:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 1px;
}

.segmented__option:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.segmented__hint {
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
</style>
