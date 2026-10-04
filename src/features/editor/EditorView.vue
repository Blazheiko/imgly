<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { filesFromDataTransfer, installDropGuard, pickImageFile } from '@/infra/platform'
import { BaseButton, CanvasMessage, Spinner, ToastStack } from '@/shared'
import DropOverlay from './components/DropOverlay.vue'
import EditorStatusBar from './components/EditorStatusBar.vue'
import EditorTopBar from './components/EditorTopBar.vue'
import EmptyCanvas from './components/EmptyCanvas.vue'
import PreviewCanvas from './components/PreviewCanvas.vue'
import ReplaceDialog from './components/ReplaceDialog.vue'
import { BLOCKING } from './messages'
import { useEditorStore } from './store'

const editor = useEditorStore()
const dragging = ref(false)

/** The Preview's screens (SCR-01/02) are up: not checking, not SCR-04 or SCR-05. */
const live = computed(() => editor.display === 'ok' || editor.display === 'restoring')

/** Opens are refused on the blocking screens and while the replace dialog waits for an answer. */
const acceptsOpens = () => live.value && editor.phase !== 'confirming'

const reloadButton = ref<InstanceType<typeof BaseButton>>()
watch(
  () => editor.display,
  async (display) => {
    if (display !== 'lost') return
    await nextTick()
    ;(reloadButton.value?.$el as HTMLElement | undefined)?.focus()
  },
)

function reload() {
  location.reload()
}

async function openPicked() {
  if (!acceptsOpens()) return
  const file = await pickImageFile()
  if (file) await editor.openFile(file)
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/** SCR-02 zoom shortcuts. Ctrl/Cmd + / - / 0 stay the browser's page zoom (never intercepted). */
const zoomShortcuts: { matches: (e: KeyboardEvent) => boolean; run: () => void }[] = [
  { matches: (e) => e.shiftKey && e.code === 'Digit1', run: () => editor.fit() },
  { matches: (e) => e.shiftKey && e.code === 'Digit0', run: () => editor.actualSize() },
  { matches: (e) => e.key === '+' || e.key === '=', run: () => editor.stepZoom(1) },
  { matches: (e) => e.key === '-', run: () => editor.stepZoom(-1) },
]

function onKeydown(event: KeyboardEvent) {
  const mod = event.ctrlKey || event.metaKey
  if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'o') {
    event.preventDefault()
    void openPicked()
    return
  }
  if (mod || event.altKey || isTextField(event.target)) return
  if (!editor.work || !acceptsOpens()) return
  const shortcut = zoomShortcuts.find((s) => s.matches(event))
  if (!shortcut) return
  event.preventDefault()
  shortcut.run()
}

/**
 * The page itself never zooms (AC-12): a pinch over the bars, a toast or the dialog would
 * otherwise zoom the whole page. Over the canvas, PreviewCanvas turns the same events into a
 * View zoom before they reach the window.
 */
function blockPageZoomWheel(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) event.preventDefault()
}
function blockPageZoomGesture(event: Event) {
  event.preventDefault()
}
const GESTURE_EVENTS = ['gesturestart', 'gesturechange', 'gestureend']

// The drop guard goes on the whole window first, so no drop ever navigates away (AC-02).
const uninstallDropGuard = installDropGuard(window, {
  onDragEnter: () => (dragging.value = acceptsOpens()),
  onDragLeave: () => (dragging.value = false),
  onDrop: (dataTransfer) => {
    if (acceptsOpens()) void editor.openDrop(filesFromDataTransfer(dataTransfer))
  },
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('wheel', blockPageZoomWheel, { passive: false })
  for (const type of GESTURE_EVENTS) window.addEventListener(type, blockPageZoomGesture)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('wheel', blockPageZoomWheel)
  for (const type of GESTURE_EVENTS) window.removeEventListener(type, blockPageZoomGesture)
  uninstallDropGuard()
})
</script>

<template>
  <main
    class="editor-view"
    :class="{ 'editor-view--with-status-bar': live && editor.work }"
    data-testid="editor-view"
  >
    <EditorTopBar :show-open="live && editor.work !== null" @open="openPicked" />
    <section class="editor-view__canvas" aria-label="Canvas">
      <CanvasMessage
        v-if="editor.display === 'unsupported'"
        :title="BLOCKING.UNSUPPORTED_BROWSER.title"
      >
        {{ BLOCKING.UNSUPPORTED_BROWSER.body }}
      </CanvasMessage>
      <CanvasMessage
        v-else-if="editor.display === 'lost'"
        :title="BLOCKING.DISPLAY_LOST.title"
        role="alert"
      >
        {{ BLOCKING.DISPLAY_LOST.body }}
        <template #action>
          <BaseButton ref="reloadButton" variant="primary" @click="reload">Reload page</BaseButton>
        </template>
      </CanvasMessage>
      <template v-else-if="live">
        <EmptyCanvas v-if="!editor.work" @open="openPicked" />
        <PreviewCanvas v-else />
        <div
          v-if="editor.display === 'restoring'"
          class="editor-view__restoring"
          data-testid="restoring"
        >
          <Spinner label="Restoring the display" />
        </div>
        <div v-else-if="editor.phase === 'reading'" class="editor-view__loading">
          <Spinner label="Opening image" />
        </div>
      </template>
    </section>
    <EditorStatusBar v-if="live" />
    <ToastStack />
    <DropOverlay v-if="dragging" />
    <ReplaceDialog v-if="editor.phase === 'confirming'" />
  </main>
</template>

<style scoped>
.editor-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-view--with-status-bar {
  --toast-stack-bottom: calc(var(--toolbar-size) + var(--space-4));
}

.editor-view__canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  background: var(--color-canvas-surround);
}

.editor-view__restoring {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: grid;
  place-items: center;
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
