<script setup lang="ts">
import { computed, useId } from 'vue'
import { useEditorStore } from '@/features/editor'
import { BaseButton, useNotices } from '@/shared'
import { useGallery } from '../store'
import * as m from '../messages'

const editor = useEditorStore()
const gallery = useGallery()
const notices = useNotices()
const hintId = useId()

const exporting = computed(() => editor.phase === 'exporting')
/** Why the action can't be used now, shown as its description: a tool is open. */
const hint = computed(() => (editor.activeTool !== null ? m.hintToolOpen() : null))

function onActivate() {
  if (hint.value) notices.pushAll([{ kind: 'info', text: hint.value }])
  else if (gallery.overlayOpen) gallery.close()
  else void gallery.open()
}
</script>

<template>
  <BaseButton
    :disabled="exporting"
    :pressed="gallery.overlayOpen"
    :aria-disabled="hint ? 'true' : undefined"
    :aria-describedby="hint ? hintId : undefined"
    :class="{ 'gallery-action--unavailable': hint }"
    data-testid="gallery-action"
    data-keeps-space
    @click="onActivate"
  >
    {{ m.galleryButton() }}
  </BaseButton>
  <span v-if="hint" :id="hintId" class="gallery-action__hint">{{ hint }}</span>
</template>

<style scoped>
.gallery-action--unavailable {
  opacity: 0.45;
}

.gallery-action__hint {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
