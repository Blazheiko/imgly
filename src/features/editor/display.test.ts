import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { appError, err, ok } from '@/core'
import { useEditorStore } from './store'

describe('editor store — display state', () => {
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    editor = useEditorStore()
  })

  it('is checking until the start-up gate answers', () => {
    expect(editor.display).toBe('checking')
  })

  it('becomes ok when the gate passes', async () => {
    await editor.runCapabilityGate(async () => ok(undefined))
    expect(editor.display).toBe('ok')
  })

  it('becomes unsupported when the gate fails (AC-18)', async () => {
    await editor.runCapabilityGate(async () => err(appError('UNSUPPORTED_BROWSER')))
    expect(editor.display).toBe('unsupported')
  })

  it('follows the renderer through restoring back to ok (AC-19)', async () => {
    await editor.runCapabilityGate(async () => ok(undefined))
    editor.setRendererStatus('restoring')
    expect(editor.display).toBe('restoring')
    editor.setRendererStatus('ready')
    expect(editor.display).toBe('ok')
  })

  it('stays lost once the display is lost (AC-19b)', async () => {
    await editor.runCapabilityGate(async () => ok(undefined))
    editor.setRendererStatus('lost')
    expect(editor.display).toBe('lost')
    editor.setRendererStatus('ready')
    expect(editor.display).toBe('lost')
  })

  it('cancels a waiting replace when the display is lost, closing the held image', async () => {
    await editor.runCapabilityGate(async () => ok(undefined))
    const close = vi.fn()
    editor.setDecoder(async () =>
      ok({
        bitmap: { width: 10, height: 10, close } as unknown as ImageBitmap,
        sourceWidth: 10,
        sourceHeight: 10,
        width: 10,
        height: 10,
        format: 'png',
        animated: false,
        downscaled: false,
      }),
    )
    await editor.openImage(new Blob())
    editor.applyEdit()
    await editor.openImage(new Blob())
    expect(editor.phase).toBe('confirming')

    editor.setRendererStatus('lost')
    expect(editor.phase).toBe('idle')
    expect(editor.pending).toBeNull()
    expect(close).toHaveBeenCalledTimes(1)
  })
})
