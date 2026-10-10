<script setup lang="ts">
import { computed } from 'vue'
import { MAX_WIDTH, MIN_WIDTH, PALETTE, type DrawMode } from '@/core'
import { BaseButton, SegmentedControl, SliderField } from '@/shared'
import { BUTTONS, CUSTOM_COLOUR, GROUPS, MODES, WIDTH_LABEL, WIDTH_TOOLTIP } from './messages'
import { useDrawStore } from './store'

const tool = useDrawStore()

const MODE_OPTIONS = (['brush', 'eraser'] as const).map((value) => ({
  value,
  label: MODES[value].label,
  title: MODES[value].tooltip,
}))

const SWATCHES = PALETTE.map(({ name, hex }) => ({ value: hex, label: name, swatch: hex }))

/** The chosen preset, or null for a custom colour that matches none (screens.md SCR-03). */
const preset = computed(() => (PALETTE.some((c) => c.hex === tool.colour) ? tool.colour : null))
</script>

<template>
  <div v-if="tool.isOpen" class="draw-controls" data-testid="draw-controls">
    <section class="draw-controls__group">
      <h3 class="draw-controls__heading">{{ GROUPS.mode }}</h3>
      <SegmentedControl
        :model-value="tool.mode"
        :options="MODE_OPTIONS"
        :label="GROUPS.mode"
        @update:model-value="tool.setMode($event as DrawMode)"
      />
    </section>

    <section class="draw-controls__group">
      <h3 class="draw-controls__heading">{{ GROUPS.colour }}</h3>
      <div class="draw-controls__colours">
        <SegmentedControl
          :model-value="preset"
          :options="SWATCHES"
          :label="GROUPS.colour"
          @update:model-value="tool.setColour($event)"
        />
        <label
          class="draw-controls__custom"
          :class="{ 'draw-controls__custom--selected': preset === null }"
          :title="CUSTOM_COLOUR"
        >
          <input
            class="draw-controls__picker"
            type="color"
            :value="tool.colour.toLowerCase()"
            :aria-label="CUSTOM_COLOUR"
            @input="tool.setColour(($event.target as HTMLInputElement).value)"
          />
          <span
            class="draw-controls__custom-swatch"
            :class="{ 'draw-controls__custom-swatch--empty': preset !== null }"
            :style="preset === null ? { background: tool.colour } : undefined"
          />
          <span class="draw-controls__custom-label">{{ CUSTOM_COLOUR }}</span>
        </label>
      </div>
    </section>

    <section class="draw-controls__group">
      <h3 class="draw-controls__heading">{{ GROUPS.width }}</h3>
      <SliderField
        :model-value="tool.width"
        :label="WIDTH_LABEL"
        :min="MIN_WIDTH"
        :max="MAX_WIDTH"
        unit="px"
        :range-title="WIDTH_TOOLTIP"
        :normalize="(raw: string) => tool.commitWidthText(raw)"
        data-testid="draw-width"
        @update:model-value="tool.setWidth($event)"
      />
    </section>

    <footer class="draw-controls__footer">
      <BaseButton variant="ghost" data-testid="draw-clear" @click="tool.clear()">
        {{ BUTTONS.clear }}
      </BaseButton>
      <span class="draw-controls__spacer" />
      <BaseButton variant="secondary" data-testid="draw-cancel" @click="tool.cancel()">
        {{ BUTTONS.cancel }}
      </BaseButton>
      <BaseButton variant="primary" data-testid="draw-apply" @click="tool.apply()">
        {{ BUTTONS.apply }}
      </BaseButton>
    </footer>
  </div>
</template>

<style scoped>
.draw-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
}

.draw-controls__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.draw-controls__heading {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.draw-controls__colours {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-2);
}

.draw-controls__custom {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.draw-controls__custom--selected .draw-controls__custom-swatch {
  outline: 2px solid var(--color-text);
  outline-offset: 2px;
}

.draw-controls__custom:focus-within {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 1px;
}

/* The native input stays focusable and clickable over the drawn swatch. */
.draw-controls__picker {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.draw-controls__custom-swatch {
  width: var(--space-4);
  height: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.draw-controls__custom-swatch--empty {
  border-style: dashed;
}

.draw-controls__footer {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.draw-controls__spacer {
  flex: 1;
}
</style>
