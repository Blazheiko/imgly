<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** The element the panel hangs under, right-aligned; never counts as "outside". */
    anchor: HTMLElement | null
    /** While locked, Escape and a click outside do nothing (an export is running). */
    locked?: boolean
    label: string
    /** A selector inside the panel to focus on open; defaults to the first focusable element. */
    initialFocus?: string
  }>(),
  { locked: false, initialFocus: undefined },
)
const emit = defineEmits<{ close: [] }>()

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
const panel = ref<HTMLElement>()
const position = ref({ top: 0, right: 0 })

function place() {
  const rect = props.anchor?.getBoundingClientRect()
  if (!rect) return
  position.value = { top: rect.bottom, right: document.documentElement.clientWidth - rect.right }
}

function focusIn() {
  const target = props.initialFocus
    ? panel.value?.querySelector<HTMLElement>(props.initialFocus)
    : panel.value?.querySelector<HTMLElement>(FOCUSABLE)
  target?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || props.locked) return
  event.preventDefault()
  emit('close')
}

function onPointerdown(event: Event) {
  if (props.locked) return
  const target = event.target as Node | null
  if (!target || panel.value?.contains(target) || props.anchor?.contains(target)) return
  emit('close')
}

function listen(on: boolean) {
  if (on) {
    document.addEventListener('keydown', onKeydown)
    document.addEventListener('pointerdown', onPointerdown, true)
    // A resize or rotation moves the anchor; the fixed panel follows it.
    window.addEventListener('resize', place)
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.removeEventListener('pointerdown', onPointerdown, true)
    window.removeEventListener('resize', place)
  }
}

// Pre-flush: on close the panel is still in the DOM, so we can tell whether focus was inside it.
watch(
  () => props.open,
  (open) => {
    listen(open)
    if (open) {
      place()
      void nextTick(focusIn)
      return
    }
    const active = document.activeElement
    if (active === document.body || (active && panel.value?.contains(active))) {
      props.anchor?.focus()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => listen(false))
</script>

<template>
  <div
    v-if="open"
    ref="panel"
    class="popover"
    role="dialog"
    aria-modal="false"
    :aria-label="label"
    :style="{ top: `${position.top}px`, right: `${position.right}px` }"
  >
    <slot />
  </div>
</template>

<style scoped>
.popover {
  position: fixed;
  z-index: var(--z-overlay);
  width: min(var(--panel-width), calc(100vw - 2 * var(--space-4)));
  margin-top: var(--space-2);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  color: var(--color-text);
}
</style>
