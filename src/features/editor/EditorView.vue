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

/** View keys and drops are handled on the Preview's screens unless the replace dialog waits. */
const interactive = () => live.value && editor.phase !== 'confirming'

/** Opens are also refused while an export runs (export AC-11); zoom and pan stay live. */
const acceptsOpens = () => interactive() && editor.phase !== 'exporting'

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

/** A slider takes no typing and Space doesn't press it, so Space still pans (crop-rotate AC-19). */
function isSlider(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.type === 'range'
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement) || isSlider(target)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Controls in a panel, or one that opts in with `data-keeps-space`, keep Space as their native
 * activation (export AC-17); everywhere else, and on a slider, Space starts space-pan.
 */
function keepsSpace(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !isSlider(target) &&
    target.closest('[role="dialog"], [data-keeps-space]') !== null
  )
}

/** An unshifted + typed on a key right of P while Draw is open: that tool's width key. */
function drawWidthKey(e: KeyboardEvent): boolean {
  return (
    editor.activeTool === 'draw' &&
    e.key === '+' &&
    !e.shiftKey &&
    (e.code === 'BracketLeft' || e.code === 'BracketRight')
  )
}

/** SCR-02 zoom shortcuts. Ctrl/Cmd + / - / 0 stay the browser's page zoom (never intercepted). */
const zoomShortcuts: { matches: (e: KeyboardEvent) => boolean; run: () => void }[] = [
  { matches: (e) => e.shiftKey && e.code === 'Digit1', run: () => editor.fit() },
  { matches: (e) => e.shiftKey && e.code === 'Digit0', run: () => editor.actualSize() },
  {
    // With Draw open, an unshifted + on a key right of P (German, Spanish: BracketRight;
    // Portuguese: BracketLeft) steps the width instead; = and Shift+ + still zoom (draw AC-18, AC-19).
    matches: (e) => (e.key === '+' || e.key === '=') && !drawWidthKey(e),
    run: () => editor.stepZoom(1),
  },
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
  if (!editor.work || !interactive()) return
  if (event.code === 'Space') {
    if (keepsSpace(event.target)) return
    event.preventDefault() // a focused button would otherwise fire on release (AC-13)
    // A draw Stroke in progress holds Space: it starts no pan (draw AC-18).
    if (!editor.strokeActive) editor.setSpacePan(true)
    return
  }
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

function onKeyup(event: KeyboardEvent) {
  if (event.code !== 'Space' || !editor.spacePan) return
  event.preventDefault()
  editor.setSpacePan(false)
}

function endSpacePan() {
  editor.setSpacePan(false)
}

// The drop guard goes on the whole window first, so no drop ever navigates away (AC-02).
const uninstallDropGuard = installDropGuard(window, {
  onDragEnter: () => (dragging.value = acceptsOpens()),
  onDragLeave: () => (dragging.value = false),
  // During an export the store refuses the drop with its "wait" notice (export AC-11).
  onDrop: (dataTransfer) => {
    if (interactive()) void editor.openDrop(filesFromDataTransfer(dataTransfer))
  },
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keyup', onKeyup)
  window.addEventListener('blur', endSpacePan)
  window.addEventListener('wheel', blockPageZoomWheel, { passive: false })
  for (const type of GESTURE_EVENTS) window.addEventListener(type, blockPageZoomGesture)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keyup', onKeyup)
  window.removeEventListener('blur', endSpacePan)
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
    <EditorTopBar
      :show-open="live && editor.work !== null"
      :open-disabled="editor.phase === 'exporting'"
      @open="openPicked"
    >
      <template v-if="live" #actions><slot name="top-bar-actions" /></template>
    </EditorTopBar>
    <div class="editor-view__workspace">
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
            <BaseButton ref="reloadButton" variant="primary" @click="reload"
              >Reload page</BaseButton
            >
          </template>
        </CanvasMessage>
        <template v-else-if="live">
          <EmptyCanvas v-if="!editor.work" @open="openPicked" />
          <PreviewCanvas v-else />
          <!-- An open tool's canvas half (crop-rotate's frame), over the Preview (ADR-0003). -->
          <slot v-if="editor.work && editor.activeTool" name="tool-canvas" />
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
      <!-- The tool's panel beside the canvas; it stays when the display is lost, so Cancel works. -->
      <slot v-if="editor.work && editor.activeTool" name="tool-panel" />
    </div>
    <EditorStatusBar v-if="live" />
    <ToastStack />
    <DropOverlay v-if="dragging" />
    <ReplaceDialog v-if="live && editor.phase === 'confirming'" />
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

.editor-view__workspace {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* Below 1024 px a tool's panel moves under the canvas (canon §Platform posture). */
@media (max-width: 1023px) {
  .editor-view__workspace {
    flex-direction: column;
  }
}

.editor-view__canvas {
  position: relative;
  flex: 1;
  min-width: 0;
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
