<template>
  <div class="drop-overlay" data-testid="drop-overlay" aria-hidden="true">
    <p class="drop-overlay__text">Drop an image to open it</p>
  </div>
</template>

<style scoped>
/* Translucent, so the start screen's highlighted drop area shows through (ui-refresh SCR-02). */
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  display: grid;
  place-items: center;
  background: var(--color-scrim);
  pointer-events: none;
}

.drop-overlay__text {
  margin: 0;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-full);
  background: var(--color-canvas-surround);
  box-shadow: var(--shadow-md);
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
}
</style>
