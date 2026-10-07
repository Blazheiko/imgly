<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    /** A toggle's state, as `aria-pressed`; left out for ordinary buttons. */
    pressed?: boolean
  }>(),
  { variant: 'secondary', type: 'button', disabled: false, pressed: undefined },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :aria-pressed="pressed === undefined ? undefined : pressed ? 'true' : 'false'"
    class="base-button"
    :class="[`base-button--${variant}`, { 'base-button--pressed': pressed }]"
  >
    <slot />
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--control-height);
  padding: 0 var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease;
}

.base-button:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.base-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.base-button--primary {
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.base-button--primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.base-button--primary:active:not(:disabled) {
  background: var(--color-accent-active);
}

.base-button--secondary {
  background: var(--color-surface-raised);
  border-color: var(--color-border);
  color: var(--color-text);
}

.base-button--secondary:hover:not(:disabled) {
  border-color: var(--color-text-muted);
}

.base-button--secondary:active:not(:disabled) {
  background: var(--color-surface);
}

.base-button--ghost {
  background: transparent;
  color: var(--color-text);
}

.base-button--ghost:hover:not(:disabled) {
  background: var(--color-surface-raised);
}

.base-button--ghost:active:not(:disabled) {
  background: var(--color-surface);
}
.base-button--pressed,
.base-button--pressed:hover:not(:disabled) {
  background: var(--color-surface);
  border-color: var(--color-accent);
  color: var(--color-text);
}
</style>
