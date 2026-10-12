import { afterEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createWork, NEUTRAL_ADJUSTMENTS } from '@/core'
import { useEditorStore } from '@/features/editor'
import { installTestHooks } from './test-hooks'

describe('window.__imglyTest.historyStats (undo-redo AC-11, sad §8)', () => {
  afterEach(() => {
    delete window.__imglyTest
  })

  it('reads the editor store’s held bytes and Steps kept, 0/0 with no Work', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    installTestHooks(pinia)
    expect(window.__imglyTest!.historyStats()).toEqual({ heldBytes: 0, steps: 0 })

    const editor = useEditorStore(pinia)
    const pixels = { width: 40, height: 30, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ width: 40, height: 30, pixels, hasTransparency: false }, 'w', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 20 })
    editor.applyAdjustments({ ...NEUTRAL_ADJUSTMENTS, contrast: 30 })
    expect(window.__imglyTest!.historyStats()).toEqual({ heldBytes: 0, steps: 2 })
  })
})
