<template>
  <div class="drop-overlay" data-testid="drop-overlay" aria-hidden="true">
    <p class="drop-overlay__text">Drop an image to open it</p>
  </div>
</template>

<style scoped>
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  display: grid;
  place-items: center;
  margin: var(--space-2);
  border: 2px dashed var(--color-accent);
  border-radius: var(--radius-lg);
  background: var(--color-canvas-surround);
  opacity: 0.92;
  pointer-events: none;
}

.drop-overlay__text {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
}
</style>
