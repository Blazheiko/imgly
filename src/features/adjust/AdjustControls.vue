<script lang="ts">
/** Marked on the frame after Auto's values reach the sliders and the Preview (sad.md §7). */
export const AUTO_SHOWN_MARK = 'imgly:adjust-auto-shown'
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { ADJUSTMENT_RANGES, type AdjustmentKey } from '@/core'
import { useEditorStore } from '@/features/editor'
import { BaseButton, SliderField } from '@/shared'
import {
  BUTTONS,
  COMPARE_TOOLTIP,
  GROUPS,
  hintNothingToCorrect,
  SLIDER_LABELS,
  SLIDER_TOOLTIP,
} from './messages'
import { useAdjustStore } from './store'

const editor = useEditorStore()
const tool = useAdjustStore()

/** The three groups of SCR-03, in AC-01's order. */
const GROUP_KEYS: { heading: string; keys: AdjustmentKey[] }[] = [
  { heading: GROUPS.light, keys: ['brightness', 'contrast'] },
  { heading: GROUPS.colour, keys: ['saturation', 'temperature', 'tint'] },
  { heading: GROUPS.effects, keys: ['grayscale', 'sepia'] },
]

const PERCENT: ReadonlySet<AdjustmentKey> = new Set(['grayscale', 'sepia'])

/** Auto needs the Preview's context to sample the Work (ADR-0004). */
const autoAvailable = computed(() => editor.display === 'ok')

/**
 * A field's typed text goes through the store, which applies the AC-05 rule; the field then shows
 * the value the Draft ended with.
 */
function commit(key: AdjustmentKey) {
  return (raw: string) => {
    tool.setPending(key, raw)
    tool.commitField(key)
    return tool.draft?.[key] ?? ADJUSTMENT_RANGES[key].neutral
  }
}

/**
 * Auto, then the performance mark the @perf suite times: two frames, because the Preview draws in
 * the first frame after the Draft changes.
 */
function onAuto() {
  tool.auto()
  requestAnimationFrame(() => requestAnimationFrame(() => performance.mark(AUTO_SHOWN_MARK)))
}

function onCompareDown(event: PointerEvent) {
  if (event.button === 0) tool.startCompare()
}

const HOLD_KEYS = new Set([' ', 'Enter'])

/**
 * Space or Enter held on the focused button holds Compare (AC-08). The keys stop here, so they
 * neither click the button nor reach the tool's Enter-applies handler.
 */
function onCompareKeydown(event: KeyboardEvent) {
  if (!HOLD_KEYS.has(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  if (!event.repeat) tool.startCompare()
}

function onCompareKeyup(event: KeyboardEvent) {
  if (!HOLD_KEYS.has(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  tool.endCompare()
}
</script>

<template>
  <div v-if="tool.draft" class="adjust-controls" data-testid="adjust-controls">
    <section v-for="group in GROUP_KEYS" :key="group.heading" class="adjust-controls__group">
      <h3 class="adjust-controls__heading">{{ group.heading }}</h3>
      <SliderField
        v-for="key in group.keys"
        :key="key"
        :model-value="tool.draft[key]"
        :label="SLIDER_LABELS[key]"
        :min="ADJUSTMENT_RANGES[key].min"
        :max="ADJUSTMENT_RANGES[key].max"
        :marks="[ADJUSTMENT_RANGES[key].neutral]"
        :neutral="ADJUSTMENT_RANGES[key].neutral"
        :range-title="SLIDER_TOOLTIP"
        :unit="PERCENT.has(key) ? '%' : undefined"
        :normalize="commit(key)"
        :data-testid="`adjust-slider-${key}`"
        @update:model-value="tool.setValue(key, $event)"
      />
    </section>

    <section class="adjust-controls__group">
      <div class="adjust-controls__row">
        <BaseButton
          :pressed="tool.comparing"
          :title="COMPARE_TOOLTIP"
          data-testid="adjust-compare"
          @pointerdown="onCompareDown"
          @pointerup="tool.endCompare()"
          @pointercancel="tool.endCompare()"
          @pointerleave="tool.endCompare()"
          @keydown="onCompareKeydown"
          @keyup="onCompareKeyup"
          @blur="tool.endCompare()"
        >
          {{ BUTTONS.compare }}
        </BaseButton>
        <BaseButton :disabled="!autoAvailable" data-testid="adjust-auto" @click="onAuto">
          {{ BUTTONS.auto }}
        </BaseButton>
      </div>
      <p class="adjust-controls__hint" role="status">
        {{ tool.nothingToCorrect ? hintNothingToCorrect() : '' }}
      </p>
    </section>

    <footer class="adjust-controls__footer">
      <BaseButton variant="ghost" @click="tool.reset()">{{ BUTTONS.reset }}</BaseButton>
      <span class="adjust-controls__spacer" />
      <BaseButton variant="secondary" @click="tool.cancel()">{{ BUTTONS.cancel }}</BaseButton>
      <BaseButton variant="primary" data-testid="adjust-apply" @click="tool.apply()">
        {{ BUTTONS.apply }}
      </BaseButton>
    </footer>
  </div>
</template>

<style scoped>
.adjust-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
}

.adjust-controls__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.adjust-controls__heading {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.adjust-controls__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.adjust-controls__hint {
  min-height: var(--space-4);
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.adjust-controls__footer {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.adjust-controls__spacer {
  flex: 1;
}
</style>
