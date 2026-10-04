<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { filesFromDataTransfer, installDropGuard, pickImageFile } from '@/infra/platform'
import { Spinner, ToastStack } from '@/shared'
import DropOverlay from './components/DropOverlay.vue'
import EditorTopBar from './components/EditorTopBar.vue'
import EmptyCanvas from './components/EmptyCanvas.vue'
import PreviewCanvas from './components/PreviewCanvas.vue'
import { useEditorStore } from './store'

const editor = useEditorStore()
const dragging = ref(false)

/** Drops and the picker are blocked only while the replace dialog waits for an answer. */
const acceptsOpens = () => editor.phase !== 'confirming'

async function openPicked() {
  if (!acceptsOpens()) return
  const file = await pickImageFile()
  if (file) await editor.openFile(file)
}

function onKeydown(event: KeyboardEvent) {
  const mod = event.ctrlKey || event.metaKey
  if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'o') {
    event.preventDefault()
    void openPicked()
  }
}

// The drop guard goes on the whole window first, so no drop ever navigates away (AC-02).
const uninstallDropGuard = installDropGuard(window, {
  onDragEnter: () => (dragging.value = acceptsOpens()),
  onDragLeave: () => (dragging.value = false),
  onDrop: (dataTransfer) => {
    if (acceptsOpens()) void editor.openDrop(filesFromDataTransfer(dataTransfer))
  },
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  uninstallDropGuard()
})
</script>

<template>
  <main class="editor-view" data-testid="editor-view">
    <EditorTopBar :show-open="editor.work !== null" @open="openPicked" />
    <section class="editor-view__canvas" aria-label="Canvas">
      <EmptyCanvas v-if="!editor.work" @open="openPicked" />
      <PreviewCanvas v-else />
      <div v-if="editor.phase === 'reading'" class="editor-view__loading">
        <Spinner label="Opening image" />
      </div>
    </section>
    <ToastStack />
    <DropOverlay v-if="dragging" />
  </main>
</template>

<style scoped>
.editor-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-view__canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  background: var(--color-canvas-surround);
}

.editor-view__loading {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: grid;
  place-items: center;
  pointer-events: none;
}
</style>
