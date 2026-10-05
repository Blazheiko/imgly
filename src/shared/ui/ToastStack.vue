<script setup lang="ts">
import { useNotices } from '../notices'
import Toast from './Toast.vue'

const notices = useNotices()
</script>

<template>
  <div class="toast-stack" data-testid="toast-stack">
    <Toast
      v-for="notice in notices.items"
      :key="notice.id"
      :kind="notice.kind"
      :text="notice.text"
      @dismiss="notices.dismiss(notice.id)"
    />
  </div>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  right: var(--space-4);
  /* A screen with a bottom bar sets --toast-stack-bottom to stay above it. */
  bottom: var(--toast-stack-bottom, var(--space-4));
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
  pointer-events: none;
}

.toast-stack > * {
  pointer-events: auto;
}
</style>
