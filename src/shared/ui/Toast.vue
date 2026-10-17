<script setup lang="ts">
import type { NoticeAction, NoticeKind } from '../notices'
import BaseButton from './BaseButton.vue'

defineProps<{ kind: NoticeKind; text: string; action?: NoticeAction }>()
const emit = defineEmits<{ dismiss: [] }>()

function runAction(action: NoticeAction, event: MouseEvent): void {
  // Safari and Firefox on macOS do not focus a clicked button; a dialog the action opens must find
  // the action as the element to return focus to (pwa-install-update AC-12).
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
  if (action.busy) return
  if (action.run() !== 'keep-open') emit('dismiss')
}
</script>

<template>
  <div
    class="toast"
    :class="`toast--${kind}`"
    :role="kind === 'failure' ? 'alert' : 'status'"
    :aria-live="kind === 'failure' ? 'assertive' : 'polite'"
  >
    <p class="toast__text">{{ text }}</p>
    <BaseButton
      v-if="action"
      variant="ghost"
      size="sm"
      :icon="action.icon"
      :busy="action.busy"
      :aria-disabled="action.busy ? 'true' : undefined"
      :class="{ 'toast__action--busy': action.busy }"
      @click="runAction(action, $event)"
    >
      <!-- The busy Spinner has no busyLabel, so the visible text names the button only once. -->
      {{ action.busy ? (action.busyLabel ?? action.label) : action.label }}
    </BaseButton>
    <BaseButton
      variant="ghost"
      size="sm"
      icon="x"
      class="toast__dismiss"
      aria-label="Dismiss"
      title="Dismiss"
      @click="$emit('dismiss')"
    />
  </div>
</template>

<style scoped>
.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  max-width: var(--toast-max-width);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border-subtle);
  border-left-width: 3px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.toast--info,
.toast--lasting {
  border-left-color: var(--color-accent-text);
}

.toast--failure {
  border-left-color: var(--color-danger);
}

.toast__action--busy {
  cursor: progress;
}

.toast__text {
  flex: 1;
  margin: 0;
}

.toast__dismiss {
  flex: none;
}
</style>
