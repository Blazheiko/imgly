<script setup lang="ts">
import { computed } from 'vue'
import { workSize } from '@/core'
import { useEditorStore } from '../store'
import DimensionsReadout from './DimensionsReadout.vue'
import ZoomBar from './ZoomBar.vue'

const editor = useEditorStore()

/** The applied Work's size, never the open tool's Draft (screens.md §Shell changes). */
const size = computed(() => (editor.work ? workSize(editor.work) : { width: 0, height: 0 }))

/** The Original's dimensions whenever width or height differs, compared in order (AC-01). */
const from = computed(() => {
  const original = editor.work?.original
  if (!original) return undefined
  const same = original.width === size.value.width && original.height === size.value.height
  return same ? undefined : { width: original.width, height: original.height }
})
</script>

<template>
  <footer v-if="editor.work" class="editor-status-bar" data-testid="editor-status-bar">
    <DimensionsReadout :width="size.width" :height="size.height" :from="from" />
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
