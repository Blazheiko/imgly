<script setup lang="ts">
import { BaseButton } from '@/shared'

defineEmits<{ open: [] }>()
</script>

<template>
  <div class="empty-canvas" data-testid="empty-canvas">
    <BaseButton variant="primary" @click="$emit('open')">Open image</BaseButton>
    <p class="empty-canvas__hint">or drop an image anywhere in this window</p>
  </div>
</template>

<style scoped>
.empty-canvas {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  height: 100%;
}

.empty-canvas__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
