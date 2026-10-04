<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="spinner" role="status">
    <span class="spinner__ring" aria-hidden="true" />
    <span class="spinner__label">{{ label }}</span>
  </div>
</template>

<style scoped>
.spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.spinner__ring {
  width: var(--space-7);
  height: var(--space-7);
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spinner-turn 0.8s linear infinite;
}

.spinner__label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@keyframes spinner-turn {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner__ring {
    animation-duration: 2.4s;
  }
}
</style>
