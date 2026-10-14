<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { pickImageFile } from '@/infra/platform'
import { useEditorStore } from '@/features/editor'
import { Spinner } from '@/shared'
import { useGallery } from '../store'
import * as m from '../messages'
import GalleryList from './GalleryList.vue'

const editor = useEditorStore()
const gallery = useGallery()

const reopeningName = computed(
  () => gallery.entries.find((e) => e.id === gallery.reopening)?.name ?? '',
)

onMounted(() => void gallery.refresh())

async function openImage() {
  const file = await pickImageFile()
  if (file) await editor.openFile(file)
}
</script>

<template>
  <section class="gallery-start" data-testid="gallery-start">
    <div :inert="gallery.reopening !== null ? 'true' : undefined">
      <GalleryList :show-close="false" :show-open-image="true" @open-image="openImage" />
    </div>
    <div v-if="gallery.reopening !== null" class="gallery-start__busy">
      <Spinner :label="m.reopeningLabel(reopeningName)" />
    </div>
  </section>
</template>

<style scoped>
.gallery-start {
  position: relative;
  padding: var(--space-6) var(--space-8);
}

.gallery-start__busy {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
</style>
