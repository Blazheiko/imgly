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
      size="sm"
      icon="zoom-out"
      aria-label="Zoom out"
      title="Zoom out (-)"
      @click="editor.stepZoom(-1)"
    />
    <span class="zoom-bar__level" data-testid="zoom-level" aria-live="polite">{{ level }}</span>
    <BaseButton
      variant="ghost"
      size="sm"
      icon="zoom-in"
      aria-label="Zoom in"
      title="Zoom in (+)"
      @click="editor.stepZoom(1)"
    />
    <BaseButton
      variant="ghost"
      size="sm"
      icon="scan"
      aria-label="Fit"
      title="Fit (Shift+1)"
      @click="editor.fit()"
    >
      Fit
    </BaseButton>
    <BaseButton
      variant="ghost"
      size="sm"
      icon="maximize"
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
