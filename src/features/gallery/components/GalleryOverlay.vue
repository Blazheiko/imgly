<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Spinner } from '@/shared'
import { useGallery } from '../store'
import * as m from '../messages'
import GalleryList from './GalleryList.vue'

const gallery = useGallery()
const root = ref<HTMLElement>()
const titleId = useId()
const inerted: Element[] = []

const reopeningName = computed(
  () => gallery.entries.find((e) => e.id === gallery.reopening)?.name ?? '',
)

/** Everything outside the overlay, up to the body, goes inert; toasts stay reachable. */
function makeOutsideInert(el: HTMLElement) {
  for (let node: Element = el; node.parentElement && node !== document.body;) {
    const parent: HTMLElement = node.parentElement
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node || sibling.hasAttribute('inert')) continue
      if (sibling.matches('[data-testid="toast-stack"]') || sibling.tagName === 'SCRIPT') continue
      sibling.setAttribute('inert', '')
      inerted.push(sibling)
    }
    node = parent
  }
}

function restoreOutside() {
  for (const el of inerted.splice(0)) el.removeAttribute('inert')
}

function focusables(): HTMLElement[] {
  return Array.from(
    root.value?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [],
  ).filter((el) => el.closest('[inert]') === null)
}

function onTab(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const items = focusables()
  if (items.length === 0) {
    event.preventDefault()
    return
  }
  const first = items[0]!
  const last = items[items.length - 1]!
  const active = document.activeElement
  if (event.shiftKey && (active === first || !root.value?.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || !root.value?.contains(active))) {
    event.preventDefault()
    first.focus()
  }
}

function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  gallery.close()
}

watch(
  () => gallery.overlayOpen,
  async (open) => {
    if (open) {
      if (!root.value) return
      makeOutsideInert(root.value)
      document.addEventListener('keydown', onEscape)
      const entry = root.value.querySelector<HTMLElement>('.gallery-entry button')
      const target = entry ?? focusables()[0]
      target?.focus()
    } else {
      document.removeEventListener('keydown', onEscape)
      restoreOutside()
      document.querySelector<HTMLElement>('[data-testid="gallery-action"]')?.focus()
    }
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEscape)
  restoreOutside()
})
</script>

<template>
  <div
    v-if="gallery.overlayOpen"
    ref="root"
    class="gallery-overlay"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
    data-testid="gallery-overlay"
    @keydown="onTab"
  >
    <div :inert="gallery.reopening !== null ? 'true' : undefined" class="gallery-overlay__body">
      <GalleryList
        :show-close="true"
        :show-open-image="false"
        :title-id="titleId"
        @close="gallery.close()"
      />
    </div>
    <div v-if="gallery.reopening !== null" class="gallery-overlay__busy">
      <Spinner :label="m.reopeningLabel(reopeningName)" />
    </div>
  </div>
</template>

<style scoped>
.gallery-overlay {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  overflow-y: auto;
  background: var(--color-surface);
}

.gallery-overlay__body {
  padding: var(--space-6) var(--space-8);
}

.gallery-overlay__busy {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
</style>
