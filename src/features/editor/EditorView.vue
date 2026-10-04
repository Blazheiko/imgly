<script setup lang="ts">
import { useEditorStore } from './store'

const editor = useEditorStore()
</script>

<template>
  <main class="editor-view" data-testid="editor-view">
    <section class="editor-view__canvas" aria-label="Canvas">
      <p v-if="!editor.work" class="editor-view__empty">No image open</p>
    </section>
  </main>
</template>

<style scoped>
.editor-view {
  display: flex;
  height: 100%;
}

.editor-view__canvas {
  flex: 1;
  display: grid;
  place-items: center;
  background: var(--color-canvas-surround);
}

.editor-view__empty {
  color: var(--color-text-muted);
}
</style>
