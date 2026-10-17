<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'vue'
import type { IconName } from '../icons'
import Icon from './Icon.vue'
import Spinner from './Spinner.vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    /** A registry icon drawn before the label; with no label the button is icon-only. */
    icon?: IconName
    /** A Spinner takes the icon's place, so the button still shows one symbol. */
    busy?: boolean
    /** The Spinner's status text while busy, announced as part of the name; none by default. */
    busyLabel?: string
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    /** A toggle's state, as `aria-pressed`; left out for ordinary buttons. */
    pressed?: boolean
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    icon: undefined,
    busy: false,
    busyLabel: undefined,
    type: 'button',
    disabled: false,
    pressed: undefined,
  },
)

const slots = useSlots()
const attrs = useAttrs()
const iconOnly = computed(() => props.icon !== undefined && !slots.default)
const iconSize = computed(() => (props.size === 'lg' ? 'md' : 'sm'))

// An icon-only button is named only by its aria-label (ui-refresh AC-03).
if (import.meta.env.DEV && iconOnly.value && !attrs['aria-label']) {
  console.warn(`BaseButton: icon-only "${props.icon}" needs an aria-label and a title`)
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :aria-pressed="pressed === undefined ? undefined : pressed ? 'true' : 'false'"
    class="base-button"
    :class="[
      `base-button--${variant}`,
      `base-button--${size}`,
      { 'base-button--pressed': pressed, 'base-button--icon-only': iconOnly },
    ]"
  >
    <!-- The label names the button; the Spinner's status is read out only with a busyLabel. -->
    <span
      v-if="busy"
      class="base-button__icon"
      :class="`base-button__icon--${iconSize}`"
      :aria-hidden="busyLabel ? undefined : 'true'"
      ><Spinner :label="busyLabel ?? ''"
    /></span>
    <Icon v-else-if="icon" :name="icon" :size="iconSize" />
    <slot />
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--control-height-md);
  padding: 0 var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.base-button--sm {
  min-height: var(--control-height-sm);
  padding: 0 var(--space-3);
}

.base-button--lg {
  min-height: var(--control-height-lg);
  padding: 0 var(--space-5);
  font-size: var(--font-size-md);
}

.base-button--icon-only {
  min-width: var(--control-height-md);
  padding: 0;
}

.base-button--icon-only.base-button--sm {
  min-width: var(--control-height-sm);
}

.base-button--icon-only.base-button--lg {
  min-width: var(--control-height-lg);
}

.base-button__icon {
  display: inline-flex;
}

.base-button__icon--sm :deep(.spinner__ring) {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.base-button__icon--md :deep(.spinner__ring) {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
}

.base-button:hover,
.base-button:active {
  /* Only pointing animates: a change of availability (enabled ↔ unavailable) repaints at once. */
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

/* The ring sits on the surrounding surface, never on the button's own colour (AC-13). */
.base-button:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.base-button--primary {
  background: var(--color-accent-gradient);
  color: var(--color-on-accent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--color-on-accent) 24%, transparent),
    var(--shadow-sm);
}

.base-button--primary:hover {
  background: var(--color-accent-hover);
}

.base-button--primary:active {
  background: var(--color-accent-active);
}

.base-button--secondary {
  background: var(--color-surface-raised);
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.base-button--secondary:hover {
  background: var(--color-accent-subtle);
}

.base-button--secondary:active {
  border-color: var(--color-accent-text);
}

.base-button--ghost {
  background: transparent;
  color: inherit;
}

.base-button--ghost:hover {
  background: var(--color-accent-subtle);
}

.base-button--ghost:active {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent-text);
}

.base-button--danger {
  background: var(--color-danger-solid);
  color: var(--color-on-accent);
}

.base-button--danger:hover,
.base-button--danger:active {
  background: var(--color-danger-solid-hover);
}

.base-button--pressed,
.base-button--pressed:hover,
.base-button--pressed:active {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent-text);
}

/* Disabled and unavailable (aria-disabled, still focusable) share one neutral look, never a
   faded brand colour (AC-13); this block comes last so it wins over every variant and pressed. */
.base-button:disabled,
.base-button[aria-disabled='true'] {
  background: var(--color-surface-sunken);
  border-color: transparent;
  box-shadow: none;
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.base-button--ghost:disabled,
.base-button--ghost[aria-disabled='true'] {
  background: transparent;
}
</style>
