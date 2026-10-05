<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PreviewRenderer } from '@/render'
import { useEditorStore } from '../store'
import { pinchGesture, wheelGesture, type PinchInput } from './gestures'

const editor = useEditorStore()
const canvas = ref<HTMLCanvasElement>()
const dragging = ref(false)
let renderer: PreviewRenderer | undefined
let observer: ResizeObserver | undefined
let lastPointer: { id: number; x: number; y: number } | undefined
let pinchScale = 1

/** The image overflows the canvas area on some axis, so it can be panned (AC-13). */
const pannable = computed(() => {
  const { work, view, canvasSize } = editor
  if (!work) return false
  return (
    work.original.width * view.zoom > canvasSize.width ||
    work.original.height * view.zoom > canvasSize.height
  )
})

function onWheel(event: WheelEvent) {
  event.preventDefault() // never scroll or zoom the page itself (AC-12)
  const gesture = wheelGesture(event, canvas.value!.getBoundingClientRect(), devicePixelRatio)
  if (gesture.kind === 'zoom') editor.zoomAt(gesture.factor, gesture.point)
  else editor.panBy(gesture.dx, gesture.dy)
}

/** Safari's pinch arrives as non-standard gesture events, not as Ctrl+wheel (AC-12). */
function onGestureStart(event: Event) {
  event.preventDefault()
  pinchScale = (event as unknown as PinchInput).scale || 1
}

function onGestureChange(event: Event) {
  event.preventDefault()
  const input = event as unknown as PinchInput
  const rect = canvas.value!.getBoundingClientRect()
  const gesture = pinchGesture(input, pinchScale, rect, devicePixelRatio)
  pinchScale = input.scale
  editor.zoomAt(gesture.factor, gesture.point)
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  lastPointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
  dragging.value = true
  canvas.value?.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!lastPointer || event.pointerId !== lastPointer.id) return
  const dpr = devicePixelRatio
  editor.panBy((event.clientX - lastPointer.x) * dpr, (event.clientY - lastPointer.y) * dpr)
  lastPointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
}

function onPointerUp(event: PointerEvent) {
  if (!lastPointer || event.pointerId !== lastPointer.id) return
  lastPointer = undefined
  dragging.value = false
}

/** Sizes the backing store in device pixels, exactly where the browser reports it. */
function onResize([entry]: ResizeObserverEntry[]) {
  if (!entry) return
  const exact = entry.devicePixelContentBoxSize?.[0]
  const width = exact ? exact.inlineSize : Math.round(entry.contentRect.width * devicePixelRatio)
  const height = exact ? exact.blockSize : Math.round(entry.contentRect.height * devicePixelRatio)
  renderer?.resize(width, height)
  editor.setCanvasSize(width, height)
}

onMounted(() => {
  const el = canvas.value!
  const result = editor.createRenderer(el)
  if (result.ok) {
    renderer = result.value
    renderer.onStatus((status) => editor.setRendererStatus(status))
  } else {
    editor.setRendererStatus('lost') // the gate passed, yet this canvas can't show the Preview
  }
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('gesturestart', onGestureStart)
  el.addEventListener('gesturechange', onGestureChange)

  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(onResize)
    try {
      observer.observe(el, { box: 'device-pixel-content-box' })
    } catch {
      observer.observe(el)
    }
  }

  watch(
    () => editor.work?.original.pixels,
    (bitmap) => bitmap && renderer?.setOriginal(bitmap),
    { immediate: true },
  )
  watch(
    () => editor.view,
    (view) => renderer?.setView(view),
    { immediate: true },
  )
})

onBeforeUnmount(() => {
  observer?.disconnect()
  canvas.value?.removeEventListener('wheel', onWheel)
  canvas.value?.removeEventListener('gesturestart', onGestureStart)
  canvas.value?.removeEventListener('gesturechange', onGestureChange)
  renderer?.dispose()
})
</script>

<template>
  <canvas
    ref="canvas"
    class="preview-canvas"
    :class="{
      // A fitted image can't pan, so it keeps the default cursor, Space or not (screens.md SCR-02).
      'preview-canvas--pannable': pannable,
      'preview-canvas--dragging': dragging,
    }"
    data-testid="preview-canvas"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  />
</template>

<style scoped>
.preview-canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--color-canvas-surround);
  touch-action: none;
}

.preview-canvas--pannable {
  cursor: grab;
}

.preview-canvas--pannable.preview-canvas--dragging {
  cursor: grabbing;
}
</style>
