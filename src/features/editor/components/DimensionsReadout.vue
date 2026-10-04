<script setup lang="ts">
defineProps<{ width: number; height: number }>()
</script>

<template>
  <span class="dimensions-readout" data-testid="dimensions-readout"
    >{{ width }} × {{ height }} px</span
  >
</template>

<style scoped>
.dimensions-readout {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
}
</style>
