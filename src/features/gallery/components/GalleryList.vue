<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { GALLERY_CAP } from '@/core'
import { BaseButton, Icon } from '@/shared'
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
      <div
        v-if="gallery.unavailableReason === null && gallery.listRead"
        class="gallery-list__places"
      >
        <span class="gallery-list__count" data-testid="gallery-count">{{
          m.countLabel(gallery.count)
        }}</span>
        <!-- The visible count already says it (ui-refresh AC-09); Damaged Works count too. -->
        <meter
          class="gallery-list__meter"
          min="0"
          :max="GALLERY_CAP"
          :value="gallery.count"
          aria-hidden="true"
        />
      </div>
      <BaseButton
        v-if="showClose"
        variant="ghost"
        icon="x"
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
      <div class="gallery-list__storage-note">
        <Icon name="info" class="gallery-list__storage-icon" />
        <p class="gallery-list__storage" data-testid="gallery-storage-line">
          {{ gallery.storageLine }}
        </p>
      </div>
      <div v-if="gallery.count === 0" class="gallery-list__note" data-testid="gallery-empty">
        <p>{{ m.emptyState() }}</p>
        <BaseButton
          v-if="showOpenImage"
          variant="secondary"
          icon="image-plus"
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
  gap: var(--space-4);
  color: var(--color-text);
}

.gallery-list__header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.gallery-list__title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--tracking-tight);
}

.gallery-list__places {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
  margin-left: auto;
}

.gallery-list__count {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* A 4 px bar, 120 px long (screens.md SCR-02): the accent fill on a sunken track. */
.gallery-list__meter {
  appearance: none;
  width: calc(var(--space-8) * 2.5);
  height: var(--space-1);
  border: 0;
  border-radius: var(--radius-full);
  background: var(--color-surface-sunken);
  overflow: hidden;
}

.gallery-list__meter::-webkit-meter-bar {
  border: 0;
  border-radius: var(--radius-full);
  background: var(--color-surface-sunken);
}

.gallery-list__meter::-webkit-meter-optimum-value {
  border-radius: var(--radius-full);
  background: var(--meter-fill);
}

.gallery-list__meter::-moz-meter-bar {
  border-radius: var(--radius-full);
  background: var(--meter-fill);
}

.gallery-list {
  --meter-fill: var(--color-accent-text);
}

@media (prefers-color-scheme: light) {
  .gallery-list {
    --meter-fill: var(--color-accent);
  }

  .gallery-list__meter,
  .gallery-list__meter::-webkit-meter-bar {
    background: var(--color-border);
  }
}

.gallery-list__places + .gallery-list__close {
  margin-left: 0;
}

.gallery-list__close {
  margin-left: auto;
}

.gallery-list__storage-note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-accent-subtle);
}

.gallery-list__storage-icon {
  margin-top: var(--space-1);
  color: var(--color-accent-text);
}

.gallery-list__storage {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.gallery-list__note {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
}

.gallery-list [data-testid='gallery-unavailable'] {
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
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
