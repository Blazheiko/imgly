<script setup lang="ts">
import type { NoticeKind } from '../notices'

defineProps<{ kind: NoticeKind; text: string }>()
defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div
    class="toast"
    :class="`toast--${kind}`"
    :role="kind === 'failure' ? 'alert' : 'status'"
    :aria-live="kind === 'failure' ? 'assertive' : 'polite'"
  >
    <p class="toast__text">{{ text }}</p>
    <button type="button" class="toast__dismiss" aria-label="Dismiss" @click="$emit('dismiss')">
      ×
    </button>
  </div>
</template>

<style scoped>
.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  max-width: var(--toast-max-width);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-left-width: 3px;
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.toast--info {
  border-left-color: var(--color-accent);
}

.toast--failure {
  border-left-color: var(--color-danger);
}

.toast__text {
  flex: 1;
  margin: 0;
}

.toast__dismiss {
  min-width: var(--space-6);
  min-height: var(--space-6);
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-lg);
  line-height: 1;
  cursor: pointer;
}

.toast__dismiss:hover {
  color: var(--color-text);
}

.toast__dismiss:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
</style>
