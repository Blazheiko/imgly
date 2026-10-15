<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { BaseButton } from '@/shared'
import { useGallery } from '../store'
import * as m from '../messages'
import DeleteWorkDialog from './DeleteWorkDialog.vue'
import GalleryEntry from './GalleryEntry.vue'

defineProps<{ showClose: boolean; showOpenImage: boolean; titleId?: string }>()
const emit = defineEmits<{ close: []; 'open-image': [] }>()

const gallery = useGallery()

onMounted(() => gallery.listsMounted++)
onBeforeUnmount(() => {
  gallery.listsMounted--
  if (gallery.listsMounted === 0) gallery.releaseThumbnails()
})
</script>

<template>
  <section class="gallery-list">
    <header class="gallery-list__header">
      <h2 :id="titleId" class="gallery-list__title">{{ m.galleryButton() }}</h2>
      <span
        v-if="gallery.unavailableReason === null && gallery.listRead"
        class="gallery-list__count"
        data-testid="gallery-count"
        >{{ m.countLabel(gallery.count) }}</span
      >
      <BaseButton
        v-if="showClose"
        variant="ghost"
        class="gallery-list__close"
        @click="emit('close')"
      >
        {{ m.closeButton() }}
      </BaseButton>
    </header>

    <div
      v-if="gallery.unavailableReason !== null"
      class="gallery-list__note"
      data-testid="gallery-unavailable"
    >
      <p class="gallery-list__note-title">{{ m.unavailableTitle() }}</p>
      <p>{{ m.unavailableBody(gallery.unavailableReason) }}</p>
    </div>
    <template v-else-if="gallery.listRead">
      <p class="gallery-list__storage" data-testid="gallery-storage-line">
        {{ gallery.storageLine }}
      </p>
      <div v-if="gallery.count === 0" class="gallery-list__note" data-testid="gallery-empty">
        <p>{{ m.emptyState() }}</p>
        <BaseButton
          v-if="showOpenImage"
          variant="secondary"
          data-testid="gallery-open-image"
          @click="emit('open-image')"
        >
          Open image
        </BaseButton>
      </div>
      <ul v-else class="gallery-list__grid">
        <GalleryEntry
          v-for="entry in gallery.entries"
          :key="entry.id"
          :entry="entry"
          @choose="gallery.choose(entry.id)"
          @delete="gallery.requestDelete(entry.id)"
          @image-error="(url: string) => gallery.markDamaged(entry.id, url)"
        />
      </ul>
    </template>
    <DeleteWorkDialog />
  </section>
</template>

<style scoped>
.gallery-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  color: var(--color-text);
}

.gallery-list__header {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
}

.gallery-list__title {
  margin: 0;
  font-size: var(--font-size-lg);
}

.gallery-list__count,
.gallery-list__storage {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.gallery-list__close {
  margin-left: auto;
}

.gallery-list__note {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
}

.gallery-list__note p {
  margin: 0;
}

.gallery-list__note-title {
  color: var(--color-text);
  font-weight: var(--font-weight-bold);
}

.gallery-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, var(--gallery-tile-size));
  gap: var(--space-4);
  margin: 0;
  padding: 0;
}
</style>
