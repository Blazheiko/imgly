<script setup lang="ts">
import { computed, useId } from 'vue'
import { BaseButton, Icon } from '@/shared'
import type { GalleryEntry } from '../store'
import * as m from '../messages'

const props = defineProps<{ entry: GalleryEntry }>()
const emit = defineEmits<{ choose: []; delete: []; 'image-error': [url: string] }>()

const hintId = useId()

// The src that failed, not the current prop: an error from a superseded URL must not mark the entry.
function onImageError(event: Event) {
  emit('image-error', (event.target as HTMLImageElement).getAttribute('src') ?? '')
}
const status = computed(() => {
  if (props.entry.status === 'open') return m.statusOpen()
  if (props.entry.status === 'damaged') return m.statusDamaged()
  return props.entry.label
})
const isOpen = computed(() => props.entry.status === 'open')
const isDamaged = computed(() => props.entry.status === 'damaged')
// The blurred fill behind the thumbnail reuses the object URL already in memory (ui-refresh SCR-02).
const backdrop = computed(() =>
  !isDamaged.value && props.entry.thumbnailUrl
    ? { '--thumb-backdrop': `url("${props.entry.thumbnailUrl}")` }
    : undefined,
)
</script>

<template>
  <li
    class="gallery-entry"
    :class="{ 'gallery-entry--open': isOpen, 'gallery-entry--damaged': isDamaged }"
  >
    <button
      type="button"
      class="gallery-entry__button"
      :data-entry-id="entry.id"
      :aria-label="`${entry.name}, ${status}`"
      @click="emit('choose')"
    >
      <span
        class="gallery-entry__thumb"
        :class="{ 'gallery-entry__thumb--backdrop': backdrop }"
        :style="backdrop"
      >
        <span v-if="isDamaged" class="gallery-entry__damaged">
          <Icon name="image-off" size="lg" class="gallery-entry__damaged-icon" />
          {{ m.damagedThumbnail() }}
        </span>
        <img
          v-else-if="entry.thumbnailUrl"
          :src="entry.thumbnailUrl"
          alt=""
          @error="onImageError"
        />
      </span>
      <span class="gallery-entry__text">
        <span class="gallery-entry__name" :title="entry.name">{{ entry.name }}</span>
        <span class="gallery-entry__status" :class="{ 'gallery-entry__status--badge': isOpen }">{{
          status
        }}</span>
      </span>
    </button>
    <!-- After the choosing button, so the keyboard order is unchanged; hidden only by opacity, so
         it never leaves the keyboard order (ui-refresh AC-06, AC-07). -->
    <BaseButton
      variant="ghost"
      size="sm"
      icon="trash-2"
      class="gallery-entry__delete"
      :data-delete-id="entry.id"
      :aria-label="m.deleteButtonName(entry.name)"
      :title="m.deleteButtonName(entry.name)"
      :aria-disabled="isOpen ? 'true' : undefined"
      :aria-describedby="isOpen ? hintId : undefined"
      @click="emit('delete')"
    />
    <span v-if="isOpen" :id="hintId" class="gallery-entry__visually-hidden">{{
      m.hintOpenWorkCannotBeDeleted()
    }}</span>
  </li>
</template>

<style scoped>
.gallery-entry {
  position: relative;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-sm);
  list-style: none;
  overflow: hidden;
  transition:
    transform var(--duration-base) var(--ease-out),
    box-shadow var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}

/* Lifts by at most 4 px; --lift-card is 0 under reduced motion (AC-06, AC-14). */
.gallery-entry:hover {
  border-color: var(--color-accent-text);
  box-shadow: var(--shadow-md);
  transform: translateY(var(--lift-card));
}

.gallery-entry--damaged {
  border-color: var(--color-warning);
}

.gallery-entry__button {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.gallery-entry__button:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: -2px;
  border-radius: var(--radius-lg);
}

/* Every card the same shape: the whole image, never cropped, over a blurred copy of itself. */
.gallery-entry__thumb {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: var(--color-surface-sunken);
  overflow: hidden;
}

.gallery-entry__thumb--backdrop::before,
.gallery-entry__thumb--backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
}

.gallery-entry__thumb::before {
  background: var(--thumb-backdrop) center / cover no-repeat;
  filter: blur(var(--space-4));
  transform: scale(1.1);
}

.gallery-entry__thumb::after {
  background: var(--color-scrim);
}

.gallery-entry__thumb img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.gallery-entry__damaged {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.gallery-entry__damaged-icon {
  color: var(--color-warning);
}

.gallery-entry__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  padding: var(--space-3);
  min-width: 0;
}

.gallery-entry__name {
  max-width: 100%;
  overflow: hidden;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gallery-entry__status {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.gallery-entry__status--badge {
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

/* On glass at the thumbnail's top-right corner; revealed by pointing, by focus, and on touch. */
.gallery-entry .gallery-entry__delete {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 2;
  border-radius: var(--radius-full);
  background: var(--color-glass);
  color: var(--color-on-glass);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.gallery-entry:hover .gallery-entry__delete,
.gallery-entry:focus-within .gallery-entry__delete {
  opacity: 1;
}

/* The open Work's Delete: the neutral unavailable look, still focusable with its hint (AC-08). */
.gallery-entry .gallery-entry__delete[aria-disabled='true'] {
  background: var(--color-surface-sunken);
  color: var(--color-text-muted);
}

@media (hover: none) {
  /* As specific as the hidden rule above, so it wins by coming later (AC-06 touch). */
  .gallery-entry .gallery-entry__delete {
    opacity: 1;
  }

  .gallery-entry:hover {
    transform: none;
  }
}

.gallery-entry__visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
