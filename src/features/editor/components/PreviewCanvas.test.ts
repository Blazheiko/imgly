import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { appError, err, ok } from '@/core'
import { createFakeRenderer } from '../fake-renderer'
import PreviewCanvas from './PreviewCanvas.vue'
import { useEditorStore } from '../store'

/** happy-dom's WheelEvent drops modifier keys, so set them on the event directly. */
function wheelEvent(init: { deltaY: number; ctrlKey?: boolean }) {
  const event = new WheelEvent('wheel', { deltaY: init.deltaY, cancelable: true })
  Object.defineProperty(event, 'ctrlKey', { value: init.ctrlKey ?? false })
  return event
}

describe('PreviewCanvas', () => {
  let editor: ReturnType<typeof useEditorStore>
  let fake: ReturnType<typeof createFakeRenderer>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    fake = createFakeRenderer()
    editor.setRendererFactory(fake.factory)
    editor.setDecoder(async () =>
      ok({
        bitmap: { width: 4000, height: 4000, close() {} } as unknown as ImageBitmap,
        sourceWidth: 4000,
        sourceHeight: 4000,
        width: 4000,
        height: 4000,
        format: 'png',
        animated: false,
        downscaled: false,
      }),
    )
    editor.setCanvasSize(1000, 1000)
    await editor.openImage(new Blob())
  })

  it('shows SCR-05 when the renderer cannot be created at mount (AC-19b)', async () => {
    await editor.runCapabilityGate(async () => ok(undefined))
    editor.setRendererFactory(() => err(appError('DISPLAY_LOST')))
    mount(PreviewCanvas)
    expect(editor.display).toBe('lost')
  })

  it('creates its renderer on its own canvas and uploads the open Original (ADR 0003)', () => {
    const wrapper = mount(PreviewCanvas)
    expect(fake.factory).toHaveBeenCalledWith(wrapper.get('canvas').element)
    expect(fake.renderer.setOriginal).toHaveBeenCalledWith(editor.work!.original.pixels)
    expect(fake.renderer.setView).toHaveBeenLastCalledWith(editor.view)
  })

  it('hands each View change to the renderer without re-uploading the Original (AC-14)', async () => {
    mount(PreviewCanvas)
    fake.renderer.setOriginal.mockClear()
    editor.actualSize()
    await nextTick()
    expect(fake.renderer.setView).toHaveBeenLastCalledWith(
      expect.objectContaining({ zoom: 1, autoFit: false }),
    )
    expect(fake.renderer.setOriginal).not.toHaveBeenCalled()
  })

  it('uploads a newly opened Original', async () => {
    mount(PreviewCanvas)
    fake.renderer.setOriginal.mockClear()
    await editor.openImage(new Blob())
    await nextTick()
    expect(fake.renderer.setOriginal).toHaveBeenCalledWith(editor.work!.original.pixels)
  })

  it('reports the renderer status to the store (AC-19)', async () => {
    await editor.runCapabilityGate(async () => ok(undefined))
    mount(PreviewCanvas)
    fake.emit('restoring')
    expect(editor.display).toBe('restoring')
    fake.emit('ready')
    expect(editor.display).toBe('ok')
  })

  it('disposes its renderer on unmount', () => {
    mount(PreviewCanvas).unmount()
    expect(fake.renderer.dispose).toHaveBeenCalledTimes(1)
  })

  it('renders one canvas element', () => {
    const wrapper = mount(PreviewCanvas)
    expect(wrapper.findAll('canvas')).toHaveLength(1)
  })

  it('turns Ctrl+wheel into a zoom and blocks the page zoom', async () => {
    const wrapper = mount(PreviewCanvas)
    const zoomAt = vi.spyOn(editor, 'zoomAt')
    const event = wheelEvent({ ctrlKey: true, deltaY: -100 })
    wrapper.get('canvas').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(zoomAt).toHaveBeenCalledWith(expect.any(Number), expect.any(Object))
  })

  it('turns a Safari pinch into a View zoom by the scale change (AC-12)', () => {
    const wrapper = mount(PreviewCanvas)
    const zoomAt = vi.spyOn(editor, 'zoomAt')
    const el = wrapper.get('canvas').element
    for (const [type, scale] of [
      ['gesturestart', 1],
      ['gesturechange', 2],
    ] as const) {
      const event = new Event(type, { cancelable: true })
      Object.assign(event, { scale, clientX: 10, clientY: 10 })
      el.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    }
    expect(zoomAt).toHaveBeenCalledTimes(1)
    expect(zoomAt.mock.calls[0]![0]).toBeCloseTo(2)
  })

  it('turns a plain wheel into a pan', () => {
    const wrapper = mount(PreviewCanvas)
    const panBy = vi.spyOn(editor, 'panBy')
    wrapper.get('canvas').element.dispatchEvent(wheelEvent({ deltaY: 40 }))
    expect(panBy).toHaveBeenCalled()
  })

  it('pans by the pointer drag delta', async () => {
    const wrapper = mount(PreviewCanvas)
    const panBy = vi.spyOn(editor, 'panBy')
    const canvas = wrapper.get('canvas')
    await canvas.trigger('pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    await canvas.trigger('pointermove', { clientX: 30, clientY: 15, pointerId: 1 })
    await canvas.trigger('pointerup', { pointerId: 1 })

    expect(panBy).toHaveBeenCalledWith(20 * devicePixelRatio, 5 * devicePixelRatio)
  })

  it('shows a grab cursor only when the image exceeds the canvas area', async () => {
    const wrapper = mount(PreviewCanvas)
    expect(wrapper.get('canvas').classes()).not.toContain('preview-canvas--pannable')
    editor.actualSize()
    await wrapper.vm.$nextTick()
    expect(wrapper.get('canvas').classes()).toContain('preview-canvas--pannable')
  })

  it('keeps the default cursor in Space pan mode while the image fits (AC-13)', async () => {
    const wrapper = mount(PreviewCanvas, { props: { spacePan: true } })
    expect(wrapper.get('canvas').classes()).not.toContain('preview-canvas--space-pan')
    editor.actualSize()
    await wrapper.vm.$nextTick()
    expect(wrapper.get('canvas').classes()).toContain('preview-canvas--space-pan')
  })
})
