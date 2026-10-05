<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'

const props = defineProps<{
  title: string
  /** A selector inside the dialog to focus on open; defaults to the first focusable element. */
  initialFocus?: string
}>()
const emit = defineEmits<{ cancel: [] }>()

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
const titleId = useId()
const panel = ref<HTMLElement>()
let opener: Element | null = null

function focusables(): HTMLElement[] {
  return Array.from(panel.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
    return
  }
  if (event.key !== 'Tab') return
  const items = focusables()
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return
  const active = document.activeElement
  if (event.shiftKey && (active === first || !panel.value?.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || !panel.value?.contains(active))) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  opener = document.activeElement
  const target = props.initialFocus
    ? panel.value?.querySelector<HTMLElement>(props.initialFocus)
    : focusables()[0]
  target?.focus()
})

onBeforeUnmount(() => {
  if (opener instanceof HTMLElement) opener.focus()
})
</script>

<template>
  <div class="dialog">
    <div class="dialog__backdrop" data-testid="dialog-backdrop" @click="emit('cancel')" />
    <div
      ref="panel"
      class="dialog__panel"
      role="alertdialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @keydown="onKeydown"
    >
      <h2 :id="titleId" class="dialog__title">{{ title }}</h2>
      <div class="dialog__body"><slot /></div>
      <div class="dialog__actions"><slot name="actions" /></div>
    </div>
  </div>
</template>

<style scoped>
.dialog {
  position: fixed;
  inset: 0;
  z-index: var(--z-dialog);
  display: grid;
  place-items: center;
}

.dialog__backdrop {
  position: absolute;
  inset: 0;
  background: var(--color-canvas-surround);
  opacity: 0.7;
}

.dialog__panel {
  position: relative;
  width: min(var(--dialog-width), calc(100vw - 2 * var(--space-4)));
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.dialog__title {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.dialog__body {
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
}

.dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-6);
}
</style>
