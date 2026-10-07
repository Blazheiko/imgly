<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { cropRectOnScreen, screenDeltaToImage, turnedBounds, type CropHandle } from '@/core'
import { useEditorStore } from '@/features/editor'
import { HANDLE_LABELS, LABELS } from './messages'
import { useCropRotateStore } from './store'

const editor = useEditorStore()
const tool = useCropRotateStore()

/** How long the fine grid stays after the last angle change (AC-05). */
const FINE_GRID_MS = 700
const HANDLES = Object.keys(HANDLE_LABELS) as CropHandle[]

/**
 * The Crop on the canvas area in CSS pixels, from core's overlay maths with the View and the
 * shown size the renderer uses, so the frame sits on the pixels the shader draws (ADR-0005).
 */
const rect = computed(() => {
  const draft = tool.draft
  const work = editor.work
  if (!draft || !work) return null
  const r = cropRectOnScreen(draft.crop, turnedBounds(draft, work.original), editor.view)
  const dpr = devicePixelRatio || 1
  return { left: r.left / dpr, top: r.top / dpr, width: r.width / dpr, height: r.height / dpr }
})

const frameStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  return {
    transform: `translate(${r.left}px, ${r.top}px)`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  }
})

/** Four panels around the frame dim everything outside it (AC-01). */
const dims = computed(() => {
  const r = rect.value
  if (!r) return []
  const right = r.left + r.width
  const bottom = r.top + r.height
  return [
    { transform: 'translate(0, 0)', width: '100%', height: `${Math.max(0, r.top)}px` },
    { transform: `translate(0, ${bottom}px)`, width: '100%', height: `calc(100% - ${bottom}px)` },
    {
      transform: `translate(0, ${r.top}px)`,
      width: `${Math.max(0, r.left)}px`,
      height: `${r.height}px`,
    },
    {
      transform: `translate(${right}px, ${r.top}px)`,
      width: `calc(100% - ${right}px)`,
      height: `${r.height}px`,
    },
  ]
})

// --- pointer drags: deltas from the drag's start, turned into image pixels by core ---

const dragging = ref(false)
let drag: { pointerId: number; x: number; y: number; handle: CropHandle | null } | undefined

function onPointerDown(event: PointerEvent, handle: CropHandle | null) {
  if (event.button !== 0) return
  event.stopPropagation() // the frame, not the canvas under it, takes the drag
  drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, handle }
  tool.beginDrag()
  ;(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return
  dragging.value = true
  const dpr = devicePixelRatio || 1
  const { dx, dy } = screenDeltaToImage(
    (event.clientX - drag.x) * dpr,
    (event.clientY - drag.y) * dpr,
    editor.view,
  )
  if (drag.handle) tool.dragResize(drag.handle, dx, dy)
  else tool.dragMove(dx, dy)
}

function onPointerUp(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return
  drag = undefined
  dragging.value = false
  tool.endDrag()
}

// --- keyboard: 1 px of the image per arrow, 10 with Shift (AC-20) ---

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

function onKeydown(event: KeyboardEvent, handle: CropHandle | null) {
  const arrow = ARROWS[event.key]
  if (!arrow) return
  event.preventDefault()
  // A handled arrow stays on its handle, so the frame under it doesn't move too. Every other
  // key bubbles on: Enter and Escape to the tool, the zoom keys to EditorView (AC-19, AC-20).
  if (handle) event.stopPropagation()
  const step = event.shiftKey ? 10 : 1
  if (handle) tool.resizeBy(handle, arrow[0] * step, arrow[1] * step)
  else tool.moveBy(arrow[0] * step, arrow[1] * step)
}

// --- the fine grid while the angle changes (AC-05) ---

const straightening = ref(false)
let fineTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => tool.draft?.straighten,
  (angle, previous) => {
    if (angle === undefined || previous === undefined || angle === previous) return
    straightening.value = true
    clearTimeout(fineTimer)
    fineTimer = setTimeout(() => (straightening.value = false), FINE_GRID_MS)
  },
)
onBeforeUnmount(() => clearTimeout(fineTimer))
</script>

