import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { identityGeometry, ok } from '@/core'
import EditorStatusBar from './EditorStatusBar.vue'
import { useEditorStore } from '../store'

async function openedEditor(width: number, height: number) {
  setActivePinia(createPinia())
  const editor = useEditorStore()
  editor.setDecoder(async () =>
    ok({
      bitmap: { width, height, close() {} } as unknown as ImageBitmap,
      sourceWidth: width,
      sourceHeight: height,
      width,
      height,
      format: 'jpeg',
      animated: false,
      downscaled: false,
      hasTransparency: false,
    }),
  )
  editor.setCanvasSize(1000, 1000)
  await editor.openImage(new Blob())
  return editor
}

const button = (wrapper: ReturnType<typeof mount>, name: string) =>
  wrapper.findAll('button').find((b) => b.attributes('aria-label') === name)!

describe('EditorStatusBar', () => {
  let editor: ReturnType<typeof useEditorStore>

  beforeEach(async () => {
    editor = await openedEditor(4096, 2731)
  })

  it('shows the Original’s dimensions (AC-05, AC-06)', () => {
    const wrapper = mount(EditorStatusBar)
    expect(wrapper.get('[data-testid="dimensions-readout"]').text()).toBe('4096 × 2731 px')
  })

  it('shows the Work’s size after a 90° Rotation, from the Original’s dimensions (AC-01)', async () => {
    editor.applyGeometry({
      ...identityGeometry({ width: 4096, height: 2731 }),
      rotation: 90,
      crop: { x: 0, y: 0, width: 2731, height: 4096 },
    })
    const wrapper = mount(EditorStatusBar)
    expect(wrapper.get('[data-testid="dimensions-readout"]').text()).toBe(
      '2731 × 4096 px, from 4096 × 2731 px',
    )
  })

  it('shows the Crop’s size, from the Original’s dimensions (AC-14)', () => {
    editor.applyGeometry({
      ...identityGeometry({ width: 4096, height: 2731 }),
      crop: { x: 10, y: 10, width: 1920, height: 1080 },
    })
    const wrapper = mount(EditorStatusBar)
    expect(wrapper.get('[data-testid="dimensions-readout"]').text()).toBe(
      '1920 × 1080 px, from 4096 × 2731 px',
    )
  })

  it('shows no "from" part when a 180° turn keeps the size in order', () => {
    editor.applyGeometry({ ...identityGeometry({ width: 4096, height: 2731 }), rotation: 180 })
    const wrapper = mount(EditorStatusBar)
    expect(wrapper.get('[data-testid="dimensions-readout"]').text()).toBe('4096 × 2731 px')
  })

  it('shows the applied Work, not the Draft, while a tool is open', () => {
    editor.openTool('crop-rotate')
    editor.setPreviewGeometry({
      ...identityGeometry({ width: 4096, height: 2731 }),
      crop: { x: 0, y: 0, width: 10, height: 10 },
    })
    const wrapper = mount(EditorStatusBar)
    expect(wrapper.get('[data-testid="dimensions-readout"]').text()).toBe('4096 × 2731 px')
  })

  it('shows the live zoom level as a rounded percentage', async () => {
    const wrapper = mount(EditorStatusBar)
    expect(wrapper.get('[data-testid="zoom-level"]').text()).toBe('24%') // Fit = 1000/4096
    editor.actualSize()
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="zoom-level"]').text()).toBe('100%')
  })

  it('steps through the fixed levels with − and +', async () => {
    const wrapper = mount(EditorStatusBar)
    await button(wrapper, 'Zoom in').trigger('click')
    expect(editor.view.zoom).toBe(0.25)
    await button(wrapper, 'Zoom in').trigger('click')
    expect(editor.view.zoom).toBeCloseTo(1 / 3)
    await button(wrapper, 'Zoom out').trigger('click')
    expect(editor.view.zoom).toBe(0.25)
  })

  it('has Fit and 100% buttons', async () => {
    const wrapper = mount(EditorStatusBar)
    await button(wrapper, '100%').trigger('click')
    expect(editor.view).toMatchObject({ zoom: 1, autoFit: false })
    await button(wrapper, 'Fit').trigger('click')
    expect(editor.view.autoFit).toBe(true)
  })

  it('lists each control’s shortcut in its tooltip', () => {
    const wrapper = mount(EditorStatusBar)
    expect(button(wrapper, 'Zoom in').attributes('title')).toContain('+')
    expect(button(wrapper, 'Zoom out').attributes('title')).toContain('-')
    expect(button(wrapper, 'Fit').attributes('title')).toContain('Shift+1')
    expect(button(wrapper, '100%').attributes('title')).toContain('Shift+0')
  })

  it('stays at 800% when zooming in at the top', async () => {
    const wrapper = mount(EditorStatusBar)
    for (let i = 0; i < 20; i++) await button(wrapper, 'Zoom in').trigger('click')
    expect(editor.view.zoom).toBe(8)
  })
})
