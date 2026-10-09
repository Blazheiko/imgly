import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { appError, err, identityGeometry, NEUTRAL_ADJUSTMENTS, ok } from '@/core'
import { createFakeRenderer } from '../fake-renderer'
import PreviewCanvas from './PreviewCanvas.vue'
import { useEditorStore } from '../store'

/** happy-dom's WheelEvent drops modifier keys, so set them on the event directly. Wheel bubbles. */
function wheelEvent(init: { deltaY: number; ctrlKey?: boolean }) {
  const event = new WheelEvent('wheel', { deltaY: init.deltaY, cancelable: true, bubbles: true })
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
        hasTransparency: false,
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

  it('draws the Work cropped by its Geometry, and the whole turned Draft while a tool is open', async () => {
    mount(PreviewCanvas)
    expect(fake.renderer.setGeometry).toHaveBeenLastCalledWith(editor.work!.geometry, 'crop')

    editor.openTool('crop-rotate')
    await nextTick()
    expect(fake.renderer.setGeometry).toHaveBeenLastCalledWith(editor.work!.geometry, 'whole')

    const draft = { ...identityGeometry({ width: 4000, height: 4000 }), flipH: true }
    editor.setPreviewGeometry(draft)
    await nextTick()
    expect(fake.renderer.setGeometry).toHaveBeenLastCalledWith(draft, 'whole')

    editor.applyGeometry(draft)
    editor.closeTool()
    await nextTick()
    expect(fake.renderer.setGeometry).toHaveBeenLastCalledWith(draft, 'crop')
  })

  it('judges pannable by the size it shows, not the Original', async () => {
    editor.applyGeometry({
      ...identityGeometry({ width: 4000, height: 4000 }),
      crop: { x: 0, y: 0, width: 500, height: 500 },
    })
    editor.actualSize() // 500×500 at 100% fits the 1000×1000 canvas
    const wrapper = mount(PreviewCanvas)
    await nextTick()
    expect(wrapper.get('canvas').classes()).not.toContain('preview-canvas--pannable')
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
      const event = new Event(type, { cancelable: true, bubbles: true })
      Object.assign(event, { scale, clientX: 10, clientY: 10 })
      el.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    }
    expect(zoomAt).toHaveBeenCalledTimes(1)
    expect(zoomAt.mock.calls[0]![0]).toBeCloseTo(2)
  })

  it("zooms and pinches from a sibling over the canvas, such as a tool's crop frame (crop-rotate AC-19)", () => {
    const wrapper = mount(PreviewCanvas, { attachTo: document.body })
    const frame = document.createElement('div')
    // The overlay is the canvas's sibling in the canvas area, as EditorView's tool-canvas slot is.
    wrapper.element.parentElement!.append(frame)
    const zoomAt = vi.spyOn(editor, 'zoomAt')

    const wheel = wheelEvent({ ctrlKey: true, deltaY: -100 })
    frame.dispatchEvent(wheel)
    expect(wheel.defaultPrevented).toBe(true)
    for (const [type, scale] of [
      ['gesturestart', 1],
      ['gesturechange', 2],
    ] as const) {
      const event = new Event(type, { cancelable: true, bubbles: true })
      Object.assign(event, { scale, clientX: 10, clientY: 10 })
      frame.dispatchEvent(event)
    }
    expect(zoomAt).toHaveBeenCalledTimes(2)
    wrapper.unmount()
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

  describe('Adjustments (adjust sad.md §5, AC-01, AC-18)', () => {
    const applied = { ...NEUTRAL_ADJUSTMENTS, contrast: 25 }
    const draft = { ...NEUTRAL_ADJUSTMENTS, contrast: 60, sepia: 10 }
    const last = () => fake.renderer.setAdjustments.mock.lastCall?.[0]

    it('colours the Preview with the Work’s Adjustments from the start', async () => {
      editor.applyAdjustments(applied)
      mount(PreviewCanvas)
      expect(last()).toEqual(applied)
    })

    it('uses the adjust tool’s Draft while it is set, and the Work’s again after close', async () => {
      editor.applyAdjustments(applied)
      mount(PreviewCanvas)
      editor.openTool('adjust')
      editor.setPreviewAdjustments(draft)
      await nextTick()
      expect(last()).toEqual(draft)

      editor.closeTool()
      await nextTick()
      expect(last()).toEqual(applied)
    })

    it('follows an Apply', async () => {
      mount(PreviewCanvas)
      expect(last()).toEqual(NEUTRAL_ADJUSTMENTS)
      editor.openTool('adjust')
      editor.setPreviewAdjustments(draft)
      editor.applyAdjustments(draft)
      editor.closeTool()
      await nextTick()
      expect(last()).toEqual(draft)
    })

    it('shows the applied Adjustments over the whole turned image in Crop and rotate', async () => {
      editor.applyAdjustments(applied)
      mount(PreviewCanvas)
      editor.openTool('crop-rotate')
      await nextTick()
      expect(fake.renderer.setGeometry).toHaveBeenLastCalledWith(editor.work!.geometry, 'whole')
      expect(last()).toEqual(applied)
    })
  })
})
