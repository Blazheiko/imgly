<script setup lang="ts">
import { computed, useId } from 'vue'
import { BaseButton } from '@/shared'
import type { GalleryEntry } from '../store'
import * as m from '../messages'

const props = defineProps<{ entry: GalleryEntry }>()
const emit = defineEmits<{ choose: []; delete: []; 'image-error': [] }>()

const hintId = useId()
const status = computed(() => {
  if (props.entry.status === 'open') return m.statusOpen()
  if (props.entry.status === 'damaged') return m.statusDamaged()
  return props.entry.label
})
const isOpen = computed(() => props.entry.status === 'open')
const isDamaged = computed(() => props.entry.status === 'damaged')
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
      <span class="gallery-entry__thumb">
        <span v-if="isDamaged" class="gallery-entry__damaged">{{ m.damagedThumbnail() }}</span>
        <img
          v-else-if="entry.thumbnailUrl"
          :src="entry.thumbnailUrl"
          alt=""
          @error="emit('image-error')"
        />
      </span>
      <span class="gallery-entry__name" :title="entry.name">{{ entry.name }}</span>
      <span class="gallery-entry__status">{{ status }}</span>
    </button>
    <BaseButton
      variant="ghost"
      :data-delete-id="entry.id"
      :aria-label="m.deleteButtonName(entry.name)"
      :aria-disabled="isOpen ? 'true' : undefined"
      :aria-describedby="isOpen ? hintId : undefined"
      @click="emit('delete')"
    >
      {{ m.deleteButton() }}
    </BaseButton>
    <span v-if="isOpen" :id="hintId" class="gallery-entry__hint">{{
      m.hintOpenWorkCannotBeDeleted()
    }}</span>
  </li>
</template>

<style scoped>
.gallery-entry {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  width: var(--gallery-tile-size);
  list-style: none;
}

.gallery-entry__button {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
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
  outline-offset: 2px;
}

.gallery-entry__thumb {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: var(--gallery-tile-size);
  height: var(--gallery-tile-size);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  background: var(--color-canvas-surround);
  overflow: hidden;
}

.gallery-entry--open .gallery-entry__thumb {
  border-color: var(--color-accent);
}

.gallery-entry__thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.gallery-entry__damaged {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.gallery-entry__name {
  overflow: hidden;
  font-size: var(--font-size-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gallery-entry__status {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.gallery-entry__hint {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
