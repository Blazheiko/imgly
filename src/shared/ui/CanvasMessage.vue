<script setup lang="ts">
withDefaults(defineProps<{ title: string; role?: 'status' | 'alert' }>(), { role: 'status' })
</script>

<template>
  <section class="canvas-message" :role="role">
    <h2 class="canvas-message__title">{{ title }}</h2>
    <div class="canvas-message__body"><slot /></div>
    <div v-if="$slots.action" class="canvas-message__action"><slot name="action" /></div>
  </section>
</template>

<style scoped>
.canvas-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  max-width: var(--canvas-message-max-width);
  margin: auto;
  padding: var(--space-6);
  text-align: center;
}

.canvas-message__title {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.canvas-message__body {
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
}

.canvas-message__action {
  margin-top: var(--space-2);
}
</style>
