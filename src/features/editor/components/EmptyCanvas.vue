<script setup lang="ts">
import { BaseButton, Icon } from '@/shared'

// The start screen's drop area (ui-refresh SCR-02). The card is decoration: only its button opens
// the picker, and it adds no keyboard stop. A drop works anywhere in the window, as before.
defineProps<{ highlighted: boolean }>()
defineEmits<{ open: [] }>()
</script>

<template>
  <div
    class="empty-canvas"
    :class="{ 'empty-canvas--highlighted': highlighted }"
    data-testid="empty-canvas"
  >
    <Icon name="image-plus" size="lg" class="empty-canvas__icon" />
    <p class="empty-canvas__heading">Open an image to start</p>
    <BaseButton variant="primary" size="lg" icon="image-plus" @click="$emit('open')"
      >Open image</BaseButton
    >
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
  padding: var(--space-8);
  border: 2px dashed var(--color-border-strong);
  border-radius: var(--radius-xl);
  background: var(--color-surface-raised);
}

/* A colour change only, so reduced motion needs nothing more (AC-14). */
.empty-canvas--highlighted {
  border: 2px solid var(--color-accent-text);
  background: var(--color-accent-subtle);
}

.empty-canvas__icon {
  color: var(--color-accent-text);
}

.empty-canvas__heading {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--tracking-tight);
  line-height: var(--line-height-tight);
}

.empty-canvas__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
