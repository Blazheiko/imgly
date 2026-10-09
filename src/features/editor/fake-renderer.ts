import { vi } from 'vitest'
import { ok, type ImageSample } from '@/core'
import type { GeometryMode, PreviewRenderer, RendererStatus } from '@/render'
import type { Adjustments, Geometry } from '@/core'
import type { RendererFactory } from './store'

/**
 * A recording stand-in for the WebGL2 preview renderer, for component tests in happy-dom (which
 * has no WebGL). Test-only: nothing in production imports this.
 */
export function createFakeRenderer() {
  const listeners = new Set<(status: RendererStatus) => void>()
  const renderer = {
    status: 'ready' as RendererStatus,
    setOriginal: vi.fn<(bitmap: ImageBitmap) => void>(),
    setView: vi.fn(),
    setGeometry: vi.fn<(g: Geometry, mode: GeometryMode) => void>(),
    setAdjustments: vi.fn<(a: Adjustments) => void>(),
    sampleCrop: vi.fn<PreviewRenderer['sampleCrop']>(() =>
      ok<ImageSample>({ width: 1, height: 1, data: new Uint8Array([128, 128, 128, 255]) }),
    ),
    resize: vi.fn<(width: number, height: number) => void>(),
    dispose: vi.fn(),
    onStatus(listener: (status: RendererStatus) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  } satisfies PreviewRenderer
  const factory = vi.fn<RendererFactory>(() => ok(renderer))
  const emit = (status: RendererStatus) => listeners.forEach((listener) => listener(status))
  return { renderer, factory, emit }
}
