import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ok } from '@/core'
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

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
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
})
