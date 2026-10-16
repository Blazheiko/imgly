<script setup lang="ts">
import type { NoticeAction, NoticeKind } from '../notices'
import BaseButton from './BaseButton.vue'
import Spinner from './Spinner.vue'

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
      :aria-disabled="action.busy ? 'true' : undefined"
      :class="{ 'toast__action--busy': action.busy }"
      @click="runAction(action, $event)"
    >
      <template v-if="action.busy">
        <!-- The visible text names the button; the Spinner beside it is not read out again. -->
        <span class="toast__spinner" aria-hidden="true"
          ><Spinner :label="action.busyLabel ?? action.label"
        /></span>
        {{ action.busyLabel ?? action.label }}
      </template>
      <template v-else>{{ action.label }}</template>
    </BaseButton>
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

.toast--info,
.toast--lasting {
  border-left-color: var(--color-accent);
}

.toast--failure {
  border-left-color: var(--color-danger);
}

.toast__action--busy {
  cursor: progress;
}

.toast__spinner :deep(.spinner__ring) {
  width: var(--space-4);
  height: var(--space-4);
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
