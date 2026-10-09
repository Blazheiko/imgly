<script setup lang="ts">
import { BEFORE_LABEL } from './messages'
import { useAdjustStore } from './store'

const tool = useAdjustStore()
</script>

<template>
  <div class="adjust-before" aria-live="polite">
    <span v-if="tool.comparing" class="adjust-before__pill" data-testid="adjust-before">
      {{ BEFORE_LABEL }}
    </span>
  </div>
</template>

<style scoped>
/* Over the canvas's top-left corner while Compare is held (SCR-03); never takes the pointer. */
.adjust-before {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  pointer-events: none;
}

.adjust-before__pill {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: var(--font-size-xs);
}
</style>
