<script setup lang="ts">
import { computed } from 'vue'
import { BaseButton } from '@/shared'
import { useEditorStore } from '../store'

const editor = useEditorStore()
const level = computed(() => `${Math.round(editor.view.zoom * 100)}%`)
</script>

<template>
  <div class="zoom-bar" role="group" aria-label="Zoom">
    <BaseButton
      variant="ghost"
      aria-label="Zoom out"
      title="Zoom out (-)"
      @click="editor.stepZoom(-1)"
    >
      −
    </BaseButton>
    <span class="zoom-bar__level" data-testid="zoom-level" aria-live="polite">{{ level }}</span>
    <BaseButton
      variant="ghost"
      aria-label="Zoom in"
      title="Zoom in (+)"
      @click="editor.stepZoom(1)"
    >
      +
    </BaseButton>
    <BaseButton variant="ghost" aria-label="Fit" title="Fit (Shift+1)" @click="editor.fit()">
      Fit
    </BaseButton>
    <BaseButton
      variant="ghost"
      aria-label="100%"
      title="100% (Shift+0)"
      @click="editor.actualSize()"
    >
      100%
    </BaseButton>
  </div>
</template>

<style scoped>
.zoom-bar {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.zoom-bar__level {
  min-width: var(--space-8);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  text-align: center;
}
</style>
