/**
 * Test-only entry point of the editor feature: stand-ins other modules' tests may use. Production
 * code never imports this (it pulls in Vitest).
 */
import { ref } from 'vue'
import { vi } from 'vitest'
import type { Work } from '@/core'
import type { createAutosave } from './autosave'
export { createFakeRenderer } from './fake-renderer'

type Autosave = ReturnType<typeof createAutosave>
type W = Work<ImageBitmap, OffscreenCanvas>

/**
 * A scriptable stand-in for Autosave, handed to the store through `setAutosave`. `hold()` makes
 * `settled()` wait until `release()`; a Work counts as stored only after `markStored(work)`.
 */
export function createFakeAutosave(options: { available?: boolean } = {}) {
  const galleryAvailable = ref(options.available ?? true)
  const saving = ref(false)
  const stored = new Set<string>()
  let gate: Promise<void> | null = null
  let open: (() => void) | null = null
  const key = (work: W) => `${work.id}:${work.revision}`
  const fake = {
    request: vi.fn<(work: W) => void>(),
    saving,
    settled: vi.fn(() => gate ?? Promise.resolve()),
    isStored: vi.fn((work: W) => galleryAvailable.value && stored.has(key(work))),
    galleryAvailable,
    connectGallery: vi.fn<Autosave['connectGallery']>(),
    keepEncoded: vi.fn<Autosave['keepEncoded']>(),
  }
  return {
    fake: fake as unknown as Autosave,
    spies: fake,
    available: (on: boolean) => (galleryAvailable.value = on),
    markStored: (work: W) => void stored.add(key(work)),
    hold() {
      saving.value = true
      gate = new Promise<void>((resolve) => (open = resolve))
    },
    release() {
      saving.value = false
      gate = null
      open?.()
      open = null
    },
  }
}
