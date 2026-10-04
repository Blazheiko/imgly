<script setup lang="ts">
import { useEditorStore } from '../store'
import DimensionsReadout from './DimensionsReadout.vue'
import ZoomBar from './ZoomBar.vue'

const editor = useEditorStore()
</script>

<template>
  <footer v-if="editor.work" class="editor-status-bar" data-testid="editor-status-bar">
    <DimensionsReadout :width="editor.work.original.width" :height="editor.work.original.height" />
    <ZoomBar />
  </footer>
</template>

<style scoped>
.editor-status-bar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: var(--toolbar-size);
  padding: var(--space-1) var(--space-4);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}
</style>
