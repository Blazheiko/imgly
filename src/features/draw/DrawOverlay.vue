<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { workSize, type Point } from '@/core'
import { useEditorStore } from '@/features/editor'
import { useDrawStore } from './store'

const editor = useEditorStore()
const tool = useDrawStore()

const overlay = ref<HTMLElement>()
/** The pointer's position on the canvas area in CSS pixels, while it hovers it. */
const hover = ref<{ x: number; y: number } | null>(null)
let strokePointer: number | undefined

/** A client position as device pixels on the canvas, the space the View works in. */
function devicePoint(clientX: number, clientY: number): Point {
  const rect = overlay.value!.getBoundingClientRect()
  const dpr = devicePixelRatio || 1
  return { x: (clientX - rect.left) * dpr, y: (clientY - rect.top) * dpr }
}

/** The shown image (the Work's Crop) on the canvas area, in CSS pixels. */
const imageRect = computed(() => {
  const work = editor.work
  if (!work) return null
  const size = workSize(work)
  const { zoom, panX, panY } = editor.view
  const dpr = devicePixelRatio || 1
  return {
    left: Math.round(panX) / dpr,
    top: Math.round(panY) / dpr,
    right: (Math.round(panX) + size.width * zoom) / dpr,
    bottom: (Math.round(panY) + size.height * zoom) / dpr,
  }
})

/** Over the image the cursor hides and the width circle follows the pointer (AC-02). */
const overImage = computed(() => {
  const r = imageRect.value
  const h = hover.value
  return !!r && !!h && h.x >= r.left && h.x < r.right && h.y >= r.top && h.y < r.bottom
})

/** The width at the current zoom, in CSS pixels. */
const circleSize = computed(() => (tool.width * editor.view.zoom) / (devicePixelRatio || 1))

const circleStyle = computed(() => {
  const h = hover.value!
  const d = circleSize.value
  return {
    width: `${d}px`,
    height: `${d}px`,
    transform: `translate(${h.x - d / 2}px, ${h.y - d / 2}px)`,
  }
})

function trackHover(event: PointerEvent) {
  const rect = overlay.value!.getBoundingClientRect()
  hover.value = { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function onPointerDown(event: PointerEvent) {
  if (strokePointer !== undefined) {
    // A second pointer, such as the start of a pinch: the Stroke ends and is kept (AC-18).
    if (event.pointerId !== strokePointer) endStroke()
    return
  }
  if (event.button !== 0 || editor.spacePan) return
  event.preventDefault()
  event.stopPropagation() // the overlay, not the canvas under it, takes the drag
  strokePointer = event.pointerId
  overlay.value?.setPointerCapture?.(event.pointerId)
  tool.beginStroke(devicePoint(event.clientX, event.clientY), editor.view)
}

/** Every position the browser reports, coalesced ones included, else the event itself. */
function positions(event: PointerEvent): Point[] {
  const coalesced = event.getCoalescedEvents?.() ?? []
  const events = coalesced.length > 0 ? coalesced : [event]
  return events.map((e) => devicePoint(e.clientX, e.clientY))
}

function onPointerMove(event: PointerEvent) {
  trackHover(event)
  if (event.pointerId !== strokePointer) return
  tool.moveStroke(positions(event), editor.view)
}

function endStroke() {
  if (strokePointer === undefined) return
  strokePointer = undefined
  tool.endStroke()
}

function onPointerEnd(event: PointerEvent) {
  if (event.pointerId === strokePointer) endStroke()
}

onMounted(() => window.addEventListener('blur', endStroke))
onBeforeUnmount(() => {
  window.removeEventListener('blur', endStroke)
  endStroke()
})
</script>

<template>
  <div
    ref="overlay"
    class="draw-overlay"
    :class="{
      'draw-overlay--pan-through': editor.spacePan,
      'draw-overlay--over-image': overImage,
    }"
    data-testid="draw-overlay"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @lostpointercapture="onPointerEnd"
    @pointerleave="hover = null"
  >
    <div
      v-if="overImage && !editor.spacePan"
      class="draw-overlay__circle"
      data-testid="draw-width-circle"
      :style="circleStyle"
    />
  </div>
</template>

<style scoped>
.draw-overlay {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  overflow: hidden;
  touch-action: none;
}

/* While Space is held the pointer reaches the canvas under the overlay, which pans (AC-18). */
.draw-overlay--pan-through {
  pointer-events: none;
}

.draw-overlay--over-image {
  cursor: none;
}

/* A 1 px text-coloured ring inside a 1 px surface ring: visible on light and dark photos. */
.draw-overlay__circle {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  border: 1px solid var(--color-text);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--color-surface);
  pointer-events: none;
}
</style>
