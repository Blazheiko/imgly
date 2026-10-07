import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createWork, identityGeometry } from '@/core'
import { useEditorStore } from '@/features/editor'
import CropRotateControls from './CropRotateControls.vue'
import { useCropRotateStore } from './store'

const original = { width: 4000, height: 3000 }

describe('CropRotateControls (SCR-03 panel)', () => {
  let wrapper: VueWrapper
  let editor: ReturnType<typeof useEditorStore>
  let tool: ReturnType<typeof useCropRotateStore>

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    editor.setCanvasSize(1000, 800)
    const pixels = { ...original, close() {} } as unknown as ImageBitmap
    editor.work = createWork({ ...original, pixels, hasTransparency: false }, 'w', {
      sourceName: 'a',
      sourceFormat: 'png',
    })
    tool = useCropRotateStore()
    tool.open()
    wrapper = mount(CropRotateControls, { attachTo: document.body })
    await nextTick()
  })

  afterEach(() => {
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  const button = (name: string) =>
    wrapper.findAll('button').find((b) => b.attributes('aria-label') === name || b.text() === name)!
  const field = (label: string) =>
    wrapper.get(
      `input[id="${wrapper
        .findAll('label')
        .find((l) => l.text() === label)!
        .attributes('for')}"]`,
    )
  const angleField = () => wrapper.get('.slider-field input:not([type="range"])')
  const radio = (group: string, label: string) =>
    wrapper
      .get(`[role="radiogroup"][aria-label="${group}"]`)
      .findAll('[role="radio"]')
      .find((r) => r.text() === label)!

  it('turns and flips the Draft (AC-03, AC-04)', async () => {
    await button('Rotate right').trigger('click')
    expect(tool.draft!.rotation).toBe(90)
    await button('Rotate left').trigger('click')
    await button('Rotate left').trigger('click')
    expect(tool.draft!.rotation).toBe(270)
    await button('Flip horizontal').trigger('click')
    await button('Flip vertical').trigger('click')
    expect(tool.draft).toMatchObject({ flipH: true, flipV: true })
  })

  it('shows the angle in degrees with one decimal, its sign changed by a flip (AC-04, AC-05)', async () => {
    tool.setAngle(50)
    await nextTick()
    expect((angleField().element as HTMLInputElement).value).toBe('5.0')
    await button('Flip horizontal').trigger('click')
    expect((angleField().element as HTMLInputElement).value).toBe('-5.0')
  })

  it('drags the slider in 0.1° steps, marked at 0 (AC-05)', async () => {
    const range = wrapper.get('input[type="range"]')
    expect(range.attributes('step')).toBe('0.1')
    expect(range.attributes('min')).toBe('-45')
    await range.setValue('12.3')
    expect(tool.draft!.straighten).toBe(123)
  })

  it('checks a typed angle only on leave or Enter; Enter never applies the tool (AC-07)', async () => {
    const input = angleField()
    await input.setValue('99')
    expect(tool.draft!.straighten).toBe(0)
    await input.trigger('keydown', { key: 'Enter' })
    expect(tool.draft!.straighten).toBe(450)
    expect(editor.activeTool).toBe('crop-rotate')

    await input.setValue('1e2')
    await input.trigger('blur')
    expect(tool.draft!.straighten).toBe(450)
    expect((input.element as HTMLInputElement).value).toBe('45.0')
  })

  it('locks a proportion and turns its orientation with a quarter turn (AC-03, AC-08)', async () => {
    await radio('Proportion', '4:3').trigger('click')
    expect(tool.proportion.kind).toBe('4:3')
    expect(radio('Orientation', 'Landscape').attributes('aria-checked')).toBe('true')
    await button('Rotate right').trigger('click')
    expect(radio('Orientation', 'Portrait').attributes('aria-checked')).toBe('true')
    await radio('Orientation', 'Landscape').trigger('click')
    expect(tool.proportion).toEqual({ kind: '4:3', orientation: 'landscape' })
  })

  it('disables orientation for Free and 1:1 (AC-08)', async () => {
    expect(radio('Orientation', 'Portrait').attributes('disabled')).toBeDefined()
    await radio('Proportion', '1:1').trigger('click')
    expect(radio('Orientation', 'Portrait').attributes('disabled')).toBeDefined()
    await radio('Proportion', '16:9').trigger('click')
    expect(radio('Orientation', 'Portrait').attributes('disabled')).toBeUndefined()
  })

  it('shows the frame’s size live and applies a typed size on leave (AC-09, AC-10)', async () => {
    expect((field('Width').element as HTMLInputElement).value).toBe('4000')
    tool.resizeBy('e', -100, 0)
    await nextTick()
    expect((field('Width').element as HTMLInputElement).value).toBe('3900')

    await field('Height').setValue('0')
    await field('Height').trigger('blur')
    expect(tool.draft!.crop.height).toBe(1)

    await field('Width').setValue('99999')
    await field('Width').trigger('keydown', { key: 'Enter' })
    expect(tool.draft!.crop.width).toBe(4000)
    expect(editor.activeTool).toBe('crop-rotate')
  })

  it('Reset, Cancel and Apply act on the store (AC-11, AC-12)', async () => {
    await button('Rotate right').trigger('click')
    await button('Reset').trigger('click')
    expect(tool.draft).toEqual(identityGeometry(original))
    await button('Rotate right').trigger('click')
    await button('Apply').trigger('click')
    expect(editor.work!.geometry.rotation).toBe(90)
    expect(editor.activeTool).toBeNull()
  })

  it('Cancel leaves the Work as it was (AC-11)', async () => {
    await button('Flip vertical').trigger('click')
    await button('Cancel').trigger('click')
    expect(editor.activeTool).toBeNull()
    expect(editor.work!.geometry.flipV).toBe(false)
  })
})