<template>
  <div v-if="rect" class="crop-overlay" data-testid="crop-overlay">
    <div v-if="straightening" class="crop-overlay__fine-grid" data-testid="fine-grid" />
    <div
      v-for="(dim, i) in dims"
      :key="i"
      class="crop-overlay__dim"
      data-testid="crop-dim"
      :style="dim"
    />
    <div
      class="crop-overlay__frame"
      :class="{ 'crop-overlay__frame--dragging': dragging }"
      :style="frameStyle"
      data-testid="crop-frame"
      role="group"
      :aria-label="LABELS.frame"
      tabindex="0"
      @pointerdown="onPointerDown($event, null)"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @lostpointercapture="onPointerUp"
      @keydown="onKeydown($event, null)"
    >
      <div v-if="dragging" class="crop-overlay__thirds" data-testid="thirds-grid" />
      <div
        v-for="h in HANDLES"
        :key="h"
        class="crop-overlay__handle"
        :class="`crop-overlay__handle--${h}`"
        :aria-label="HANDLE_LABELS[h]"
        role="button"
        tabindex="0"
        @pointerdown="onPointerDown($event, h)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @lostpointercapture="onPointerUp"
        @keydown="onKeydown($event, h)"
      />
    </div>
  </div>
</template>

<style scoped>
.crop-overlay {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  overflow: hidden;
  pointer-events: none;
}

.crop-overlay__dim,
.crop-overlay__frame {
  position: absolute;
  top: 0;
  left: 0;
}

.crop-overlay__dim {
  background: var(--color-canvas-surround);
  opacity: 0.7;
}

.crop-overlay__frame {
  box-sizing: border-box;
  border: 1px solid var(--color-text);
  cursor: move;
  pointer-events: auto;
  touch-action: none;
}

.crop-overlay__frame:focus-visible,
.crop-overlay__handle:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

/* Rule-of-thirds while dragging (AC-01). */
.crop-overlay__thirds {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      to right,
      transparent calc(100% / 3 - 0.5px),
      var(--color-text) 0,
      var(--color-text) calc(100% / 3 + 0.5px),
      transparent 0,
      transparent calc(200% / 3 - 0.5px),
      var(--color-text) 0,
      var(--color-text) calc(200% / 3 + 0.5px),
      transparent 0
    ),
    linear-gradient(
      to bottom,
      transparent calc(100% / 3 - 0.5px),
      var(--color-text) 0,
      var(--color-text) calc(100% / 3 + 0.5px),
      transparent 0,
      transparent calc(200% / 3 - 0.5px),
      var(--color-text) 0,
      var(--color-text) calc(200% / 3 + 0.5px),
      transparent 0
    );
  opacity: 0.5;
  pointer-events: none;
}

/* A fine grid over the image while the angle changes, to line up a horizon (AC-05). */
.crop-overlay__fine-grid {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(to right, var(--color-text) 0 1px, transparent 1px var(--space-7)),
    repeating-linear-gradient(to bottom, var(--color-text) 0 1px, transparent 1px var(--space-7));
  opacity: 0.25;
  pointer-events: none;
}

.crop-overlay__handle {
  position: absolute;
  width: var(--space-3);
  height: var(--space-3);
  margin: calc(var(--space-3) / -2);
  border: 1px solid var(--color-canvas-surround);
  background: var(--color-text);
  pointer-events: auto;
  touch-action: none;
}

.crop-overlay__handle--nw {
  top: 0;
  left: 0;
  cursor: nwse-resize;
}
.crop-overlay__handle--n {
  top: 0;
  left: 50%;
  cursor: ns-resize;
}
.crop-overlay__handle--ne {
  top: 0;
  left: 100%;
  cursor: nesw-resize;
}
.crop-overlay__handle--e {
  top: 50%;
  left: 100%;
  cursor: ew-resize;
}
.crop-overlay__handle--se {
  top: 100%;
  left: 100%;
  cursor: nwse-resize;
}
.crop-overlay__handle--s {
  top: 100%;
  left: 50%;
  cursor: ns-resize;
}
.crop-overlay__handle--sw {
  top: 100%;
  left: 0;
  cursor: nesw-resize;
}
.crop-overlay__handle--w {
  top: 50%;
  left: 0;
  cursor: ew-resize;
}
</style>
