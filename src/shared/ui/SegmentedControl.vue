<script setup lang="ts" generic="T extends string | number">
import { computed, ref } from 'vue'

export interface SegmentedOption<V> {
  value: V
  label: string
  disabled?: boolean
  /** One line shown under the group, e.g. why the option is unavailable. */
  hint?: string
  /** The option's tooltip, such as "Brush (B)". A swatch option uses its label. */
  title?: string
  /**
   * A CSS colour shown as a filled square instead of the label text (draw's palette). The label
   * stays the accessible name and the tooltip.
   */
  swatch?: string
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
const swatches = computed(() => props.options.some((o) => o.swatch !== undefined))
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
    <div
      class="segmented__group"
      :class="{ 'segmented__group--swatches': swatches }"
      role="radiogroup"
      :aria-label="label"
    >
      <button
        v-for="(option, index) in options"
        :key="String(option.value)"
        ref="radios"
        type="button"
        role="radio"
        class="segmented__option"
        :class="{ 'segmented__option--swatch': option.swatch !== undefined }"
        :aria-label="option.swatch !== undefined ? option.label : undefined"
        :title="option.swatch !== undefined ? option.label : option.title"
        :aria-checked="option.value === modelValue ? 'true' : 'false'"
        :aria-disabled="option.disabled ? 'true' : undefined"
        :disabled="option.disabled"
        :tabindex="index === tabStop ? 0 : -1"
        @click="select(index)"
        @keydown="onKeydown($event, index)"
      >
        <span
          v-if="option.swatch !== undefined"
          class="segmented__swatch"
          :style="{ background: option.swatch }"
        />
        <template v-else>{{ option.label }}</template>
      </button>
    </div>
    <p v-for="hint in hints" :key="hint" class="segmented__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.segmented__group {
  display: flex;
  /* Wraps rather than overflow a narrow panel (crop-rotate's six proportions). */
  flex-wrap: wrap;
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

.segmented__group--swatches {
  display: grid;
  grid-template-columns: repeat(5, max-content);
}

.segmented__option--swatch {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: var(--control-height);
  padding: 0;
}

/* An inset shadow, not an outline: :focus-visible owns the outline, and both rings show. */
.segmented__option--swatch[aria-checked='true'] {
  box-shadow: inset 0 0 0 2px var(--color-text);
}

/* Forced colours drop box-shadow: draw the selected ring as an outline in the system text colour
   (a system colour keyword, as forced-colors mode replaces every author colour). */
@media (forced-colors: active) {
  .segmented__option--swatch[aria-checked='true'] {
    outline: 2px solid CanvasText;
    outline-offset: -4px;
  }

  /* The fill keeps its colour (forced-color-adjust: none), so the frame must be forced by hand. */
  .segmented__swatch {
    border-color: CanvasText;
  }
}

/* The fill is data (the palette colour); the frame comes from the tokens. */
.segmented__swatch {
  width: var(--space-4);
  height: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  /* The fill is the colour itself: forced-colors mode must not replace it with Canvas. */
  forced-color-adjust: none;
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
