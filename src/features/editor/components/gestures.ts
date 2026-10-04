import type { Point } from '@/core'

export type WheelGesture =
  { kind: 'zoom'; factor: number; point: Point } | { kind: 'pan'; dx: number; dy: number }

const LINE_PX = 16
const PAGE_PX = 800
/** Zoom speed: a 100 px wheel notch is about ×1.28. */
const ZOOM_PER_PX = 0.0025

/**
 * Turns a wheel event into a View change in device pixels (sad.md §8 Pixel units): Ctrl/Cmd
 * (which trackpad pinch also sets) zooms around the pointer; otherwise it pans — Shift makes a
 * vertical wheel horizontal, and a trackpad scrolls both ways.
 */
export type WheelInput = Pick<
  WheelEvent,
  'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'clientX' | 'clientY'
>

export function wheelGesture(
  event: WheelInput,
  rect: { left: number; top: number },
  dpr: number,
): WheelGesture {
  const unit = event.deltaMode === 1 ? LINE_PX : event.deltaMode === 2 ? PAGE_PX : 1
  const deltaX = event.deltaX * unit
  const deltaY = event.deltaY * unit

  if (event.ctrlKey || event.metaKey) {
    return {
      kind: 'zoom',
      factor: Math.exp(-deltaY * ZOOM_PER_PX),
      point: { x: (event.clientX - rect.left) * dpr, y: (event.clientY - rect.top) * dpr },
    }
  }
  if (event.shiftKey) return { kind: 'pan', dx: -(deltaX || deltaY) * dpr, dy: 0 }
  return { kind: 'pan', dx: -deltaX * dpr, dy: -deltaY * dpr }
}
