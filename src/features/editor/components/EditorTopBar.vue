<script setup lang="ts">
import { BaseButton } from '@/shared'

defineProps<{ showOpen: boolean }>()
defineEmits<{ open: [] }>()
</script>

<template>
  <header class="editor-top-bar" data-testid="editor-top-bar">
    <span class="editor-top-bar__name">imgly</span>
    <BaseButton v-if="showOpen" variant="secondary" @click="$emit('open')">Open image</BaseButton>
  </header>
</template>

<style scoped>
.editor-top-bar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  height: var(--toolbar-size);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.editor-top-bar__name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}
</style>
