import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createWork, PALETTE } from '@/core'
import { useEditorStore } from '@/features/editor'
import { createLayer, setLayerCanvasFactory, type CanvasFactory } from '@/render'
import { createFakeLayerCanvas, setPixel, type FakeLayerCanvas } from '@/render/testing'
import DrawControls from './DrawControls.vue'
import controlsSource from './DrawControls.vue?raw'
import { BUTTONS, CUSTOM_COLOUR, GROUPS, MODES, WIDTH_LABEL, WIDTH_TOOLTIP } from './messages'
import { useDrawStore } from './store'

describe('DrawControls (SCR-03)', () => {
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
    const pixels = { width: 40, height: 30, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ width: 40, height: 30, pixels, hasTransparency: false }, 'w-1', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    draw = useDrawStore()
    draw.open()
    wrapper = mount(DrawControls, { attachTo: document.body })
    await nextTick()
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
    setLayerCanvasFactory(previous)
  })

  const group = (name: string) => wrapper.get(`[role="radiogroup"][aria-label="${name}"]`)
  const radio = (groupName: string, name: string) =>
    group(groupName)
      .findAll('[role="radio"]')
      .find((r) => (r.attributes('aria-label') ?? r.text()) === name)!
  const custom = () => wrapper.get<HTMLInputElement>('input[type="color"]')
  const field = () => wrapper.get<HTMLInputElement>('input[type="text"], input[inputmode]')

  it('lays out Mode, Colour, Width and the footer in SCR-03 order (the tab order)', () => {
    const headings = wrapper.findAll('h3').map((h) => h.text())
    expect(headings).toEqual([GROUPS.mode, GROUPS.colour, GROUPS.width])
    const focusable = wrapper
      .findAll('[tabindex="0"], input, button:not([tabindex="-1"])')
      .map(
        (el) =>
          el.attributes('aria-label') ??
          (el.element.tagName === 'BUTTON' ? el.text() : el.attributes('type')),
      )
    expect(focusable.indexOf('Brush')).toBeLessThan(focusable.indexOf('Red'))
    expect(focusable.indexOf('Red')).toBeLessThan(focusable.indexOf(CUSTOM_COLOUR))
    expect(focusable.indexOf(CUSTOM_COLOUR)).toBeLessThan(focusable.indexOf(WIDTH_LABEL))
    expect(focusable.indexOf(WIDTH_LABEL)).toBeLessThan(focusable.indexOf(BUTTONS.clear))
    const buttons = wrapper.findAll('footer button').map((b) => b.text())
    expect(buttons).toEqual([BUTTONS.clear, BUTTONS.cancel, BUTTONS.apply])
  })

  it('opens on the Brush with the mode tooltips; picking Eraser sets the mode', async () => {
    expect(radio('Mode', 'Brush').attributes('aria-checked')).toBe('true')
    expect(radio('Mode', 'Brush').attributes('title')).toBe(MODES.brush.tooltip)
    expect(radio('Mode', 'Eraser').attributes('title')).toBe(MODES.eraser.tooltip)
    await radio('Mode', 'Eraser').trigger('click')
    expect(draw.mode).toBe('eraser')
  })

  it('shows the 10 presets in order with Red selected; a click picks one', async () => {
    const names = group('Colour')
      .findAll('[role="radio"]')
      .map((r) => r.attributes('aria-label'))
    expect(names).toEqual(PALETTE.map((c) => c.name))
    expect(radio('Colour', 'Red').attributes('aria-checked')).toBe('true')
    await radio('Colour', 'Blue').trigger('click')
    expect(draw.colour).toBe('#1E88E5')
  })

  it('keeps the colour controls enabled with the Eraser selected', async () => {
    draw.setMode('eraser')
    await nextTick()
    expect(radio('Colour', 'Blue').attributes('disabled')).toBeUndefined()
    expect(custom().attributes('disabled')).toBeUndefined()
  })

  it('a custom colour equal to a preset selects that preset', async () => {
    await custom().setValue('#1e88e5')
    expect(draw.colour).toBe('#1E88E5')
    expect(radio('Colour', 'Blue').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('.draw-controls__custom').classes()).not.toContain(
      'draw-controls__custom--selected',
    )
  })

  it('a custom colour that is no preset selects no swatch and rings the custom one', async () => {
    await custom().setValue('#123456')
    expect(draw.colour).toBe('#123456')
    const checked = group('Colour').findAll('[role="radio"][aria-checked="true"]')
    expect(checked).toHaveLength(0)
    expect(wrapper.get('.draw-controls__custom').classes()).toContain(
      'draw-controls__custom--selected',
    )
    expect(custom().attributes('aria-label')).toBe(CUSTOM_COLOUR)
    expect(wrapper.text()).toContain(CUSTOM_COLOUR)
  })

  it('the custom swatch keeps the last custom colour after a preset is picked', async () => {
    const swatch = () => wrapper.get('.draw-controls__custom-swatch')
    expect(swatch().classes()).toContain('draw-controls__custom-swatch--empty')
    await custom().setValue('#123456')
    await radio('Colour', 'Blue').trigger('click')
    expect(draw.colour).toBe('#1E88E5')
    expect(swatch().classes()).not.toContain('draw-controls__custom-swatch--empty')
    expect(swatch().attributes('style')).toContain('background: #123456')
    expect((custom().element as HTMLInputElement).value).toBe('#123456')
    expect(wrapper.get('.draw-controls__custom').classes()).not.toContain(
      'draw-controls__custom--selected',
    )
  })

  it('keeps the custom swatch fill in forced-colors mode', () => {
    const rule = /^\.draw-controls__custom-swatch\s*\{([^}]*)\}/m.exec(controlsSource)
    expect(rule![1]).toMatch(/forced-color-adjust:\s*none/)
  })

  it('has a Width slider 1 to 200 in px with its tooltip', () => {
    const range = wrapper.get<HTMLInputElement>('input[type="range"]')
    expect(range.attributes('aria-label')).toBe(WIDTH_LABEL)
    expect(range.attributes('min')).toBe('1')
    expect(range.attributes('max')).toBe('200')
    expect(range.attributes('title')).toBe(WIDTH_TOOLTIP)
    expect(range.element.value).toBe('12')
  })

  it('commits the width field on Enter by the AC-03 rule, without applying the tool', async () => {
    await field().setValue('20 px')
    await field().trigger('keydown', { key: 'Enter' })
    expect(draw.width).toBe(20)
    expect(draw.isOpen).toBe(true)
  })

  it('Clear, Cancel and Apply act on the store', async () => {
    const layer = createLayer({ width: 40, height: 30 })
    setPixel(layer.pixels as unknown as FakeLayerCanvas, 1, 1, [0, 0, 0, 255])
    editor.closeTool()
    editor.applyDrawing(layer, false)
    draw.open()
    await nextTick()
    const footer = wrapper.findAll('footer button')
    await footer[0]!.trigger('click')
    expect(draw.draft).toBeNull()
    await footer[2]!.trigger('click')
    expect(draw.isOpen).toBe(false)
    expect(editor.work!.drawing).toBeNull()
  })
})
