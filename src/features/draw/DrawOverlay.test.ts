import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createWork } from '@/core'
import { useEditorStore } from '@/features/editor'
import { setLayerCanvasFactory, type CanvasFactory } from '@/render'
import { createFakeLayerCanvas, type FakeLayerCanvas } from '@/render/testing'
import DrawOverlay from './DrawOverlay.vue'
import { useDrawStore } from './store'

type Init = PointerEventInit & { coalesced?: { clientX: number; clientY: number }[] | null }

function pointer(type: string, init: Init = {}) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    pointerId: 1,
    ...init,
  })
  if (init.coalesced !== undefined) {
    Object.defineProperty(event, 'getCoalescedEvents', {
      value:
        init.coalesced === null
          ? undefined
          : () => init.coalesced!.map((p) => ({ ...p }) as PointerEvent),
    })
  }
  return event
}

describe('DrawOverlay (SCR-03, sad.md §8 Input)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>
  let draw: ReturnType<typeof useDrawStore>
  let previous: CanvasFactory

  beforeEach(async () => {
    setActivePinia(createPinia())
    previous = setLayerCanvasFactory(
      (w, h) => createFakeLayerCanvas(w, h) as unknown as OffscreenCanvas,
    )
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    const pixels = { width: 400, height: 300, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ width: 400, height: 300, pixels, hasTransparency: false }, 'w', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    editor.actualSize() // zoom 1, image centred: pan (300, 250)
    draw = useDrawStore()
    draw.open()
    wrapper = mount(DrawOverlay, { attachTo: document.body })
    await nextTick()
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
    setLayerCanvasFactory(previous)
  })

  const el = () => wrapper.get('[data-testid="draw-overlay"]').element
  const arcs = () =>
    (draw.draft?.pixels as unknown as FakeLayerCanvas | undefined)?.calls.filter(
      (c) => c[0] === 'arc' || c[0] === 'bezierCurveTo',
    ) ?? []

  it('a main-button press and release over the image paints a dot at the mapped point', () => {
    el().dispatchEvent(pointer('pointerdown', { clientX: 310, clientY: 260 }))
    expect(draw.strokeActive).toBe(true)
    expect(editor.strokeActive).toBe(true)
    el().dispatchEvent(pointer('pointerup', { clientX: 310, clientY: 260 }))
    expect(draw.strokeActive).toBe(false)
    expect(editor.strokeActive).toBe(false)
    expect(arcs()).toEqual([['arc', 10, 10, 6, 0, Math.PI * 2]])
  })

  it.each([1, 2])('button %i makes no Stroke', (button) => {
    el().dispatchEvent(pointer('pointerdown', { clientX: 310, clientY: 260, button }))
    expect(draw.strokeActive).toBe(false)
  })

  it('feeds every coalesced position of a move into the Stroke', () => {
    el().dispatchEvent(pointer('pointerdown', { clientX: 310, clientY: 260 }))
    el().dispatchEvent(
      pointer('pointermove', {
        clientX: 340,
        clientY: 260,
        coalesced: [
          { clientX: 320, clientY: 260 },
          { clientX: 330, clientY: 260 },
          { clientX: 340, clientY: 260 },
        ],
      }),
    )
    el().dispatchEvent(pointer('pointerup', { clientX: 340, clientY: 260 }))
    const ends = arcs().map((c) => c.slice(5))
    expect(ends).toEqual([
      [20, 10],
      [30, 10],
      [40, 10],
    ])
  })

  it('takes the event itself as the one point without getCoalescedEvents', () => {
    el().dispatchEvent(pointer('pointerdown', { clientX: 310, clientY: 260 }))
    el().dispatchEvent(pointer('pointermove', { clientX: 330, clientY: 260, coalesced: null }))
    el().dispatchEvent(pointer('pointerup'))
    expect(arcs().map((c) => c.slice(5))).toEqual([[30, 10]])
  })

  it('a second pointer ends the Stroke and keeps it; the window losing focus too', () => {
    el().dispatchEvent(pointer('pointerdown', { clientX: 310, clientY: 260 }))
    el().dispatchEvent(pointer('pointerdown', { clientX: 500, clientY: 400, pointerId: 2 }))
    expect(draw.strokeActive).toBe(false)
    expect(draw.draft).not.toBeNull()

    el().dispatchEvent(pointer('pointerdown', { clientX: 320, clientY: 270 }))
    window.dispatchEvent(new Event('blur'))
    expect(draw.strokeActive).toBe(false)
  })

  it('a pointer cancel ends the Stroke and keeps it', () => {
    el().dispatchEvent(pointer('pointerdown', { clientX: 310, clientY: 260 }))
    el().dispatchEvent(pointer('pointercancel'))
    expect(draw.strokeActive).toBe(false)
    expect(draw.draft).not.toBeNull()
  })

  it('lets a Space-drag through to the canvas: no Stroke', async () => {
    editor.setSpacePan(true)
    await nextTick()
    expect(wrapper.get('[data-testid="draw-overlay"]').classes()).toContain(
      'draw-overlay--pan-through',
    )
    el().dispatchEvent(pointer('pointerdown', { clientX: 310, clientY: 260 }))
    expect(draw.strokeActive).toBe(false)
  })

  it('starts a Stroke from a press over the surround (clipped later)', () => {
    el().dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }))
    expect(draw.strokeActive).toBe(true)
  })

  describe('the width circle (AC-02)', () => {
    const circle = () => wrapper.find('[data-testid="draw-width-circle"]')

    it('follows the pointer over the image at width × zoom and hides the cursor', async () => {
      el().dispatchEvent(pointer('pointermove', { clientX: 350, clientY: 300 }))
      await nextTick()
      expect(circle().exists()).toBe(true)
      expect(circle().attributes('style')).toContain('width: 12px')
      expect(wrapper.get('[data-testid="draw-overlay"]').classes()).toContain(
        'draw-overlay--over-image',
      )
      editor.zoomAt(2, { x: 350, y: 300 })
      await nextTick()
      expect(circle().attributes('style')).toContain('width: 24px')
    })

    it('is hidden over the surround, with the normal cursor', async () => {
      el().dispatchEvent(pointer('pointermove', { clientX: 10, clientY: 10 }))
      await nextTick()
      expect(circle().exists()).toBe(false)
      expect(wrapper.get('[data-testid="draw-overlay"]').classes()).not.toContain(
        'draw-overlay--over-image',
      )
    })
  })
})
