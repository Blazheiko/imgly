<script setup lang="ts">
import { computed } from 'vue'
import type { ProportionKind, ProportionOrientation } from '@/core'
import { BaseButton, NumberField, SegmentedControl, SliderField } from '@/shared'
import { LABELS, PROPORTION_LABELS } from './messages'
import { useCropRotateStore, type CropField } from './store'

const tool = useCropRotateStore()

/** The Draft's angle in degrees; the store keeps tenths (ADR-0001). */
const degrees = computed(() => (tool.draft?.straighten ?? 0) / 10)
const width = computed(() => tool.draft?.crop.width ?? 1)
const height = computed(() => tool.draft?.crop.height ?? 1)

const proportionOptions = (Object.keys(PROPORTION_LABELS) as ProportionKind[]).map((value) => ({
  value,
  label: PROPORTION_LABELS[value],
}))

/** Orientation means nothing for Free and 1:1 (AC-08). */
const orientationOff = computed(
  () => tool.proportion.kind === 'free' || tool.proportion.kind === '1:1',
)
const orientationOptions = computed(() =>
  (['landscape', 'portrait'] as const).map((value) => ({
    value,
    label: LABELS[value],
    disabled: orientationOff.value,
  })),
)

function chooseKind(kind: ProportionKind) {
  tool.chooseProportion({ kind, orientation: tool.proportion.orientation })
}

function chooseOrientation(orientation: ProportionOrientation) {
  tool.chooseProportion({ ...tool.proportion, orientation })
}

/**
 * A field's typed text goes through the store, which applies the core rules (AC-07, AC-10); the
 * field then shows the value the Draft ended with.
 */
function commit(field: CropField) {
  return (raw: string) => {
    tool.setPending(field, raw)
    tool.commitField(field)
    if (field === 'angle') return degrees.value
    return field === 'width' ? width.value : height.value
  }
}

function onSlider(value: number) {
  tool.setAngle(Math.round(value * 10))
}
</script>

<template>
  <div v-if="tool.draft" class="crop-controls" data-testid="crop-rotate-controls">
    <section class="crop-controls__group">
      <h3 class="crop-controls__heading">{{ LABELS.rotateAndFlip }}</h3>
      <div class="crop-controls__row">
        <BaseButton
          variant="ghost"
          :aria-label="LABELS.rotateLeft"
          :title="LABELS.rotateLeft"
          @click="tool.rotate('ccw')"
        >
          <svg class="crop-controls__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              d="M3 8a5 5 0 1 0 2-4M5 1v3H2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
        </BaseButton>
        <BaseButton
          variant="ghost"
          :aria-label="LABELS.rotateRight"
          :title="LABELS.rotateRight"
          @click="tool.rotate('cw')"
        >
          <svg class="crop-controls__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              d="M13 8a5 5 0 1 1-2-4M11 1v3h3"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
        </BaseButton>
        <BaseButton
          variant="ghost"
          :aria-label="LABELS.flipHorizontal"
          :title="LABELS.flipHorizontal"
          @click="tool.flip('horizontal')"
        >
          <svg class="crop-controls__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              d="M8 1v14M6 4 2 12h4zM10 4l4 8h-4z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
        </BaseButton>
        <BaseButton
          variant="ghost"
          :aria-label="LABELS.flipVertical"
          :title="LABELS.flipVertical"
          @click="tool.flip('vertical')"
        >
          <svg class="crop-controls__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              d="M1 8h14M4 6l8-4v4zM4 10l8 4v-4z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
        </BaseButton>
      </div>
    </section>

    <section class="crop-controls__group">
      <h3 class="crop-controls__heading">{{ LABELS.straighten }}</h3>
      <SliderField
        :model-value="degrees"
        :label="LABELS.straighten"
        :min="-45"
        :max="45"
        :step="0.1"
        :decimals="1"
        :marks="[0]"
        unit="°"
        :normalize="commit('angle')"
        @update:model-value="onSlider"
      />
    </section>

    <section class="crop-controls__group">
      <h3 class="crop-controls__heading">{{ LABELS.proportion }}</h3>
      <SegmentedControl
        :model-value="tool.proportion.kind"
        :options="proportionOptions"
        :label="LABELS.proportion"
        @update:model-value="chooseKind"
      />
      <SegmentedControl
        :model-value="orientationOff ? null : tool.proportion.orientation"
        :options="orientationOptions"
        :label="LABELS.orientation"
        @update:model-value="chooseOrientation"
      />
    </section>

    <section class="crop-controls__group">
      <h3 class="crop-controls__heading">{{ LABELS.size }}</h3>
      <div class="crop-controls__row">
        <NumberField
          :model-value="width"
          :label="LABELS.width"
          unit="px"
          :normalize="commit('width')"
        />
        <NumberField
          :model-value="height"
          :label="LABELS.height"
          unit="px"
          :normalize="commit('height')"
        />
      </div>
    </section>

    <footer class="crop-controls__footer">
      <BaseButton variant="ghost" @click="tool.reset()">{{ LABELS.reset }}</BaseButton>
      <span class="crop-controls__spacer" />
      <BaseButton variant="secondary" @click="tool.cancel()">{{ LABELS.cancel }}</BaseButton>
      <BaseButton variant="primary" data-testid="crop-apply" @click="tool.apply()">
        {{ LABELS.apply }}
      </BaseButton>
    </footer>
  </div>
</template>

<style scoped>
.crop-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
}

.crop-controls__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.crop-controls__heading {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.crop-controls__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.crop-controls__icon {
  width: var(--space-4);
  height: var(--space-4);
}

.crop-controls__footer {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.crop-controls__spacer {
  flex: 1;
}
</style>
