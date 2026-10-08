<script setup lang="ts">
import type { Size } from '@/core'

/** The Work's size; `from` is the Original's when the Geometry changed it (crop-rotate AC-01). */
defineProps<{ width: number; height: number; from?: Size }>()
</script>

<template>
  <span class="dimensions-readout" data-testid="dimensions-readout"
    >{{ width }} × {{ height }} px<span v-if="from"
      >, from {{ from.width }} × {{ from.height }} px</span
    ></span
  >
</template>

<style scoped>
.dimensions-readout {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
}
</style>
