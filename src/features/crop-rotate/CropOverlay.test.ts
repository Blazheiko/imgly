import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createWork, cropRectOnScreen, turnedBounds } from '@/core'
import { useEditorStore } from '@/features/editor'
import CropOverlay from './CropOverlay.vue'
import { HANDLE_LABELS, LABELS } from './messages'
import { useCropRotateStore } from './store'

const original = { width: 4000, height: 3000 }

describe('CropOverlay (ADR-0005)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>
  let tool: ReturnType<typeof useCropRotateStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800) // fit: zoom 0.25, so 1 screen px = 4 image px
    const pixels = { ...original, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ ...original, pixels, hasTransparency: false }, 'w', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    tool = useCropRotateStore()
    tool.open()
    tool.resizeBy('nw', 1000, 1000)
    tool.resizeBy('se', -1000, -1000) // a frame with room on every side: 1000,1000 → 3000,2000
    wrapper = mount(CropOverlay, { attachTo: document.body })
    await nextTick()
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  const frame = () => wrapper.get('[data-testid="crop-frame"]')
  const handle = (label: string) => wrapper.get(`[aria-label="${label}"]`)

  it('places the frame where core’s overlay maths puts the Crop', () => {
    const rect = cropRectOnScreen(
      tool.draft!.crop,
      turnedBounds(tool.draft!, original),
      editor.view,
    )
    const style = (frame().element as HTMLElement).style
    expect(style.transform).toBe(`translate(${rect.left}px, ${rect.top}px)`)
    expect(style.width).toBe(`${rect.width}px`)
    expect(style.height).toBe(`${rect.height}px`)
  })

  it('dims the outside with four panels', () => {
    expect(wrapper.findAll('[data-testid="crop-dim"]')).toHaveLength(4)
  })

  it('makes the frame and its 8 handles focusable with the catalog labels (AC-20)', () => {
    expect(frame().attributes('aria-label')).toBe(LABELS.frame)
    expect(frame().attributes('tabindex')).toBe('0')
    for (const label of Object.values(HANDLE_LABELS)) {
      expect(handle(label).attributes('tabindex')).toBe('0')
    }
  })

  it('moves the frame by dragging inside it, in image pixels, with the thirds grid meanwhile (AC-01)', async () => {
    const start = { ...tool.draft!.crop }
    expect(wrapper.find('[data-testid="thirds-grid"]').exists()).toBe(false)
    await frame().trigger('pointerdown', { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    await frame().trigger('pointermove', { pointerId: 1, clientX: 110, clientY: 95 })
    expect(wrapper.find('[data-testid="thirds-grid"]').exists()).toBe(true)
    await frame().trigger('pointermove', { pointerId: 1, clientX: 120, clientY: 90 })
    expect(tool.draft!.crop).toEqual({ ...start, x: start.x + 80, y: start.y - 40 })
    await frame().trigger('pointerup', { pointerId: 1 })
    expect(wrapper.find('[data-testid="thirds-grid"]').exists()).toBe(false)
  })

  it('resizes by an edge or a corner, stopping at the image edge (AC-02)', async () => {
    const h = handle(HANDLE_LABELS.se)
    await h.trigger('pointerdown', { button: 0, pointerId: 2, clientX: 0, clientY: 0 })
    await h.trigger('pointermove', { pointerId: 2, clientX: -50, clientY: 5000 })
    await h.trigger('pointerup', { pointerId: 2 })
    expect(tool.draft!.crop).toEqual({ x: 1000, y: 1000, width: 1800, height: 2000 })
  })

  it('moves the focused frame by 1 px of the image, 10 with Shift (AC-20)', async () => {
    const { x, y } = tool.draft!.crop
    await frame().trigger('keydown', { key: 'ArrowRight' })
    await frame().trigger('keydown', { key: 'ArrowUp', shiftKey: true })
    expect(tool.draft!.crop).toMatchObject({ x: x + 1, y: y - 10 })
  })

  it('resizes from a focused handle, with a locked proportion following (AC-20)', async () => {
    tool.chooseProportion({ kind: '1:1', orientation: 'landscape' })
    await nextTick()
    const before = tool.draft!.crop
    await handle(HANDLE_LABELS.nw).trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(tool.draft!.crop.width).toBe(before.width + 10)
    expect(tool.draft!.crop.height).toBe(before.height + 10)
  })

  it('keeps a handled arrow on the handle, so the frame does not also move (AC-20)', async () => {
    const before = tool.draft!.crop
    const seen: string[] = []
    const listen = (e: KeyboardEvent) => seen.push(e.key)
    window.addEventListener('keydown', listen)
    await handle(HANDLE_LABELS.e).trigger('keydown', { key: 'ArrowRight' })
    window.removeEventListener('keydown', listen)
    expect(tool.draft!.crop).toMatchObject({ x: before.x, width: before.width + 1 })
    expect(seen).toEqual([])
  })

  it('shows the fine grid only while the angle changes (AC-05)', async () => {
    vi.useFakeTimers()
    expect(wrapper.find('[data-testid="fine-grid"]').exists()).toBe(false)
    tool.setAngle(30)
    await nextTick()
    expect(wrapper.find('[data-testid="fine-grid"]').exists()).toBe(true)
    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(wrapper.find('[data-testid="fine-grid"]').exists()).toBe(false)
  })

  it('follows zoom and pan without changing the Draft (AC-19)', async () => {
    const draft = tool.draft
    editor.zoomAt(2, { x: 500, y: 400 })
    await nextTick()
    const rect = cropRectOnScreen(draft!.crop, turnedBounds(draft!, original), editor.view)
    expect((frame().element as HTMLElement).style.width).toBe(`${rect.width}px`)
    expect(tool.draft).toBe(draft)
  })
})
