<script setup lang="ts">
import { BaseButton } from '@/shared'

withDefaults(defineProps<{ showOpen: boolean; openDisabled?: boolean }>(), { openDisabled: false })
defineEmits<{ open: [] }>()
</script>

<template>
  <header class="editor-top-bar" data-testid="editor-top-bar">
    <span class="editor-top-bar__name">imgly</span>
    <div class="editor-top-bar__actions">
      <BaseButton
        v-if="showOpen"
        variant="secondary"
        :disabled="openDisabled"
        @click="$emit('open')"
      >
        Open image
      </BaseButton>
      <!-- Other features' actions (export), mounted by the app shell. -->
      <slot name="actions" />
    </div>
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

.editor-top-bar__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.editor-top-bar__name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}
</style>
