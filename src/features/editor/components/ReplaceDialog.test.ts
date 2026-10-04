import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { ok } from '@/core'
import ReplaceDialog from './ReplaceDialog.vue'
import { useEditorStore } from '../store'

const image = (width: number) => ({
  bitmap: { width, height: 100, close() {} } as unknown as ImageBitmap,
  sourceWidth: width,
  sourceHeight: 100,
  width,
  height: 100,
  format: 'png' as const,
  animated: false,
  downscaled: false,
})

describe('ReplaceDialog (SCR-03, AC-15)', () => {
  let editor: ReturnType<typeof useEditorStore>
  let wrapper: VueWrapper

  beforeEach(async () => {
    setActivePinia(createPinia())
    editor = useEditorStore()
    let width = 100
    editor.setDecoder(async () => ok(image(width++)))
    editor.setCanvasSize(1000, 1000)
    await editor.openImage(new Blob())
    editor.applyEdit()
    await editor.openImage(new Blob())
    expect(editor.phase).toBe('confirming')
    wrapper = mount(ReplaceDialog, { attachTo: document.body })
    await nextTick()
  })
  afterEach(() => wrapper.unmount())

  it('uses the SCR-03 copy', () => {
    expect(wrapper.get('h2').text()).toBe('Replace the current image?')
    expect(wrapper.text()).toContain('Your edits to the current image will be lost.')
    expect(wrapper.get('.base-button--secondary').text()).toBe('Cancel')
    expect(wrapper.get('.base-button--primary').text()).toBe('Replace')
  })

  it('puts focus on Cancel first', () => {
    expect(document.activeElement?.textContent?.trim()).toBe('Cancel')
  })

  it('Cancel keeps the Work', async () => {
    const work = editor.work
    await wrapper.get('.base-button--secondary').trigger('click')
    expect(editor.phase).toBe('idle')
    expect(editor.work).toBe(work)
  })

  it('Esc cancels', async () => {
    const work = editor.work
    await wrapper.get('[role="alertdialog"]').trigger('keydown', { key: 'Escape' })
    expect(editor.phase).toBe('idle')
    expect(editor.work).toBe(work)
  })

  it('Replace swaps in the new image', async () => {
    await wrapper.get('.base-button--primary').trigger('click')
    expect(editor.phase).toBe('idle')
    expect(editor.work!.original.width).toBe(101)
    expect(editor.work!.revision).toBe(0)
  })
})
