<script setup lang="ts">
import type { NoticeAction, NoticeKind } from '../notices'
import BaseButton from './BaseButton.vue'
import Icon from './Icon.vue'
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
      size="sm"
      :icon="action.busy ? undefined : action.icon"
      :aria-disabled="action.busy ? 'true' : undefined"
      :class="{ 'toast__action--busy': action.busy }"
      @click="runAction(action, $event)"
    >
      <template v-if="action.busy">
        <!-- In the icon's place; the visible text names the button, so it is not read out again. -->
        <span class="toast__spinner" aria-hidden="true"><Spinner label="" /></span>
        {{ action.busyLabel ?? action.label }}
      </template>
      <template v-else>{{ action.label }}</template>
    </BaseButton>
    <!-- A native button, styled as BaseButton's ghost sm icon-only look (ui-refresh SCR-06). -->
    <button
      type="button"
      class="toast__dismiss"
      aria-label="Dismiss"
      title="Dismiss"
      @click="$emit('dismiss')"
    >
      <Icon name="x" />
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

.toast__spinner {
  display: inline-flex;
}

.toast__spinner :deep(.spinner__ring) {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.toast__text {
  flex: 1;
  margin: 0;
}

.toast__dismiss {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-width: var(--control-height-sm);
  min-height: var(--control-height-sm);
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.toast__dismiss:hover {
  background: var(--color-accent-subtle);
  color: var(--color-text);
}

.toast__dismiss:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
</style>
