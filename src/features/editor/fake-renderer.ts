import { vi } from 'vitest'
import { ok } from '@/core'
import type { PreviewRenderer, RendererStatus } from '@/render'
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
