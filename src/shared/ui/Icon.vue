<script setup lang="ts">
// One icon from the shared registry (ADR-0001). Icons are decoration: the button's label or
// aria-label names it, so the svg is hidden from assistive technology and never takes focus.
import { icons, type IconName } from '../icons'

withDefaults(defineProps<{ name: IconName; size?: 'sm' | 'md' | 'lg' }>(), { size: 'sm' })
</script>

<template>
  <svg
    :class="['icon', `icon--${size}`]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <component :is="tag" v-for="([tag, attrs], index) in icons[name]" :key="index" v-bind="attrs" />
  </svg>
</template>

<style scoped>
.icon {
  flex: none;
  display: block;
}

.icon--sm {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.icon--md {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
}

.icon--lg {
  width: var(--icon-size-lg);
  height: var(--icon-size-lg);
}
</style>
